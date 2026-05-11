// Seed employee list — mirrors src/data/mockData.js EMPLOYEES.
// Used to map names in the CSV to stable employeeIds so the rest of the
// app (call-out detection, replacement ranking) keeps working.
export const SEED_EMPLOYEES = [
  { id: 1, name: 'Maria Santos' },
  { id: 2, name: 'Jake Thompson' },
  { id: 3, name: 'Priya Patel' },
  { id: 4, name: 'Carlos Rivera' },
  { id: 5, name: 'Emma Wilson' },
  { id: 6, name: 'Darius Okafor' },
  { id: 7, name: 'Sophie Chen' },
  { id: 8, name: 'Marcus Bell' },
  { id: 9, name: 'Tina Kowalski' },
  { id: 10, name: 'Luis Mendez' },
];

const nameToId = new Map(SEED_EMPLOYEES.map(e => [e.name.toLowerCase(), e.id]));
let nextId = Math.max(...SEED_EMPLOYEES.map(e => e.id)) + 1;

export function resolveEmployeeId(name) {
  const key = name.trim().toLowerCase();
  if (nameToId.has(key)) return nameToId.get(key);
  const id = nextId++;
  nameToId.set(key, id);
  return id;
}
