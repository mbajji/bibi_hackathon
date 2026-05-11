import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { INITIAL_CALL_OUTS, EMPLOYEES, WEEKLY_SHIFTS } from '../data/mockData';
import { dbToUiCallOut, fetchCallOuts, insertCallOut, supabase, supabaseConfigured, updateCallOutDb } from '../lib/supabase';
import { parseShiftsCsv } from '../lib/shiftCsv';
import { useAuth } from '@clerk/clerk-react';
import { useWorkspace } from './WorkspaceContext';

const AppContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Map Supabase row (snake_case columns) into the shape the schedule UI expects.
function toUiShift(row) {
  return {
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    role: row.role,
    day: row.day,
    start: row.start_time,
    end: row.end_time,
    status: row.status,
  };
}

// ── Plan generator for live call-outs ─────────────────────────────────────────

let actionIdCounter = 1000;

function generatePlan(employee, _text, _keywords) {
  const role = employee?.role || 'Staff';
  const name = employee?.name || 'Unknown';

  // Find scheduled replacements (same role, not already in today's call-outs)
  const todayShifts = WEEKLY_SHIFTS['Sat'] || [];
  const sameRole = EMPLOYEES.filter(e =>
    e.role === role && e.id !== employee?.id
  );
  const replacements = sameRole.slice(0, 3).map((e, i) => {
    const isScheduled = todayShifts.some(s => s.employeeId === e.id);
    return {
      employeeId: e.id,
      name: e.name,
      role: e.role,
      discordUsername: e.discord || null,
      reason: isScheduled
        ? `Already scheduled today — could extend shift (${e.hoursThisWeek} hrs this week)`
        : `Not scheduled today — ${e.hoursThisWeek} hrs this week, available for extra shift`,
      score: Math.max(40, 95 - i * 18 - (isScheduled ? 15 : 0)),
    };
  });

  const roleLabel = (role === 'Staff' || !employee) ? 'a team member' : `one ${role}`;
  const draftMsgId = Date.now();
  const draftMessages = replacements.length > 0
    ? [{
        id: draftMsgId,
        to: replacements[0].name,
        type: 'DM',
        message: `Hey ${replacements[0].name.split(' ')[0]}! ${name} just called out. Any chance you can cover their shift today? Let me know ASAP 🙏`,
      }, {
        id: draftMsgId + 1,
        to: 'Staff Group',
        type: 'Group',
        message: `📢 We're short ${roleLabel} today. If anyone can come in or come in early, please reply or DM me. Thanks!`,
      }]
    : [{
        id: draftMsgId,
        to: 'Staff Group',
        type: 'Group',
        message: `📢 We're short ${roleLabel} today. If anyone can cover, please reply here or DM me. Thanks!`,
      }];

  const baseId = ++actionIdCounter;
  const actionQueue = [
    { id: baseId,     action: `Confirm coverage plan for ${name}'s shift`, owner: 'Manager', done: false },
    { id: baseId + 1, action: `Brief the team on the updated schedule`, owner: 'Manager', done: false },
    { id: baseId + 2, action: `Update the floor plan / station assignments if needed`, owner: 'Manager', done: false },
  ];

  return {
    shiftImpact: `1 ${role} short for today's service. ${replacements.length > 0 ? `Top replacement candidate: ${replacements[0].name}.` : 'No obvious in-house replacement — may need external hire.'}`,
    replacements,
    draftMessages,
    temporaryPlan: `Redistribute ${name}'s responsibilities among available ${role}s until a replacement is confirmed.`,
    actionQueue,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AppProvider({ children }) {
  const { getToken } = useAuth();
  const { workspace } = useWorkspace();
  const [callOuts, setCallOuts] = useState([]);
  const [extraTasks, setExtraTasks] = useState([]);
  const [discordStaff, setDiscordStaff] = useState([]);
  const socketRef = useRef(null);
  const workspaceIdRef = useRef(null);
  const callOutsRef = useRef([]);
  const accessTokenRef = useRef(null);

  useEffect(() => { workspaceIdRef.current = workspace?.id || null; }, [workspace?.id]);
  useEffect(() => { callOutsRef.current = callOuts; }, [callOuts]);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const token = await getToken();
        if (!cancelled) accessTokenRef.current = token || null;
      } catch {
        if (!cancelled) accessTokenRef.current = null;
      }
    }
    refresh();
    return () => { cancelled = true; };
  }, [getToken]);

  const authHeaders = useCallback(async () => {
    let token = accessTokenRef.current;
    if (!token) {
      try { token = await getToken(); } catch { token = null; }
      accessTokenRef.current = token || null;
    }
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const syncDiscordMembers = useCallback(async (guildId) => {
    if (!guildId) return [];
    try {
      const res = await fetch(`${BACKEND_URL}/api/discord/members/${guildId}`);
      const data = await res.json();
      if (!res.ok) return { error: data.error, hint: data.hint };
      if (data.members) { setDiscordStaff(data.members); return data.members; }
    } catch (err) {
      return { error: err.message };
    }
    return [];
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCallOuts() {
      if (!workspace?.id) {
        setCallOuts([]);
        return;
      }
      if (!supabaseConfigured) {
        setCallOuts(INITIAL_CALL_OUTS);
        return;
      }

      const { data, error } = await fetchCallOuts(workspace.id);
      if (cancelled) return;
      if (error) {
        console.error('Failed to load call-outs:', error.message);
        setCallOuts(INITIAL_CALL_OUTS);
        return;
      }
      setCallOuts((data || []).map(dbToUiCallOut));
    }

    loadCallOuts();
    return () => { cancelled = true; };
  }, [workspace?.id]);

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('coverage_response', ({ callOutId, accepted, respondent }) => {
      setCallOuts(prev => prev.map(c => {
        if (c.id !== callOutId) return c;
        if (accepted) return { ...c, status: 'covered', coveredBy: respondent };
        return { ...c, coverageDeclined: true, declinedBy: respondent };
      }));
      const fields = accepted
        ? { status: 'covered', covered_by: respondent }
        : { coverage_declined: true, declined_by: respondent };
      updateCallOutDb(callOutId, fields).then(({ error } = {}) => {
        if (error) console.error('Failed to persist coverage response:', error.message);
      });
    });

    socket.on('call_out_detected', ({ sender, username, text, keywords = [], category, time }) => {
      const employee = EMPLOYEES.find(e =>
        e.name.toLowerCase() === sender.toLowerCase() ||
        e.discord?.toLowerCase() === username.toLowerCase()
      ) || null;

      const illnessWords = ['sick', 'fever', 'hospital', 'urgent care', 'throwing up'];
      const isIllness = keywords.some(k => illnessWords.includes(k)) ||
        illnessWords.some(w => text.toLowerCase().includes(w));

      const tempId = Date.now();
      const newCase = {
        id: tempId,
        employeeName: employee?.name || sender,
        employeeId: employee?.id || null,
        role: employee?.role || 'Staff',
        telegramMessage: text,
        telegramUsername: username,
        detectedAt: time,
        shift: 'Today',
        shiftTime: 'Today',
        callOutType: isIllness ? 'Illness' : 'Emergency',
        reason: text.slice(0, 80),
        urgency: 'High',
        urgencyReason: 'Live call-out detected via Discord',
        confidence: category ? 90 : 85,
        status: 'pending-approval',
        outreachTarget: null,
        plan: generatePlan(employee, text, keywords),
      };

      // Don't duplicate if same person already has a pending/live case.
      const alreadyExists = callOutsRef.current.some(c =>
        c.employeeName === newCase.employeeName &&
        ['pending-approval', 'outreach-sent'].includes(c.status)
      );
      if (alreadyExists) return;

      setCallOuts(prev => [newCase, ...prev]);

      const workspaceId = workspaceIdRef.current;
      if (!workspaceId || !supabaseConfigured) return;

      insertCallOut(workspaceId, newCase).then(({ data, error }) => {
        if (error) {
          console.error('Failed to persist call-out:', error.message);
          return;
        }
        setCallOuts(prev => prev.map(c => c.id === tempId ? dbToUiCallOut(data) : c));
      });
    });

    return () => socket.disconnect();
  }, []);

  // Shifts come from Supabase. Until the first fetch finishes — or if Supabase
  // env vars aren't set — we fall back to WEEKLY_SHIFTS so the schedule page
  // is never blank.
  const [remoteShifts, setRemoteShifts] = useState(null);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [shiftsError, setShiftsError] = useState(null);

  const refreshShifts = useCallback(async () => {
    if (!supabaseConfigured) {
      setShiftsError('Supabase not configured — see bibi_hackathon/.env.example');
      return;
    }
    if (!workspace?.id) {
      setRemoteShifts(null);
      return;
    }
    setShiftsLoading(true);
    setShiftsError(null);
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('day', { ascending: true })
        .order('start_time', { ascending: true });
      if (error) throw error;
      setRemoteShifts((data || []).map(toUiShift));
    } catch (err) {
      setShiftsError(err.message || String(err));
      setRemoteShifts(null);
    } finally {
      setShiftsLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => { refreshShifts(); }, [refreshShifts]);

  async function uploadShiftsCsv(file) {
    if (!supabaseConfigured) {
      throw new Error('Supabase not configured — see bibi_hackathon/.env.example');
    }
    if (!workspace?.id) {
      throw new Error('Workspace is not ready yet.');
    }
    const rows = (await parseShiftsCsv(file)).map(row => ({
      ...row,
      workspace_id: workspace.id,
    }));

    // Full replace within this workspace only.
    const del = await supabase.from('shifts').delete().eq('workspace_id', workspace.id);
    if (del.error) throw new Error(`Delete failed: ${del.error.message}`);

    const ins = await supabase.from('shifts').insert(rows);
    if (ins.error) throw new Error(`Insert failed: ${ins.error.message}`);

    await refreshShifts();
    return { inserted: rows.length };
  }

  const shiftsByDay = useMemo(() => {
    if (!remoteShifts || remoteShifts.length === 0) return WEEKLY_SHIFTS;
    const grouped = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] };
    for (const s of remoteShifts) {
      if (!grouped[s.day]) continue;
      grouped[s.day].push(s);
    }
    for (const day of Object.keys(grouped)) {
      grouped[day].sort((a, b) => a.start.localeCompare(b.start));
    }
    return grouped;
  }, [remoteShifts]);

  const hasRemoteShifts = Array.isArray(remoteShifts) && remoteShifts.length > 0;

  function updateCallOutStatus(id, status) {
    setCallOuts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    updateCallOutDb(id, { status }).then(({ error } = {}) => {
      if (error) console.error('Failed to persist call-out status:', error.message);
    });
  }

  function toggleAction(callOutId, actionId) {
    setCallOuts(prev => prev.map(c => {
      if (c.id !== callOutId) return c;
      return {
        ...c,
        plan: {
          ...c.plan,
          actionQueue: c.plan.actionQueue.map(a =>
            a.id === actionId ? { ...a, done: !a.done } : a
          ),
        },
      };
    }));
  }

  function toggleExtraTask(id) {
    setExtraTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  function addExtraTask(text) {
    setExtraTasks(prev => [...prev, { id: Date.now(), action: text, done: false, custom: true }]);
  }

  function removeExtraTask(id) {
    setExtraTasks(prev => prev.filter(t => t.id !== id));
  }

  function updateDraftMessage(callOutId, messageId, text) {
    setCallOuts(prev => prev.map(c => {
      if (c.id !== callOutId) return c;
      return {
        ...c,
        plan: {
          ...c.plan,
          draftMessages: c.plan.draftMessages.map(m => m.id === messageId ? { ...m, message: text } : m),
        },
      };
    }));
  }

  function updateTemporaryPlan(callOutId, text) {
    setCallOuts(prev => prev.map(c => {
      if (c.id !== callOutId) return c;
      return { ...c, plan: { ...c.plan, temporaryPlan: text } };
    }));
  }

  async function sendApprovedMessages(callOutId, workspaceId, selectedEmployeeId) {
    const callOut = callOuts.find(c => c.id === callOutId);
    if (!callOut) return;
    const replacements = callOut.plan?.replacements || [];
    const askedReplacement = replacements.find(r => r.employeeId === selectedEmployeeId) || replacements[0];
    const askedUsername = askedReplacement?.discordUsername || null;
    const outreachTarget = askedReplacement?.name || 'Staff Group';
    await fetch(`${BACKEND_URL}/send-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ messages: callOut.plan.draftMessages, workspaceId, callOutId, askedUsername }),
    }).catch(() => {});
    setCallOuts(prev => prev.map(c =>
      c.id === callOutId ? { ...c, status: 'outreach-sent', outreachTarget } : c
    ));
    const { error } = await updateCallOutDb(callOutId, {
      status: 'outreach-sent',
      outreach_target: outreachTarget,
    });
    if (error) console.error('Failed to persist approved outreach:', error.message);
  }

  const stats = {
    active: callOuts.filter(c => !['covered', 'unresolved'].includes(c.status)).length,
    covered: callOuts.filter(c => c.status === 'covered').length,
    outreachSent: callOuts.filter(c => c.status === 'outreach-sent').length,
    pendingApproval: callOuts.filter(c => c.status === 'pending-approval').length,
  };

  return (
    <AppContext.Provider value={{
      callOuts, stats, extraTasks, socket: socketRef.current,
      shiftsByDay, hasRemoteShifts, shiftsLoading, shiftsError,
      refreshShifts, uploadShiftsCsv,
      updateCallOutStatus, sendApprovedMessages, toggleAction, toggleExtraTask, addExtraTask, removeExtraTask,
      updateDraftMessage, updateTemporaryPlan,
      discordStaff, syncDiscordMembers,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
