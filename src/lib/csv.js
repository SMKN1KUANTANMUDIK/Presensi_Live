/** csv.js — util baca/tulis CSV tanpa dependensi (kompatibel Excel Indonesia) */

/** Deteksi pemisah: koma, titik koma, atau tab */
function detectDelimiter(firstLine) {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = -1;
  candidates.forEach((d) => {
    const count = firstLine.split(d).length;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  });
  return best;
}

/** Parse teks CSV → array of arrays (mendukung tanda kutip & newline dalam sel) */
export function parseCSV(text) {
  const clean = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/)[0] || '';
  const delim = detectDelimiter(firstLine);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

/** Ubah CSV menjadi array objek memakai baris pertama sebagai kunci */
export function csvToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { headers: rows[0] || [], objects: [] };

  const headers = rows[0].map((h) => String(h).trim().toLowerCase());
  const objects = rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = String(r[i] ?? '').trim();
    });
    return obj;
  });

  return { headers, objects };
}

/** Ambil nilai dari beberapa kemungkinan nama kolom */
export function pick(obj, names) {
  for (const n of names) {
    const key = n.toLowerCase();
    if (obj[key] !== undefined && obj[key] !== '') return obj[key];
  }
  return '';
}

/** Unduh teks sebagai file (menambahkan BOM agar Excel membaca UTF-8) */
export function downloadText(filename, text) {
  const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function toCSV(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
}
