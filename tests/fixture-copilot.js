/* ==========================================================================
   Verzonnen analysebestand van het Copilot-gebruik (.xlsx), voor de tests
   --------------------------------------------------------------------------
   Dezelfde opbouw als het echte bestand: tabbladen Analyse, Gebruikers (één
   rij per persoon) en een verborgen tabblad Chart Data met meerdere tabellen
   naast elkaar, gedeelde teksten, een tekst met opmaak per stukje en datums
   als Excel-getal. Alle cijfers en id's zijn verzonnen.
     AIAuditTest.zip({ naam: tekst }, { deflate: true })      → Uint8Array
     AIAuditTest.copilotWorkbook({ people, weekly, channels }) → Uint8Array
     AIAuditTest.copilotDisciplineWorkbook({ tabblad: { people, weekly, channels } })
       → Uint8Array, een tabblad per discipline (zoals Audit/Accountants/Belastingadviseurs)
     AIAuditTest.copilotSample({ weeks, basic, premium, start, seed })
       → { people, weekly, channels } met realistische, vaste toevalscijfers
   Ook te gebruiken in de site zelf (Beheer → Copilot-gebruik uitproberen
   zonder echte gegevens): laad dit script en zet het bestand in het
   bestandsveld.
   ========================================================================== */
(function () {
  'use strict';

  const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const PACKAGE = 'http://schemas.openxmlformats.org/package/2006/relationships';

  const CRC = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /** Een zip met deze bestanden; met deflate: true ingepakt (zoals Excel doet), anders zonder compressie. */
  async function zip(files, options) {
    const encoder = new TextEncoder();
    const deflate = Boolean(options && options.deflate);
    const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
    const parts = [];
    const central = [];
    let offset = 0;
    for (const [name, text] of Object.entries(files)) {
      const nameBytes = encoder.encode(name);
      const raw = encoder.encode(text);
      const data = deflate ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : raw;
      const crc = crc32(raw);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(8, deflate ? 8 : 0, true);
      local.setUint16(12, DOS_DATE, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, raw.length, true);
      local.setUint16(26, nameBytes.length, true);
      parts.push(new Uint8Array(local.buffer), nameBytes, data);
      const entry = new DataView(new ArrayBuffer(46));
      entry.setUint32(0, 0x02014b50, true);
      entry.setUint16(4, 20, true);
      entry.setUint16(6, 20, true);
      entry.setUint16(10, deflate ? 8 : 0, true);
      entry.setUint16(14, DOS_DATE, true);
      entry.setUint32(16, crc, true);
      entry.setUint32(20, data.length, true);
      entry.setUint32(24, raw.length, true);
      entry.setUint16(28, nameBytes.length, true);
      entry.setUint32(42, offset, true);
      central.push(new Uint8Array(entry.buffer), nameBytes);
      offset += 30 + nameBytes.length + data.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    const count = Object.keys(files).length;
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, count, true);
    end.setUint16(10, count, true);
    end.setUint32(12, central.reduce((sum, part) => sum + part.length, 0), true);
    end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const result = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
    let position = 0;
    all.forEach((part) => {
      result.set(part, position);
      position += part.length;
    });
    return result;
  }

  const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const column = (index) => {
    let name = '';
    for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    return name;
  };
  const serial = (iso) => (Date.parse(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000;

  /** Werkblad-XML; teksten gaan naar de gedeelde lijst, behalve { inline: '…' }. */
  function sheetXml(rows, strings) {
    const shared = (text) => {
      if (!strings.has(text)) strings.set(text, strings.size);
      return strings.get(text);
    };
    const body = rows.map((cells, r) => `<row r="${r + 1}">${cells.map((value, c) => {
      const ref = column(c) + (r + 1);
      if (value === undefined || value === null) return '';
      if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
      if (typeof value === 'object') return `<c r="${ref}" t="inlineStr"><is><t>${escape(value.inline)}</t></is></c>`;
      return `<c r="${ref}" t="s"><v>${shared(value)}</v></c>`;
    }).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${MAIN}"><sheetData>${body}</sheetData></worksheet>`;
  }

  /** De tabbladen zoals in het echte analysebestand, met deze cijfers. */
  function copilotWorkbook({ people, weekly, channels }) {
    const strings = new Map();
    const analyse = [[{ inline: 'COPILOT-GEBRUIK (VERZONNEN TESTBESTAND)' }], [], ['Alle cijfers in dit bestand zijn verzonnen.']];
    const users = [['PersonId', 'Huidige licentie', 'Basic-prompts totaal', 'Premium-acties totaal', 'Totaal volume', 'Volume laatste 4 weken', 'Actieve weken']]
      .concat(people.map((p) => [p.id, p.licence, p.basicTotal, p.premiumTotal, p.total, p.recent, p.activeWeeks]));
    const chart = [['Week', 'Actieve gebruikers Basic', 'Actieve gebruikers Premium', 'Basic-prompts', 'Premium-acties', undefined, 'Licentie', 'Personen', undefined, undefined, undefined, undefined, undefined, 'Basic-kanaal', 'Prompts laatste 4 weken']];
    weekly.forEach((week, index) => {
      const row = [serial(week.week), week.active.basic, week.active.premium, week.volume.basic, week.volume.premium];
      if (index < 2) row[6] = index ? 'Premium' : 'Basic'; // een tweede tabel naast de weken (korter)
      if (index < channels.length) {
        row[13] = channels[index].name;
        row[14] = channels[index].volume;
      }
      chart.push(row);
    });
    const sheets = [analyse, users, chart].map((rows) => sheetXml(rows, strings));
    // Eén gedeelde tekst met opmaak per stukje, zoals Excel soms opslaat
    const sst = Array.from(strings.keys()).map((text) => (text === 'Huidige licentie'
      ? '<si><r><t xml:space="preserve">Huidige </t></r><r><rPr><b/></rPr><t>licentie</t></r></si>'
      : `<si><t>${escape(text)}</t></si>`)).join('');
    return zip({
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
      '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PACKAGE}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${MAIN}" xmlns:r="${REL}"><workbookPr/><sheets><sheet name="Analyse" sheetId="2" r:id="rId1"/><sheet name="Gebruikers" sheetId="3" r:id="rId2"/><sheet name="Chart Data" sheetId="4" state="hidden" r:id="rId3"/></sheets></workbook>`,
      // Het derde pad vanaf de wortel (met een / ervoor): dat mag ook
      'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PACKAGE}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${REL}/worksheet" Target="/xl/worksheets/sheet3.xml"/><Relationship Id="rId4" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
      'xl/sharedStrings.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="${MAIN}" count="${strings.size}" uniqueCount="${strings.size}">${sst}</sst>`,
      'xl/worksheets/sheet1.xml': sheets[0],
      'xl/worksheets/sheet2.xml': sheets[1],
      'xl/worksheets/sheet3.xml': sheets[2]
    }, { deflate: true });
  }

  /**
   * Een tabblad per discipline ({ 'Audit': cijfers, 'Accountants': cijfers, … }), zoals het bestand met
   * Audit, Accountants en Belastingadviseurs: per tabblad bovenaan een titel, rechts de weken (vanaf
   * kolom N) en de kanalen (vanaf kolom W), en vanaf rij 50 de tabel per persoon.
   */
  function copilotDisciplineWorkbook(perSheet) {
    const strings = new Map();
    const names = Object.keys(perSheet);
    const sheets = names.map((name) => {
      // null: een tabblad zonder tabellen (bijvoorbeeld een toelichting)
      if (!perSheet[name]) return sheetXml([['Toelichting bij dit bestand (verzonnen)']], strings);
      const { people, weekly, channels } = perSheet[name];
      const rows = [];
      const put = (r, c, value) => {
        rows[r] = rows[r] || [];
        rows[r][c] = value;
      };
      put(0, 0, 'COPILOT-GEBRUIK BINNEN ' + name.toUpperCase() + ' (VERZONNEN)');
      ['Week', 'Actieve gebruikers Basic', 'Actieve gebruikers Premium', 'Basic-prompts', 'Premium-acties'].forEach((header, c) => put(0, 13 + c, header));
      ['Basic-kanaal', 'Prompts laatste 4 weken'].forEach((header, c) => put(0, 22 + c, header));
      weekly.forEach((week, w) => [serial(week.week), week.active.basic, week.active.premium, week.volume.basic, week.volume.premium].forEach((value, c) => put(w + 1, 13 + c, value)));
      channels.forEach((channel, i) => {
        put(i + 1, 22, channel.name);
        put(i + 1, 23, channel.volume);
      });
      ['PersonId', 'Huidige licentie', 'Basic-prompts totaal', 'Premium-acties totaal', 'Totaal volume', 'Volume laatste 4 weken', 'Actieve weken'].forEach((header, c) => put(49, c, header));
      people.forEach((p, i) => [p.id, p.licence, p.basicTotal, p.premiumTotal, p.total, p.recent, p.activeWeeks].forEach((value, c) => put(50 + i, c, value)));
      for (let r = 0; r < rows.length; r += 1) rows[r] = rows[r] || [];
      return sheetXml(rows, strings);
    });
    const sst = Array.from(strings.keys()).map((text) => `<si><t>${escape(text)}</t></si>`).join('');
    const files = {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>',
      '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PACKAGE}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${MAIN}" xmlns:r="${REL}"><workbookPr/><sheets>${names.map((name, i) => `<sheet name="${escape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PACKAGE}">${names.map((name, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${names.length + 1}" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
      'xl/sharedStrings.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="${MAIN}" count="${strings.size}" uniqueCount="${strings.size}">${sst}</sst>`
    };
    sheets.forEach((xml, i) => {
      files[`xl/worksheets/sheet${i + 1}.xml`] = xml;
    });
    return zip(files, { deflate: true });
  }

  /** Verzonnen cijfers die er echt uitzien: groepen, een zomerdip en wat groei. Zelfde seed, zelfde cijfers. */
  function copilotSample(options) {
    const { weeks = 27, basic = 80, premium = 24, start = '2026-03-08', seed = 1 } = options || {};
    let state = seed >>> 0;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const people = [];
    for (let i = 0; i < basic + premium; i += 1) {
      const isPremium = i < premium;
      const habit = isPremium ? 0.6 + random() * 0.4 : random();
      const activeWeeks = Math.round(habit * weeks);
      const perWeek = isPremium ? 25 + random() * 40 : 4 + random() * 22;
      const total = Math.round(activeWeeks * perWeek);
      const recent = habit < 0.15 ? 0 : Math.round(Math.min(4, 1 + habit * 3.5) * perWeek);
      const basicTotal = isPremium ? Math.round(total * 0.1) : total;
      people.push({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, licence: isPremium ? 'Premium' : 'Basic', basicTotal, premiumTotal: total - basicTotal, total, recent, activeWeeks });
    }
    const first = Date.parse(start + 'T00:00:00Z');
    const weekly = [];
    for (let w = 0; w < weeks; w += 1) {
      const dip = 1 - 0.55 * Math.exp(-((w - weeks * 0.6) ** 2) / 6);
      const growth = 1 + (w / weeks) * 0.35;
      const activeBasic = Math.min(basic, Math.round(basic * 0.5 * dip * growth * (0.9 + random() * 0.2)));
      const activePremium = Math.min(premium, Math.round(premium * 0.85 * dip * (0.95 + random() * 0.1)));
      weekly.push({
        week: new Date(first + w * 7 * 86400000).toISOString().slice(0, 10),
        active: { basic: activeBasic, premium: activePremium },
        volume: { basic: Math.round(activeBasic * (14 + random() * 8)), premium: Math.round(activePremium * (42 + random() * 12)) }
      });
    }
    const basicRecent = people.filter((p) => p.licence === 'Basic').reduce((sum, p) => sum + p.recent, 0);
    const channels = [['Copilot-app', 0.86], ['Teams', 0.09], ['Edge', 0.03], ['Outlook', 0.02], ['Excel', 0], ['PowerPoint', 0], ['Word', 0]]
      .map(([name, share]) => ({ name, volume: Math.round(basicRecent * share) }));
    return { people, weekly, channels };
  }

  window.AIAuditTest = Object.assign(window.AIAuditTest || {}, { zip, copilotWorkbook, copilotDisciplineWorkbook, copilotSample });
})();
