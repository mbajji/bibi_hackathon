import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { INITIAL_CALL_OUTS, WEEKLY_SHIFTS } from '../data/mockData';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { parseShiftsCsv } from '../lib/shiftCsv';

const AppContext = createContext(null);

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

export function AppProvider({ children }) {
  const [callOuts, setCallOuts] = useState(INITIAL_CALL_OUTS);
  const [extraTasks, setExtraTasks] = useState([]);

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

  const stats = {
    active: callOuts.filter(c => !['covered', 'unresolved'].includes(c.status)).length,
    covered: callOuts.filter(c => c.status === 'covered').length,
    outreachSent: callOuts.filter(c => c.status === 'outreach-sent').length,
    pendingApproval: callOuts.filter(c => c.status === 'pending-approval').length,
  };

  return (
    <AppContext.Provider value={{
      callOuts, stats, extraTasks,
      shiftsByDay, hasRemoteShifts, shiftsLoading, shiftsError,
      refreshShifts, uploadShiftsCsv,
      updateCallOutStatus, toggleAction, toggleExtraTask, addExtraTask, removeExtraTask,
      updateDraftMessage, updateTemporaryPlan,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
