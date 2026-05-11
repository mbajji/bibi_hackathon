import Papa from 'papaparse';
import { EMPLOYEES } from '../data/mockData';

const VALID_DAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Build a name -> id map from the seed employee list and allocate fresh IDs
// for any names that aren't in the seed. Mirrors server/seedEmployees.js so
// call-out detection (which keys off employeeId) keeps working after upload.
function makeIdResolver() {
  const map = new Map(EMPLOYEES.map(e => [e.name.toLowerCase(), e.id]));
  let nextId = Math.max(...EMPLOYEES.map(e => e.id)) + 1;
  return (name) => {
    const key = name.trim().toLowerCase();
    if (map.has(key)) return map.get(key);
    const id = nextId++;
    map.set(key, id);
    return id;
  };
}

/**
 * Parse a CSV File into rows shaped for the Supabase `shifts` table.
 * Throws on the first validation error with a row-numbered message so the
 * upload button can surface it to the user.
 */
export function parseShiftsCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
      complete: (results) => {
        if (results.errors.length) {
          return reject(new Error(`CSV parse failed: ${results.errors[0].message}`));
        }
        try {
          resolve(normalizeRows(results.data));
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(new Error(`CSV parse failed: ${err.message}`)),
    });
  });
}

function normalizeRows(rows) {
  if (rows.length === 0) throw new Error('CSV has no data rows.');
  const resolveId = makeIdResolver();
  return rows.map((row, idx) => {
    const lineNo = idx + 2; // header is line 1
    const missing = ['employeeName', 'role', 'day', 'start', 'end'].filter(
      k => !row[k] || !String(row[k]).trim()
    );
    if (missing.length) throw new Error(`Row ${lineNo}: missing ${missing.join(', ')}`);

    const name = String(row.employeeName).trim();
    const role = String(row.role).trim();
    const day = String(row.day).trim();
    const start = String(row.start).trim();
    const end = String(row.end).trim();

    if (!VALID_DAYS.has(day)) {
      throw new Error(`Row ${lineNo}: day "${day}" must be one of Mon Tue Wed Thu Fri Sat Sun`);
    }
    if (!TIME_RE.test(start)) throw new Error(`Row ${lineNo}: start "${start}" must be HH:MM (24h)`);
    if (!TIME_RE.test(end)) throw new Error(`Row ${lineNo}: end "${end}" must be HH:MM (24h)`);
    if (start >= end) throw new Error(`Row ${lineNo}: start must be before end`);

    // Column names match the Supabase table (snake_case).
    return {
      employee_id: resolveId(name),
      employee_name: name,
      role,
      day,
      start_time: start,
      end_time: end,
      status: 'scheduled',
    };
  });
}
