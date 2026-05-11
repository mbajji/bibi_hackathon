# ShiftSaver Server

Express + MongoDB backend for the staff schedule. Reads/writes shifts from a Mongo collection; accepts CSV uploads from the frontend.

## One-time setup

### 1. Create a free MongoDB Atlas cluster

1. Go to https://www.mongodb.com/cloud/atlas/register and sign up (no credit card).
2. Create a new project, then **Build a Database** → choose the free **M0** tier.
3. Pick any cloud provider / region close to you. Click **Create**.
4. **Database Access** (left sidebar) → **Add New Database User**. Username + password — write these down.
5. **Network Access** (left sidebar) → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`). Fine for development.
6. Back on **Database** → **Connect** → **Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://USER:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. Replace `<password>` with the password from step 4, and add a database name before the `?`:
   ```
   mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/shiftsaver?retryWrites=true&w=majority
   ```

### 2. Configure this server

```
cp .env.example .env
```

Open `.env` and paste your connection string into `MONGODB_URI=`.

### 3. Install + run
```
npm install
npm start
```

You should see:
```
Connected to MongoDB
Server listening on http://localhost:3001
```

## Running the frontend with the backend

From the project root (`bibHacks/`):

Terminal 1 — backend:
```
cd bibi_hackathon/server
npm start
```

Terminal 2 — frontend:
```
cd bibi_hackathon
npm start
```

The React dev server proxies `/api/*` to `http://localhost:3001` (configured in `bibi_hackathon/package.json`), so no CORS setup is needed during development.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/shifts` | List all shifts. Add `?day=Sat` to filter. |
| `POST` | `/api/shifts/upload` | Multipart form upload of a CSV file under field name `file`. Replaces all shifts. |
| `DELETE` | `/api/shifts` | Wipe all shifts. |

## CSV format

Header row required. Columns:

```csv
employeeName,role,day,start,end
Maria Santos,Server,Mon,11:00,16:00
```

- `day`: one of `Mon Tue Wed Thu Fri Sat Sun` (case-sensitive).
- `start` / `end`: 24-hour `HH:MM`.
- `role`: free text; known roles (`Server`, `Line Cook`, `Sous Chef`, `Bartender`, `Host`, `Busser`) get color-coding on the schedule.

A working sample lives at `../../sample_schedule.csv` (project root). Click **Import CSV** on the Staff Schedule page and pick that file to see it work end-to-end.

## How employee IDs work

Names in the CSV are looked up against a seed list (`seedEmployees.js`) that mirrors `../src/data/mockData.js`. Known names reuse their stable `employeeId` so call-out detection keeps matching the right person. New names get a fresh ID allocated.
