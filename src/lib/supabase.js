import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
// Accept either name so older docs (ANON_KEY) and current Supabase docs
// (PUBLISHABLE_KEY) both work — they're functionally the same browser-safe key.
const publishableKey =
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && publishableKey);

if (!url || !publishableKey) {
  // Surfaced to the dev console so it's obvious why nothing works.
  // eslint-disable-next-line no-console
  console.error(
    'Supabase env vars missing. Add REACT_APP_SUPABASE_URL and ' +
      'REACT_APP_SUPABASE_PUBLISHABLE_KEY to bibi_hackathon/.env then restart npm start.'
  );
}

export const supabase = supabaseConfigured ? createClient(url, publishableKey) : null;

function requireSupabase() {
  if (!supabase) return new Error('Supabase is not configured');
  return null;
}

function cleanString(value, max = 500) {
  if (value == null) return null;
  return String(value).trim().slice(0, max);
}

function validateCallOut(c) {
  if (!c || !cleanString(c.employeeName, 120)) {
    return new Error('Call-out employee name is required');
  }
  if (c.confidence != null && (Number(c.confidence) < 0 || Number(c.confidence) > 100)) {
    return new Error('Call-out confidence must be between 0 and 100');
  }
  return null;
}

const CALL_OUT_UPDATE_FIELDS = new Set([
  'status',
  'outreach_target',
  'covered_by',
  'coverage_declined',
  'declined_by',
  'plan',
]);

export async function fetchCallOuts(workspaceId) {
  const configError = requireSupabase();
  if (configError) return { data: null, error: configError };
  if (!workspaceId) return { data: null, error: new Error('workspaceId is required') };

  return supabase
    .from('call_outs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
}

export async function insertCallOut(workspaceId, c) {
  const configError = requireSupabase();
  if (configError) return { data: null, error: configError };
  if (!workspaceId) return { data: null, error: new Error('workspaceId is required') };

  const validationError = validateCallOut(c);
  if (validationError) return { data: null, error: validationError };

  return supabase
    .from('call_outs')
    .insert({
      workspace_id: workspaceId,
      employee_name: cleanString(c.employeeName, 120),
      employee_id: Number.isInteger(c.employeeId) ? c.employeeId : null,
      role: cleanString(c.role, 80) || 'Staff',
      message: cleanString(c.telegramMessage, 1000) || '',
      discord_username: cleanString(c.telegramUsername, 120),
      detected_at: cleanString(c.detectedAt, 80),
      shift_time: cleanString(c.shiftTime, 120) || 'Today',
      call_out_type: cleanString(c.callOutType, 80) || 'Emergency',
      urgency: cleanString(c.urgency, 40) || 'High',
      urgency_reason: cleanString(c.urgencyReason, 500),
      confidence: c.confidence == null ? 85 : Number(c.confidence),
      status: cleanString(c.status, 80) || 'pending-approval',
      outreach_target: cleanString(c.outreachTarget, 120),
      covered_by: cleanString(c.coveredBy, 120),
      coverage_declined: Boolean(c.coverageDeclined),
      declined_by: cleanString(c.declinedBy, 120),
      plan: c.plan || null,
    })
    .select()
    .single();
}

export async function updateCallOutDb(id, fields) {
  const configError = requireSupabase();
  if (configError) return { data: null, error: configError };
  if (!id) return { data: null, error: new Error('callOut id is required') };

  const payload = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (!CALL_OUT_UPDATE_FIELDS.has(key)) continue;
    if (typeof value === 'string') payload[key] = cleanString(value, 500);
    else payload[key] = value;
  }
  if (Object.keys(payload).length === 0) {
    return { data: null, error: new Error('No valid call-out fields to update') };
  }

  return supabase.from('call_outs').update(payload).eq('id', id);
}

export function dbToUiCallOut(row) {
  return {
    id: Number(row.id),
    employeeName: row.employee_name,
    employeeId: row.employee_id,
    role: row.role || 'Staff',
    telegramMessage: row.message || '',
    telegramUsername: row.discord_username,
    detectedAt: row.detected_at || '',
    shift: 'Today',
    shiftTime: row.shift_time || 'Today',
    callOutType: row.call_out_type || 'Emergency',
    reason: (row.message || '').slice(0, 80),
    urgency: row.urgency || 'High',
    urgencyReason: row.urgency_reason || 'Live call-out detected via Discord',
    confidence: row.confidence || 85,
    status: row.status || 'pending-approval',
    outreachTarget: row.outreach_target || null,
    coveredBy: row.covered_by || null,
    coverageDeclined: row.coverage_declined || false,
    declinedBy: row.declined_by || null,
    plan: row.plan || null,
  };
}
