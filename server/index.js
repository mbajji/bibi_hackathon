import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { Shift, VALID_DAYS } from './models/Shift.js';
import { resolveEmployeeId } from './seedEmployees.js';

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
console.log('Connected to MongoDB');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB ceiling — schedules are tiny
});

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeRow(row, index) {
  const required = ['employeeName', 'role', 'day', 'start', 'end'];
  const missing = required.filter(k => !row[k] || !String(row[k]).trim());
  if (missing.length) {
    throw new Error(`Row ${index + 2}: missing ${missing.join(', ')}`);
  }
  const name = String(row.employeeName).trim();
  const role = String(row.role).trim();
  const day = String(row.day).trim();
  const start = String(row.start).trim();
  const end = String(row.end).trim();

  if (!VALID_DAYS.includes(day)) {
    throw new Error(`Row ${index + 2}: day "${day}" must be one of ${VALID_DAYS.join(', ')}`);
  }
  if (!TIME_RE.test(start)) throw new Error(`Row ${index + 2}: start "${start}" must be HH:MM (24h)`);
  if (!TIME_RE.test(end)) throw new Error(`Row ${index + 2}: end "${end}" must be HH:MM (24h)`);
  if (start >= end) throw new Error(`Row ${index + 2}: start must be before end`);

  return {
    employeeId: resolveEmployeeId(name),
    employeeName: name,
    role,
    day,
    start,
    end,
    status: 'scheduled',
  };
}

// GET all shifts (optionally filtered by ?day=Sat)
app.get('/api/shifts', async (req, res) => {
  const filter = {};
  if (req.query.day) filter.day = req.query.day;
  const shifts = await Shift.find(filter).sort({ day: 1, start: 1 }).lean();
  res.json({ shifts });
});

// POST a CSV file — replaces all shifts (full replace = simplest semantics for an "upload")
app.post('/api/shifts/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Send field name "file".' });

  let rows;
  try {
    rows = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    return res.status(400).json({ error: `CSV parse failed: ${err.message}` });
  }

  if (rows.length === 0) return res.status(400).json({ error: 'CSV has no data rows.' });

  let normalized;
  try {
    normalized = rows.map(normalizeRow);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  await Shift.deleteMany({});
  await Shift.insertMany(normalized);
  res.json({ inserted: normalized.length });
});

// DELETE all shifts — handy for a "clear" button later
app.delete('/api/shifts', async (req, res) => {
  const { deletedCount } = await Shift.deleteMany({});
  res.json({ deleted: deletedCount });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
