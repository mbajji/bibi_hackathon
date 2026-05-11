# Supabase Persistence Notes

Run `supabase/migrations/001_rls_and_callouts.sql` in the Supabase SQL Editor before testing persistence.

## File Placement

- Client-safe Supabase setup: `src/lib/supabase.js`
- Call-out load/save integration: `src/context/AppContext.jsx`
- Workspace/server linking integration: `src/context/WorkspaceContext.jsx`
- Privileged backend operations: `server/index.js`
- Browser-safe env vars: `.env.local` or `.env`
- Server-only secrets: `server/.env`

## Security Model

- The React app only uses `REACT_APP_SUPABASE_PUBLISHABLE_KEY`; never put the service role key in frontend env vars.
- `server/index.js` is the only place that should use `SUPABASE_SERVICE_KEY`.
- `workspaces` are the restaurant/organization boundary for this app, matching the requested organization model in the existing codebase terminology.
- `call_outs`, `discord_links`, and `shifts` all include `workspace_id` and are protected by RLS policies that require `workspaces.owner_user_id = auth.uid()`.
- Backend service-role routes require the caller's Supabase access token and verify workspace ownership before reading or writing workspace data.
- Discord bot events are stored only after the frontend persists them under the authenticated user's workspace.

## Checklist

- Run the migration and confirm RLS is enabled for `profiles`, `workspaces`, `discord_links`, `shifts`, and `call_outs`.
- Keep `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_PUBLISHABLE_KEY`, and `REACT_APP_BACKEND_URL` in client env files.
- Keep `SUPABASE_SERVICE_KEY`, Discord tokens, and Groq keys only in `server/.env`.
- Restart both frontend and backend after changing env vars.
- Before production, migrate any old `shifts` rows without `workspace_id` into a workspace or delete them.
