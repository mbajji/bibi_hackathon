-- Run this in Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS throughout.

-- ── Profiles ──────────────────────────────────────────────────────────────────
-- Auto-created for every auth.users row via trigger below.

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  role       TEXT        NOT NULL DEFAULT 'manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"  ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON profiles;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger: insert a profile row whenever a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── Workspaces ────────────────────────────────────────────────────────────────
-- ShiftSaver's existing "workspace" is the restaurant/organization boundary
-- (the app's equivalent of the requested organizations model).

CREATE TABLE IF NOT EXISTS workspaces (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL DEFAULT 'My Restaurant',
  type          TEXT        NOT NULL DEFAULT 'restaurant',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspaces_all_own" ON workspaces;
CREATE POLICY "workspaces_all_own" ON workspaces
  FOR ALL USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);


-- ── Discord links ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discord_links (
  id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  guild_id     TEXT        NOT NULL,
  guild_name   TEXT,
  channel_id   TEXT        NOT NULL,
  channel_name TEXT,
  link_method  TEXT,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE discord_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discord_links_all_own" ON discord_links;
CREATE POLICY "discord_links_all_own" ON discord_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id            = discord_links.workspace_id
        AND workspaces.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id            = discord_links.workspace_id
        AND workspaces.owner_user_id = auth.uid()
    )
  );


-- ── Shifts ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shifts (
  id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id  UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  employee_id   INT,
  employee_name TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  day           TEXT        NOT NULL,
  start_time    TEXT        NOT NULL,
  end_time      TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'scheduled',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_authenticated" ON shifts;
DROP POLICY IF EXISTS "shifts_all_own" ON shifts;
CREATE POLICY "shifts_all_own" ON shifts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id            = shifts.workspace_id
        AND workspaces.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id            = shifts.workspace_id
        AND workspaces.owner_user_id = auth.uid()
    )
  );


-- ── Call-outs ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS call_outs (
  id                BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id      UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  employee_name     TEXT        NOT NULL,
  employee_id       INT,
  role              TEXT,
  message           TEXT,
  discord_username  TEXT,
  detected_at       TEXT,
  shift_time        TEXT        NOT NULL DEFAULT 'Today',
  call_out_type     TEXT        NOT NULL DEFAULT 'Emergency',
  urgency           TEXT        NOT NULL DEFAULT 'High',
  urgency_reason    TEXT,
  confidence        INT                  DEFAULT 85,
  status            TEXT        NOT NULL DEFAULT 'pending-approval',
  outreach_target   TEXT,
  covered_by        TEXT,
  coverage_declined BOOLEAN     NOT NULL DEFAULT FALSE,
  declined_by       TEXT,
  plan              JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE call_outs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_outs_all_own" ON call_outs;
CREATE POLICY "call_outs_all_own" ON call_outs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id            = call_outs.workspace_id
        AND workspaces.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id            = call_outs.workspace_id
        AND workspaces.owner_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS call_outs_workspace_id_idx ON call_outs(workspace_id);
CREATE INDEX IF NOT EXISTS call_outs_status_idx       ON call_outs(status);
CREATE INDEX IF NOT EXISTS call_outs_created_at_idx   ON call_outs(created_at DESC);
CREATE INDEX IF NOT EXISTS shifts_workspace_id_idx     ON shifts(workspace_id);
CREATE INDEX IF NOT EXISTS discord_links_workspace_idx ON discord_links(workspace_id);
