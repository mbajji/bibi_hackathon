import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { INITIAL_CALL_OUTS, EMPLOYEES, WEEKLY_SHIFTS } from '../data/mockData';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { parseShiftsCsv } from '../lib/shiftCsv';

const AppContext = createContext(null);

const BACKEND_URL = 'http://localhost:3001';

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

function generatePlan(employee, text, keywords) {
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
      reason: isScheduled
        ? `Already scheduled today — could extend shift (${e.hoursThisWeek} hrs this week)`
        : `Not scheduled today — ${e.hoursThisWeek} hrs this week, available for extra shift`,
      score: Math.max(40, 95 - i * 18 - (isScheduled ? 15 : 0)),
    };
  });

  const callOutType = keywords.some(k => ['sick', 'fever', 'hospital', 'urgent care', 'throwing up'].includes(k))
    ? 'Illness'
    : 'Emergency';

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
        message: `📢 We're short one ${role} today. If anyone can come in or come in early, please reply or DM me. Thanks!`,
      }]
    : [{
        id: draftMsgId,
        to: 'Staff Group',
        type: 'Group',
        message: `📢 We're short one ${role} today. If anyone can cover, please reply here or DM me. Thanks!`,
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
  const [callOuts, setCallOuts] = useState(INITIAL_CALL_OUTS);
  const [extraTasks, setExtraTasks] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('call_out_detected', ({ sender, username, text, keywords, time }) => {
      const employee = EMPLOYEES.find(e =>
        e.name.toLowerCase() === sender.toLowerCase() ||
        e.discord?.toLowerCase() === username.toLowerCase()
      ) || null;

      const newCase = {
        id: Date.now(),
        employeeName: employee?.name || sender,
        employeeId: employee?.id || null,
        role: employee?.role || 'Staff',
        telegramMessage: text,
        telegramUsername: username,
        detectedAt: time,
        shift: 'Today',
        shiftTime: 'Today',
        callOutType: keywords.some(k => ['sick', 'fever', 'hospital', 'urgent care', 'throwing up'].includes(k)) ? 'Illness' : 'Emergency',
        reason: text.slice(0, 80),
        urgency: 'High',
        urgencyReason: 'Live call-out detected via Discord',
        confidence: 85,
        status: 'pending-approval',
        outreachTarget: null,
        plan: generatePlan(employee, text, keywords),
      };

      setCallOuts(prev => {
        // Don't duplicate if same person already has a pending case
        const alreadyExists = prev.some(c =>
          c.employeeName === newCase.employeeName &&
          ['pending-approval', 'outreach-sent'].includes(c.status)
        );
        return alreadyExists ? prev : [newCase, ...prev];
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
    setShiftsLoading(true);
    setShiftsError(null);
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
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
  }, []);

  useEffect(() => { refreshShifts(); }, [refreshShifts]);

  async function uploadShiftsCsv(file) {
    if (!supabaseConfigured) {
      throw new Error('Supabase not configured — see bibi_hackathon/.env.example');
    }
    const rows = await parseShiftsCsv(file);

    // Full replace: wipe then insert. Simplest semantics for an "import".
    const del = await supabase.from('shifts').delete().neq('id', 0);
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

  async function sendApprovedMessages(callOutId) {
    const callOut = callOuts.find(c => c.id === callOutId);
    if (!callOut) return;
    await fetch(`${BACKEND_URL}/send-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: callOut.plan.draftMessages }),
    }).catch(() => {});
    updateCallOutStatus(callOutId, 'outreach-sent');
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
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
