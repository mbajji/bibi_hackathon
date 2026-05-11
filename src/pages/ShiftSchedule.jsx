import { useState, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, Upload, Loader2, CheckCircle2, RefreshCw, Users } from 'lucide-react';
import { WEEK_DAYS, WEEK_DATES, TODAY_DAY_INDEX, CURRENT_YEAR, TODAY_DAY_KEY, EMPLOYEES } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useNavigate } from 'react-router-dom';

const TIMELINE_START = 9;   // 9 AM
const TIMELINE_END = 23;    // 11 PM
const TOTAL_HOURS = TIMELINE_END - TIMELINE_START;

function toPercent(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return Math.max(0, Math.min(100, ((h - TIMELINE_START) * 60 + m) / (TOTAL_HOURS * 60) * 100));
}

function hourLabel(h) {
  if (h === 12) return '12p';
  if (h > 12) return `${h - 12}p`;
  return `${h}a`;
}

const ROLE_COLORS = {
  Server: { bar: '#8b5cf6', light: '#ede9fe', text: '#5b21b6' },
  'Line Cook': { bar: '#f97316', light: '#ffedd5', text: '#9a3412' },
  'Sous Chef': { bar: '#ef4444', light: '#fee2e2', text: '#991b1b' },
  Bartender: { bar: '#3b82f6', light: '#dbeafe', text: '#1e40af' },
  Host: { bar: '#14b8a6', light: '#ccfbf1', text: '#0f766e' },
  Busser: { bar: '#94a3b8', light: '#f1f5f9', text: '#475569' },
};

const HOUR_MARKS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => TIMELINE_START + i);

export default function StaffSchedule() {
  const [view, setView] = useState('day');
  const [selectedDay, setSelectedDay] = useState(TODAY_DAY_INDEX);
  const { callOuts, shiftsByDay, hasRemoteShifts, shiftsLoading, discordStaff, syncDiscordMembers } = useApp();
  const { discordLink } = useWorkspace();
  const navigate = useNavigate();

  // For today, apply live call-out statuses from AppContext
  const shifts = useMemo(() => {
    const dayKey = WEEK_DAYS[selectedDay];
    const raw = shiftsByDay[dayKey] || [];
    if (dayKey !== TODAY_DAY_KEY) return raw;
    return raw.map(shift => {
      const co = callOuts.find(c => c.employeeId === shift.employeeId);
      if (!co) return shift;
      if (co.status === 'covered') return { ...shift, status: 'scheduled' };
      if (['pending-approval', 'outreach-sent'].includes(co.status)) return { ...shift, status: 'called-out', callOutId: co.id };
      return shift;
    });
  }, [selectedDay, callOuts, shiftsByDay]);

  function prevDay() { setSelectedDay(d => Math.max(0, d - 1)); }
  function nextDay() { setSelectedDay(d => Math.min(6, d + 1)); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Staff Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {WEEK_DATES[selectedDay]}, {CURRENT_YEAR}
            {selectedDay === TODAY_DAY_INDEX && <span className="ml-2 text-orange-500 font-medium">· Today</span>}
            {!hasRemoteShifts && !shiftsLoading && (
              <span className="ml-2 text-gray-400">· showing sample data</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CsvUploadButton />
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setView('day')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'day' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Day
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Day navigation bar */}
      <div className="bg-white rounded-xl border border-gray-200 flex items-stretch overflow-hidden">
        <button
          onClick={prevDay}
          disabled={selectedDay === 0}
          className="px-3 flex items-center text-gray-400 hover:text-gray-600 disabled:opacity-30 border-r border-gray-100 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex flex-1 divide-x divide-gray-100">
          {WEEK_DAYS.map((day, i) => {
            const isToday = i === TODAY_DAY_INDEX;
            const isSelected = i === selectedDay;
            const dayShifts = shiftsByDay[day] || [];
            const hasCallOut = day === TODAY_DAY_KEY && callOuts.some(c => !['covered', 'unresolved'].includes(c.status));
            return (
              <button
                key={day}
                onClick={() => { setSelectedDay(i); setView('day'); }}
                className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 transition-colors relative ${
                  isSelected ? 'bg-orange-500' : isToday ? 'bg-orange-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className={`text-xs font-semibold ${isSelected ? 'text-white' : isToday ? 'text-orange-600' : 'text-gray-500'}`}>
                  {day}
                </span>
                <span className={`text-xs ${isSelected ? 'text-orange-200' : 'text-gray-400'}`}>
                  {WEEK_DATES[i].split(' ')[1]}
                </span>
                <span className={`text-xs ${isSelected ? 'text-orange-100' : 'text-gray-400'}`}>
                  {dayShifts.length} staff
                </span>
                {hasCallOut && !isSelected && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-400" />
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={nextDay}
          disabled={selectedDay === 6}
          className="px-3 flex items-center text-gray-400 hover:text-gray-600 disabled:opacity-30 border-l border-gray-100 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {view === 'day'
        ? <DayTimeline shifts={shifts} navigate={navigate} />
        : <WeekView selectedDay={selectedDay} onSelectDay={i => { setSelectedDay(i); setView('day'); }} callOuts={callOuts} shiftsByDay={shiftsByDay} />
      }

      <StaffList
        discordStaff={discordStaff}
        guildId={discordLink?.guild_id}
        onSync={syncDiscordMembers}
      />
    </div>
  );
}

function CsvUploadButton() {
  const { uploadShiftsCsv } = useApp();
  const inputRef = useRef(null);
  const [state, setState] = useState({ status: 'idle', message: '' });

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-uploading the same file
    if (!file) return;

    setState({ status: 'uploading', message: '' });
    try {
      const result = await uploadShiftsCsv(file);
      setState({ status: 'success', message: `Imported ${result.inserted} shifts` });
      setTimeout(() => setState({ status: 'idle', message: '' }), 3000);
    } catch (err) {
      setState({ status: 'error', message: err.message });
    }
  }

  const busy = state.status === 'uploading';
  return (
    <div className="flex items-center gap-2">
      {state.status === 'success' && (
        <span className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 size={13} /> {state.message}
        </span>
      )}
      {state.status === 'error' && (
        <span className="text-xs text-red-600 max-w-[260px] truncate" title={state.message}>
          {state.message}
        </span>
      )}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {busy ? 'Uploading…' : 'Import CSV'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

function DayTimeline({ shifts, navigate }) {
  const calledOut = shifts.filter(s => s.status === 'called-out');

  return (
    <div className="space-y-3">
      {calledOut.length > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
          <span className="text-red-700">
            {calledOut.map(s => `${s.employeeName} (${s.role})`).join(', ')} called out today
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Hour header */}
        <div className="flex border-b border-gray-100">
          <div className="flex-shrink-0 border-r border-gray-100" style={{ width: 152 }} />
          <div className="flex-1 relative h-8">
            {HOUR_MARKS.filter((_, i) => i % 2 === 0).map(h => (
              <span
                key={h}
                className="absolute top-1/2 -translate-y-1/2 text-xs text-gray-400 -translate-x-1/2"
                style={{ left: `${(h - TIMELINE_START) / TOTAL_HOURS * 100}%` }}
              >
                {hourLabel(h)}
              </span>
            ))}
            {/* vertical guide lines */}
            {HOUR_MARKS.map((h, i) => (
              <div
                key={h}
                className="absolute top-0 bottom-0 w-px bg-gray-100"
                style={{ left: `${i / TOTAL_HOURS * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* Employee rows */}
        <div className="divide-y divide-gray-50">
          {shifts.map(shift => {
            const colors = ROLE_COLORS[shift.role] || ROLE_COLORS.Busser;
            const isCalledOut = shift.status === 'called-out';
            const leftPct = toPercent(shift.start);
            const widthPct = toPercent(shift.end) - leftPct;

            return (
              <div
                key={shift.employeeId}
                className={`flex items-center ${isCalledOut ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}
              >
                {/* Name column */}
                <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 border-r border-gray-100" style={{ width: 152 }}>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: isCalledOut ? '#fee2e2' : colors.light, color: isCalledOut ? '#b91c1c' : colors.text }}
                  >
                    {shift.employeeName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${isCalledOut ? 'text-red-700 line-through' : 'text-gray-800'}`}>
                      {shift.employeeName.split(' ')[0]}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{shift.role}</p>
                  </div>
                </div>

                {/* Timeline area */}
                <div className="flex-1 relative" style={{ height: 48 }}>
                  {/* Guide lines */}
                  {HOUR_MARKS.map((h, i) => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 w-px bg-gray-50"
                      style={{ left: `${i / TOTAL_HOURS * 100}%` }}
                    />
                  ))}

                  {/* Shift bar */}
                  {isCalledOut ? (
                    <div
                      className="absolute top-3 bottom-3 rounded-md border-2 border-dashed border-red-300 bg-red-100 flex items-center px-2 overflow-hidden"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    >
                      <span className="text-xs text-red-500 font-medium whitespace-nowrap">Called out</span>
                    </div>
                  ) : (
                    <div
                      className="absolute top-3 bottom-3 rounded-md flex items-center px-2 overflow-hidden cursor-pointer"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: colors.bar }}
                      title={`${shift.start} – ${shift.end}`}
                    >
                      <span className="text-white text-xs font-medium whitespace-nowrap opacity-90">
                        {shift.start.replace(':00', '')}–{shift.end.replace(':00', '')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {Object.entries(ROLE_COLORS).map(([role, colors]) => (
          <div key={role} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.bar }} />
            <span className="text-xs text-gray-500">{role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffList({ discordStaff, guildId, onSync }) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [synced, setSynced] = useState(false);

  async function handleSync() {
    if (!guildId) return;
    setSyncing(true);
    setSyncError(null);
    const result = await onSync(guildId);
    setSyncing(false);
    if (result?.error) {
      setSyncError(result);
    } else {
      setSynced(true);
      setTimeout(() => setSynced(false), 3000);
    }
  }

  const showDiscord = discordStaff.length > 0;
  const members = showDiscord ? discordStaff : EMPLOYEES;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-500" />
          <h2 className="font-semibold text-gray-800">Staff List</h2>
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{members.length}</span>
          {showDiscord && (
            <span className="text-xs text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">from Discord</span>
          )}
        </div>
        {guildId && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {syncing
              ? <Loader2 size={13} className="animate-spin" />
              : synced
                ? <CheckCircle2 size={13} className="text-green-500" />
                : <RefreshCw size={13} />}
            {syncing ? 'Syncing…' : synced ? 'Synced!' : 'Sync from Discord'}
          </button>
        )}
      </div>

      {syncError && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-800">
            {syncError.error === 'Server Members Intent not enabled'
              ? 'Server Members Intent not enabled'
              : 'Sync failed'}
          </p>
          {syncError.hint
            ? <p className="text-amber-700 mt-0.5">{syncError.hint}</p>
            : <p className="text-amber-700 mt-0.5">{syncError.error}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {members.map(member => {
          const isDiscord = showDiscord;
          const name = isDiscord ? member.displayName : member.name;
          const sub = isDiscord
            ? (member.roles[0] || `@${member.username}`)
            : member.role;
          const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
          const colors = ROLE_COLORS[member.role] || ROLE_COLORS.Busser;
          const isManager = isDiscord ? member.isManager : false;

          return (
            <div
              key={member.id || member.username}
              className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors ${
                isManager
                  ? 'border-orange-200 bg-orange-50'
                  : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              {isDiscord && member.avatar
                ? (
                  <div className="relative flex-shrink-0">
                    <img src={member.avatar} alt={name} className="w-8 h-8 rounded-full" />
                    {isManager && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold leading-none">M</span>
                    )}
                  </div>
                ) : (
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: isManager ? '#fed7aa' : (colors?.light || '#f1f5f9'), color: isManager ? '#9a3412' : (colors?.text || '#475569') }}
                    >
                      {initials}
                    </div>
                    {isManager && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold leading-none">M</span>
                    )}
                  </div>
                )
              }
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                <p className={`text-xs truncate ${isManager ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>{sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {!guildId && !showDiscord && (
        <p className="text-xs text-gray-400 mt-3 text-center">
          Connect Discord to sync your actual server members
        </p>
      )}
    </div>
  );
}

function WeekView({ selectedDay, onSelectDay, callOuts, shiftsByDay }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-gray-100">
        {WEEK_DAYS.map((day, i) => {
          const isToday = i === TODAY_DAY_INDEX;
          const isSelected = i === selectedDay;
          const dayShifts = shiftsByDay[day] || [];
          const hasCallOut = day === TODAY_DAY_KEY && callOuts.some(c => !['covered', 'unresolved'].includes(c.status));

          return (
            <button
              key={day}
              onClick={() => onSelectDay(i)}
              className={`p-3 text-left hover:bg-orange-50 transition-colors ${isSelected ? 'bg-orange-50' : ''}`}
              style={{ minHeight: 200 }}
            >
              {/* Day header */}
              <div className={`text-sm font-bold mb-0.5 ${isToday ? 'text-orange-500' : 'text-gray-700'}`}>{day}</div>
              <div className={`text-xs mb-3 ${isToday ? 'text-orange-400' : 'text-gray-400'}`}>
                {WEEK_DATES[i].split(' ')[1]}
                {isToday && ' · Today'}
              </div>

              {/* Staff chips */}
              <div className="space-y-1">
                {dayShifts.map(s => {
                  const colors = ROLE_COLORS[s.role] || ROLE_COLORS.Busser;
                  const isCO = day === TODAY_DAY_KEY && callOuts.some(c => c.employeeId === s.employeeId && !['covered', 'unresolved'].includes(c.status));
                  return (
                    <div key={s.employeeId} className="flex items-center gap-1.5">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: isCO ? '#ef4444' : colors.bar }}
                      >
                        {s.employeeName[0]}
                      </div>
                      <span className={`text-xs truncate ${isCO ? 'text-red-500 line-through' : 'text-gray-600'}`}>
                        {s.employeeName.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {hasCallOut && (
                <div className="mt-2 flex items-center gap-1">
                  <AlertTriangle size={10} className="text-red-400" />
                  <span className="text-xs text-red-400">Call-outs</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
