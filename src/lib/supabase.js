import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
// Accept either name so older docs (ANON_KEY) and current Supabase docs
// (PUBLISHABLE_KEY) both work — they're functionally the same browser-safe key.
const publishableKey =
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!url || !publishableKey) {
  // Surfaced to the dev console so it's obvious why nothing works.
  // eslint-disable-next-line no-console
  console.error(
    'Supabase env vars missing. Add REACT_APP_SUPABASE_URL and ' +
      'REACT_APP_SUPABASE_PUBLISHABLE_KEY to bibi_hackathon/.env then restart npm start.'
  );
}

export const supabase = createClient(url || '', publishableKey || '');

export const supabaseConfigured = Boolean(url && publishableKey);
