/* ==========================================================================
   Spreadsheets lezen in de browser (.xlsx en .csv)
   --------------------------------------------------------------------------
   Voor Beheer → Copilot-gebruik: een export inlezen zonder bibliotheek en
   zonder het bestand ergens heen te sturen. Een .xlsx is een zip met XML
   erin; dat pakken we hier zelf uit (DecompressionStream) en lezen we met
   DOMParser. Uitkomst, voor beide soorten een 'boek':
     { name, date1904, sheets: [{ name, hidden, rows: [[waarde, ...], ...] }] }
   met per cel een getal, een tekst of true/false (een lege cel: undefined).
   Datums staan in Excel als getal (dagen sinds 1900); excelDate maakt er
   '2026-03-08' van.
   findTable zoekt een tabel op de namen van de kolommen, niet op de plek: een
   kolom erbij, een andere volgorde of een ander tabblad maakt dan niet uit.
   ========================================================================== */
(function (ns) {
  'use strict';

  const MAX_FILE = 50 * 1024 * 1024;  // groter bestand: weigeren
  const MAX_PART = 100 * 1024 * 1024; // uitgepakt deel (tegen een klein bestand dat enorm uitpakt)
  const MAX_ROWS = 200000;
  const HEADER_ROWS = 100;            // de kopjes van een tabel staan in de eerste rijen van een tabblad

  /* ---- Zip ------------------------------------------------------------------------ */
  /** De inhoudsopgave van een zip: { has(naam), bytes(naam) }. */
  function openZip(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const broken = () => new Error('het bestand is beschadigd');
    // Het einde van de centrale lijst staat achteraan, eventueel gevolgd door een opmerking (max. 64 kB)
    let end = -1;
    for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at -= 1) {
      if (view.getUint32(at, true) === 0x06054b50) {
        end = at;
        break;
      }
    }
    if (end < 0) throw new Error('dit is geen Excel-bestand (.xlsx)');
    const count = view.getUint16(end + 10, true);
    let offset = view.getUint32(end + 16, true);
    const entries = new Map();
    const decoder = new TextDecoder();
    for (let n = 0; n < count; n += 1) {
      if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw broken();
      const nameLength = view.getUint16(offset + 28, true);
      entries.set(decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)), {
        flags: view.getUint16(offset + 8, true),
        method: view.getUint16(offset + 10, true),
        size: view.getUint32(offset + 20, true),
        local: view.getUint32(offset + 42, true)
      });
      offset += 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    }

    async function read(name) {
      const entry = entries.get(name);
      if (entry.flags & 1) throw new Error('het bestand is beveiligd met een wachtwoord');
      const at = entry.local;
      if (at + 30 > bytes.length || view.getUint32(at, true) !== 0x04034b50) throw broken();
      const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
      const data = bytes.subarray(start, start + entry.size);
      if (data.length < entry.size) throw broken();
      if (entry.method === 0) return data;
      if (entry.method !== 8) throw new Error('het bestand gebruikt een onbekende compressie');
      if (typeof DecompressionStream === 'undefined') throw new Error('deze browser kan het bestand niet uitpakken: gebruik een recente versie van Edge of Chrome');
      const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
      const chunks = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_PART) {
          reader.cancel();
          throw new Error('het bestand pakt te groot uit');
        }
        chunks.push(value);
      }
      const result = new Uint8Array(total);
      let position = 0;
      chunks.forEach((chunk) => {
        result.set(chunk, position);
        position += chunk.length;
      });
      return result;
    }

    return { has: (name) => entries.has(name), read };
  }

  /* ---- Excel (.xlsx) -------------------------------------------------------------- */
  function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('het bestand is beschadigd');
    return doc;
  }

  const all = (node, name) => Array.from(node.getElementsByTagNameNS('*', name));
  const children = (node, name) => Array.from(node.children).filter((child) => child.localName === name);
  const attribute = (node, name) => {
    const found = Array.from(node.attributes).find((item) => item.localName === name);
    return found ? found.value : null;
  };

  /** Tekst van een gedeelde of losse tekst, ook met opmaak per stukje (zonder de uitspraakhulp rPh). */
  const richText = (node) => Array.from(node.children).map((child) =>
    (child.localName === 't' ? child.textContent : child.localName === 'r' ? children(child, 't').map((t) => t.textContent).join('') : '')).join('');

  /** 'AB12' → { col: 27, row: 11 } (vanaf 0). */
  function cellPosition(ref) {
    const match = /^([A-Z]{1,3})(\d{1,7})$/.exec(ref || '');
    if (!match) return null;
    let col = 0;
    for (const letter of match[1]) col = col * 26 + letter.charCodeAt(0) - 64;
    return { col: col - 1, row: Number(match[2]) - 1 };
  }

  function cellValue(cell, shared) {
    const v = children(cell, 'v')[0];
    const raw = v ? v.textContent : '';
    switch (cell.getAttribute('t')) {
      case 's': return shared[Number(raw)];
      case 'inlineStr': return children(cell, 'is').map(richText).join('');
      case 'str':
      case 'd': return raw;
      case 'b': return raw === '1';
      case 'e': return undefined; // een fout in de cel, bijv. #DEEL/0!
      default: return raw === '' ? undefined : Number(raw);
    }
  }

  function readRows(doc, shared) {
    const rows = [];
    let rowIndex = -1;
    for (const row of all(doc, 'row')) {
      const r = Number(row.getAttribute('r'));
      rowIndex = r > 0 ? r - 1 : rowIndex + 1;
      if (rowIndex >= MAX_ROWS) break;
      const cells = [];
      let colIndex = -1;
      for (const cell of children(row, 'c')) {
        const position = cellPosition(cell.getAttribute('r'));
        colIndex = position ? position.col : colIndex + 1;
        const value = cellValue(cell, shared);
        if (value !== undefined && value !== '') cells[colIndex] = value;
      }
      rows[rowIndex] = cells;
    }
    return rows;
  }

  async function readXlsx(buffer, name) {
    const zip = openZip(buffer);
    const xml = async (path) => (zip.has(path) ? parseXml(new TextDecoder().decode(await zip.read(path))) : null);
    const workbook = await xml('xl/workbook.xml');
    if (!workbook) throw new Error('dit is geen Excel-werkmap (.xlsx)');
    const rels = await xml('xl/_rels/workbook.xml.rels');
    const targets = new Map(rels ? all(rels, 'Relationship').map((rel) => [rel.getAttribute('Id'), rel.getAttribute('Target')]) : []);
    const strings = await xml('xl/sharedStrings.xml');
    const shared = strings ? all(strings, 'si').map(richText) : [];
    const properties = all(workbook, 'workbookPr')[0];
    const sheets = [];
    for (const sheet of all(workbook, 'sheet')) {
      const target = targets.get(attribute(sheet, 'id'));
      if (!target) continue;
      // Het pad staat ten opzichte van xl/ (of vanaf de wortel, met een / ervoor)
      const doc = await xml(decodeURIComponent(new URL(target, 'https://zip/xl/').pathname.slice(1)));
      if (doc) sheets.push({ name: sheet.getAttribute('name') || '', hidden: (sheet.getAttribute('state') || 'visible') !== 'visible', rows: readRows(doc, shared) });
    }
    return { name, date1904: Boolean(properties) && ['1', 'true'].includes(properties.getAttribute('date1904')), sheets };
  }

  /* ---- CSV ------------------------------------------------------------------------ */
  /** Puntkomma, tab of komma: wat het vaakst in de eerste regel staat. Velden tussen "…" mogen alles bevatten. */
  function readCsv(text, name) {
    const source = String(text).replace(/^﻿/, '');
    const firstLine = source.split(/\r?\n/, 1)[0];
    const delimiter = [';', '\t', ','].map((mark) => [mark, firstLine.split(mark).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const endCell = () => {
      row.push(cell.trim() === '' ? undefined : cell);
      cell = '';
    };
    for (let i = 0; i < source.length && rows.length < MAX_ROWS; i += 1) {
      const char = source[i];
      if (quoted) {
        if (char !== '"') cell += char;
        else if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === delimiter) endCell();
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && source[i + 1] === '\n') i += 1;
        endCell();
        rows.push(row);
        row = [];
      } else cell += char;
    }
    if (cell || row.length) {
      endCell();
      rows.push(row);
    }
    return { name, date1904: false, sheets: [{ name, hidden: false, rows }] };
  }

  /** Een gekozen bestand lezen: .csv als tekst, anders als Excel-werkmap. */
  async function read(file) {
    const name = file.name || 'bestand';
    if (file.size > MAX_FILE) throw new Error('het bestand is groter dan 50 MB');
    if (/\.xls$/i.test(name)) throw new Error('dit is een oud Excel-bestand (.xls): sla het in Excel op als .xlsx');
    if (/\.(csv|txt)$/i.test(name) || file.type === 'text/csv') return readCsv(await file.text(), name);
    return readXlsx(await file.arrayBuffer(), name);
  }

  /* ---- Tabellen en waarden ------------------------------------------------------------ */
  const headerKey = (value) => String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toLowerCase();

  /**
   * Zoek een tabel op de namen van de kolommen (hoofdletters en spaties maken niet uit), in alle
   * tabbladen, ook verborgen. Geeft { sheet, rows: [{ kolomnaam: waarde }] }: de rijen onder de
   * kopjes, tot de eerste rij waarin al deze kolommen leeg zijn. null als geen tabblad ze heeft.
   */
  function findTable(book, headers) {
    const wanted = headers.map(headerKey);
    for (const sheet of book.sheets) {
      for (let r = 0; r < Math.min(sheet.rows.length, HEADER_ROWS); r += 1) {
        const names = (sheet.rows[r] || []).map(headerKey);
        const columns = wanted.map((name) => names.indexOf(name));
        if (columns.includes(-1)) continue;
        const rows = [];
        for (let i = r + 1; i < sheet.rows.length; i += 1) {
          const cells = sheet.rows[i] || [];
          const values = columns.map((col) => cells[col]);
          if (values.every((value) => value === undefined)) break;
          rows.push(Object.fromEntries(headers.map((header, n) => [header, values[n]])));
        }
        return { sheet: sheet.name, rows };
      }
    }
    return null;
  }

  /** Getal uit een cel: een getal blijft een getal; tekst als '12', '12.5' of '12,5' wordt een getal; de rest NaN. */
  function number(value) {
    if (typeof value === 'number') return value;
    const text = String(value == null ? '' : value).replace(/\s/g, '');
    return /^-?\d+([.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) : NaN;
  }

  /** Datum uit een cel als 'JJJJ-MM-DD': een Excel-getal, '2026-03-08' of '8-3-2026' (dag-maand-jaar). '' als het geen datum is. */
  function excelDate(value, date1904) {
    let year;
    let month;
    let day;
    if (typeof value === 'number') {
      if (!(value >= 1 && value < 2958466)) return '';
      const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
      return new Date(base + Math.floor(value) * 86400000).toISOString().slice(0, 10);
    }
    const text = String(value == null ? '' : value).trim();
    let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T ])/.exec(text);
    if (match) [, year, month, day] = match.map(Number);
    else {
      match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
      if (!match) return '';
      [, day, month, year] = match.map(Number);
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.toISOString().slice(0, 10) : '';
  }

  ns.adminSheets = { read, readXlsx, readCsv, findTable, number, excelDate };
})(window.AIAudit);
