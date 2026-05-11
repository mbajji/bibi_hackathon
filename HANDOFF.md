# Agent Handoff — ShiftSaver AI

## User's Last Prompt

> resolve all the 5 bugs and:
>
> You are helping me implement data persistence for my app using Supabase.
>
> Goal: Add reliable data persistence so user/application data is saved to Supabase and loaded correctly across sessions, while avoiding security mistakes that could leak data.
>
> Important security requirements:
> - Do NOT expose the Supabase service role key in frontend/client code.
> - Only use the public anon key on the client.
> - Enable and use Row Level Security (RLS) on all user-owned tables.
> - Write RLS policies so users can only read, insert, update, and delete rows that belong to them.
> - Do not allow users to access another user's restaurant/server/business data.
> - Do not create overly broad policies like `using (true)` unless the table is intentionally public.
> - Do not rely only on frontend checks for authorization.
> - Avoid storing sensitive secrets in the database unless necessary.
> - If environment variables are needed, use `.env.local` and clearly separate client-safe variables from server-only variables.
> - Validate all user input before inserting/updating records.
> - Make sure database queries are scoped by the authenticated user or their linked organization/server.
>
> Context: My app uses Supabase for auth and database persistence. Managerial accounts should be linked to a specific organization/restaurant/server.
>
> Please implement:
> 1. A clean Supabase schema for persistent data.
> 2. Proper relationships between users, organizations/servers, and the data they own.
> 3. RLS policies for every table.
> 4. Client-side Supabase queries for loading/saving data.
> 5. Server-side/API route logic only where needed for privileged operations.
> 6. Safe environment variable usage.
> 7. Error handling for failed reads/writes.
> 8. A short explanation of the security model.
>
> Expected database model:
> - `profiles` — id (references auth.users), email, role, created_at
> - `organizations` — id, name, type, created_at
> - `organization_members` — id, user_id, organization_id, role, created_at
> - App-specific tables should include an `organization_id` column.
>
> Access rules:
> - A user can read their own profile.
> - A user can read organizations only if they are a member.
> - A user can read/write app data only for organizations they belong to.
> - Managers can manage data inside their organization.
>
> Please generate: SQL migrations, Supabase client setup, data access helpers, frontend integration, file placement notes, and a security checklist.

---

## The 5 Bugs to Fix (identified before the big prompt)

1. **`outreachTarget` is always `null`** — Dashboard outreach cards show "Waiting on null". Fix: after `sendApprovedMessages`, set `outreachTarget` to the replacement's name on the call-out in state and DB.

2. **Dashboard empty state says "Telegram"** — `src/pages/Dashboard.jsx` line 78: `"No call-outs detected from Telegram"`. Change to `"No call-outs detected"`.

3. **`BACKEND_URL` hardcoded as `http://localhost:3001`** in 4 files:
   - `src/context/AppContext.jsx`
   - `src/context/WorkspaceContext.jsx`
   - `src/pages/ConnectDiscord.jsx`
   - `src/pages/DiscordMonitor.jsx`
   Fix: change to `process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'` and add `REACT_APP_BACKEND_URL=http://localhost:3001` to `.env` and `.env.example`.

4. **Dead file `src/pages/TelegramMonitor.jsx`** — Not imported anywhere. Delete it or overwrite with a redirect to `/discord`.

5. **`/setup` slash command mentioned in UI but not implemented** — `src/pages/DiscordMonitor.jsx` line 130 tells users to run `/setup` in Discord. No such command exists. Update the "how it works" text to remove this reference.

---

## Progress Made Before Handoff

### What was completed in this session

**All prior session work (already in codebase):**
- Full Discord bot integration with discord.js v14
- OAuth + manual guild ID + bot install linking flows (`src/pages/ConnectDiscord.jsx`)
- `WorkspaceContext` with Supabase workspace auto-creation
- `AppContext` with socket.io real-time call-out detection
- Coverage response detection (yes/no from Discord replies)
- `pendingCoverage` Map in backend to track who was asked
- ResolutionPlan UI simplified to single-column
- Draft messages fixed ("a team member" instead of "Staff")
- Pre-commit hook blocking secrets at `.git/hooks/pre-commit`
- Supabase auth (`src/context/AuthContext.jsx`, `src/pages/Login.jsx`)

**This session — completed:**
- Added `discordUsername` field to replacement objects in `generatePlan`
- Updated `sendApprovedMessages(callOutId, workspaceId, selectedEmployeeId)` — passes `callOutId` and `askedUsername` to backend
- Added `coverage_response` socket listener in AppContext (updates status to `covered` or sets `coverageDeclined: true`)
- Backend: added `pendingCoverage` Map, `detectCoverageResponse()`, checks coverage response in `messageCreate` before call-out queue, stores pending coverage in `/send-messages`
- ResolutionPlan: passes `effectiveReplId` to `handleApprove`, shows green/amber banners for yes/no responses

**This session — started but interrupted:**
- SQL migration file creation was interrupted by user (Write tool rejected). The migration was NOT written to disk.

---

## What Still Needs To Be Done

### Step 1 — Create SQL migration
Create `/Users/jontan/Documents/GitHub/bibi_hackathon/supabase/migrations/001_rls_and_callouts.sql` with:

```sql
-- profiles table + auto-create trigger
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, role TEXT NOT NULL DEFAULT 'manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, email) VALUES (NEW.id, NEW.email) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- workspaces RLS (table already exists)
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspaces_all_own" ON workspaces;
CREATE POLICY "workspaces_all_own" ON workspaces FOR ALL USING (auth.uid() = owner_user_id);

-- discord_links RLS (table already exists)
ALTER TABLE discord_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "discord_links_all_own" ON discord_links;
CREATE POLICY "discord_links_all_own" ON discord_links FOR ALL USING (
  EXISTS (SELECT 1 FROM workspaces WHERE workspaces.id = discord_links.workspace_id AND workspaces.owner_user_id = auth.uid())
);

-- shifts RLS (NOTE: no workspace_id column — tighten later)
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shifts_authenticated" ON shifts;
CREATE POLICY "shifts_authenticated" ON shifts FOR ALL USING (auth.role() = 'authenticated');

-- call_outs table (new)
CREATE TABLE IF NOT EXISTS call_outs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL, employee_id INT, role TEXT, message TEXT,
  discord_username TEXT, detected_at TEXT, shift_time TEXT NOT NULL DEFAULT 'Today',
  call_out_type TEXT NOT NULL DEFAULT 'Emergency', urgency TEXT NOT NULL DEFAULT 'High',
  urgency_reason TEXT, confidence INT DEFAULT 85,
  status TEXT NOT NULL DEFAULT 'pending-approval',
  outreach_target TEXT, covered_by TEXT,
  coverage_declined BOOLEAN NOT NULL DEFAULT FALSE, declined_by TEXT,
  plan JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE call_outs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "call_outs_all_own" ON call_outs;
CREATE POLICY "call_outs_all_own" ON call_outs FOR ALL USING (
  EXISTS (SELECT 1 FROM workspaces WHERE workspaces.id = call_outs.workspace_id AND workspaces.owner_user_id = auth.uid())
);
CREATE INDEX IF NOT EXISTS call_outs_workspace_id_idx ON call_outs(workspace_id);
CREATE INDEX IF NOT EXISTS call_outs_status_idx ON call_outs(status);
CREATE INDEX IF NOT EXISTS call_outs_created_at_idx ON call_outs(created_at DESC);
```

**The user must run this SQL in the Supabase dashboard (SQL Editor).**

### Step 2 — Add call-out helpers to `src/lib/supabase.js`

Append to the existing file (keep the existing createClient code):

```js
export async function fetchCallOuts(workspaceId) {
  if (!supabase) return { data: null, error: new Error('not configured') };
  return supabase.from('call_outs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
}

export async function insertCallOut(workspaceId, c) {
  if (!supabase) return { data: null, error: new Error('not configured') };
  return supabase.from('call_outs').insert({
    workspace_id: workspaceId,
    employee_name: c.employeeName, employee_id: c.employeeId, role: c.role,
    message: c.telegramMessage, discord_username: c.telegramUsername,
    detected_at: c.detectedAt, shift_time: c.shiftTime, call_out_type: c.callOutType,
    urgency: c.urgency, urgency_reason: c.urgencyReason, confidence: c.confidence,
    status: c.status, plan: c.plan,
  }).select().single();
}

export async function updateCallOutDb(id, fields) {
  if (!supabase) return;
  return supabase.from('call_outs').update(fields).eq('id', id);
}

export function dbToUiCallOut(row) {
  return {
    id: row.id,
    employeeName: row.employee_name, employeeId: row.employee_id,
    role: row.role || 'Staff', telegramMessage: row.message || '',
    telegramUsername: row.discord_username, detectedAt: row.detected_at || '',
    shift: 'Today', shiftTime: row.shift_time || 'Today',
    callOutType: row.call_out_type || 'Emergency',
    reason: (row.message || '').slice(0, 80),
    urgency: row.urgency || 'High', urgencyReason: row.urgency_reason || 'Live call-out detected via Discord',
    confidence: row.confidence || 85, status: row.status || 'pending-approval',
    outreachTarget: row.outreach_target || null, coveredBy: row.covered_by || null,
    coverageDeclined: row.coverage_declined || false, declinedBy: row.declined_by || null,
    plan: row.plan || null,
  };
}
```

### Step 3 — Update `src/context/AppContext.jsx`

Key changes needed:
1. Change `const BACKEND_URL = 'http://localhost:3001'` → `const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'`
2. Import `useWorkspace` from `./WorkspaceContext`
3. Import `fetchCallOuts`, `insertCallOut`, `updateCallOutDb`, `dbToUiCallOut` from `../lib/supabase`
4. Inside `AppProvider`:
   - Add `const { workspace } = useWorkspace();`
   - Add `const workspaceIdRef = useRef(null); useEffect(() => { workspaceIdRef.current = workspace?.id; }, [workspace?.id]);`
   - Change `useState(INITIAL_CALL_OUTS)` to `useState([])`
   - Add a `useEffect` that triggers on `workspace?.id` to load call-outs from Supabase (fall back to `INITIAL_CALL_OUTS` if Supabase not configured or fetch fails)
5. In `call_out_detected` socket handler: after adding to state, async-save to Supabase using `workspaceIdRef.current`, then replace temp `Date.now()` ID with the Supabase BIGINT ID
6. In `coverage_response` socket handler: also call `updateCallOutDb(id, { status: 'covered', covered_by: respondent })` or `updateCallOutDb(id, { coverage_declined: true, declined_by: respondent })`
7. In `updateCallOutStatus`: also call `updateCallOutDb(id, { status })`
8. In `sendApprovedMessages`: set `outreachTarget` on the call-out in state AND in DB (`updateCallOutDb(callOutId, { status: 'outreach-sent', outreach_target: outreachTarget })`)

### Step 4 — Fix BACKEND_URL in 3 other files

- `src/context/WorkspaceContext.jsx` line 6: change hardcoded URL to env var
- `src/pages/ConnectDiscord.jsx` line 6: change hardcoded URL to env var
- `src/pages/DiscordMonitor.jsx` line 8: change hardcoded URL to env var

### Step 5 — Fix the 5 bugs

**Bug 2** — `src/pages/Dashboard.jsx` line 78:
```jsx
// Change:
<p className="text-sm text-gray-400 mt-1">No call-outs detected from Telegram</p>
// To:
<p className="text-sm text-gray-400 mt-1">No call-outs detected</p>
```

**Bug 4** — Overwrite `src/pages/TelegramMonitor.jsx` with:
```jsx
import { Navigate } from 'react-router-dom';
export default function TelegramMonitor() { return <Navigate to="/discord" replace />; }
```

**Bug 5** — `src/pages/DiscordMonitor.jsx` around line 130: remove the `/setup` instruction. Replace with:
```
"Add ShiftSaver to your Discord server and link it from the sidebar. The bot reads every message and auto-creates a recovery case when it detects a call-out."
```

### Step 6 — Update `.env` and `.env.example`

Add to `.env` (root):
```
REACT_APP_BACKEND_URL=http://localhost:3001
```

Add to `.env.example` (root):
```
REACT_APP_BACKEND_URL=http://localhost:3001
```

---

## Project Overview (for context)

- **Framework**: React 19 (Create React App), not Next.js
- **Backend**: Express.js at `server/index.js`, port 3001
- **Frontend**: port 3002
- **Database**: Supabase (anon key on frontend, service role on backend)
- **Auth**: Supabase auth via `src/context/AuthContext.jsx`
- **Real-time**: socket.io for Discord call-out events
- **Existing tables**: `workspaces`, `discord_links`, `shifts`
- **Supabase client**: `src/lib/supabase.js`
- **Key contexts**: `AuthContext` > `WorkspaceContext` > `AppContext` (nested in that order)

## Security Model

- Frontend uses anon key + RLS — queries are automatically scoped to the authenticated user
- Backend uses service role key (in `server/.env`) — bypasses RLS intentionally for bot operations
- All `call_outs` rows are scoped via `workspace_id` → `workspaces.owner_user_id = auth.uid()`
- `shifts` table has no `workspace_id` yet — known limitation, all authenticated users share shifts
- No secrets in the DB; Discord tokens only in `server/.env`, Supabase service key only in `server/.env`

## Known Remaining Limitations (not in scope)

- `shifts` table needs `workspace_id` column for proper multi-tenant isolation
- Action checklist toggles and draft message edits are not persisted (lost on refresh) — only status changes and initial call-out data are saved
- Discord DMs are actually channel posts (bot can't DM arbitrary users without prior interaction)
- No toast notification when coverage response arrives while manager is on a different page
