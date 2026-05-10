import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { WEEKLY_SHIFTS, WEEK_DAYS, WEEK_DATES, TODAY_DAY_INDEX } from '../data/mockData';
import { useApp } from '../context/AppContext';
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
  const { callOuts } = useApp();
  const navigate = useNavigate();

  // For Saturday, apply live call-out statuses from AppContext
  const shifts = useMemo(() => {
    const dayKey = WEEK_DAYS[selectedDay];
    const raw = WEEKLY_SHIFTS[dayKey] || [];
    if (dayKey !== 'Sat') return raw;
    return raw.map(shift => {
      const co = callOuts.find(c => c.employeeId === shift.employeeId);
      if (!co) return shift;
      if (co.status === 'covered') return { ...shift, status: 'scheduled' };
      if (['pending-approval', 'outreach-sent'].includes(co.status)) return { ...shift, status: 'called-out', callOutId: co.id };
      return shift;
    });
  }, [selectedDay, callOuts]);

  function prevDay() { setSelectedDay(d => Math.max(0, d - 1)); }
  function nextDay() { setSelectedDay(d => Math.min(6, d + 1)); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Staff Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {WEEK_DATES[selectedDay]}, 2025
            {selectedDay === TODAY_DAY_INDEX && <span className="ml-2 text-orange-500 font-medium">· Today</span>}
          </p>
        </div>
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
            const dayShifts = WEEKLY_SHIFTS[day] || [];
            const hasCallOut = day === 'Sat' && callOuts.some(c => !['covered', 'unresolved'].includes(c.status));
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
        : <WeekView selectedDay={selectedDay} onSelectDay={i => { setSelectedDay(i); setView('day'); }} callOuts={callOuts} />
      }
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

function WeekView({ selectedDay, onSelectDay, callOuts }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-gray-100">
        {WEEK_DAYS.map((day, i) => {
          const isToday = i === TODAY_DAY_INDEX;
          const isSelected = i === selectedDay;
          const dayShifts = WEEKLY_SHIFTS[day] || [];
          const hasCallOut = day === 'Sat' && callOuts.some(c => !['covered', 'unresolved'].includes(c.status));

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
                  const isCO = day === 'Sat' && callOuts.some(c => c.employeeId === s.employeeId && !['covered', 'unresolved'].includes(c.status));
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
