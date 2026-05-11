import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { INITIAL_CALL_OUTS, WEEKLY_SHIFTS } from '../data/mockData';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [callOuts, setCallOuts] = useState(INITIAL_CALL_OUTS);
  const [extraTasks, setExtraTasks] = useState([]);

  // Shifts come from the backend (MongoDB). Until the first fetch finishes
  // or if the server is offline, we fall back to the static WEEKLY_SHIFTS
  // so the schedule page is never blank.
  const [remoteShifts, setRemoteShifts] = useState(null);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [shiftsError, setShiftsError] = useState(null);

  const refreshShifts = useCallback(async () => {
    setShiftsLoading(true);
    setShiftsError(null);
    try {
      const res = await fetch('/api/shifts');
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setRemoteShifts(data.shifts || []);
    } catch (err) {
      setShiftsError(err.message);
      setRemoteShifts(null);
    } finally {
      setShiftsLoading(false);
    }
  }, []);

  useEffect(() => { refreshShifts(); }, [refreshShifts]);

  async function uploadShiftsCsv(file) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/shifts/upload', { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    await refreshShifts();
    return data;
  }

  // Group flat shift list by day-of-week, falling back to the seed when empty.
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
