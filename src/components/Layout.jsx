import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, MessageSquare, ClipboardList, ChevronRight, LogOut } from 'lucide-react';
import { RESTAURANT_NAME } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

function formatHeaderDate(d) {
  const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/schedule', icon: CalendarDays, label: 'Staff Schedule' },
  { to: '/telegram', icon: MessageSquare, label: 'Telegram Monitor' },
  { to: '/actions', icon: ClipboardList, label: 'Action Queue' },
];

export default function Layout({ children }) {
  const { stats } = useApp();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const userInitial = (user?.email || 'M').trim().charAt(0).toUpperCase();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const pageTitle = () => {
    if (location.pathname === '/') return 'Call-Out Dashboard';
    if (location.pathname === '/schedule') return 'Staff Schedule';
    if (location.pathname === '/telegram') return 'Telegram Monitor';
    if (location.pathname === '/actions') return 'Action Queue';
    if (location.pathname.startsWith('/callout/')) return 'Recovery Plan';
    return 'ShiftSaver AI';
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-orange-400 text-xl">⚡</span>
            <span className="text-white font-bold text-lg tracking-tight">ShiftSaver AI</span>
          </div>
          <p className="text-slate-400 text-xs mt-1 truncate">{RESTAURANT_NAME}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-700">
          <div className="bg-slate-800 rounded-lg p-3 space-y-2">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Live Status</p>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Active cases</span>
              <span className="text-white font-semibold">{stats.active}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Pending approval</span>
              <span className="text-orange-400 font-semibold">{stats.pendingApproval}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Outreach sent</span>
              <span className="text-blue-400 font-semibold">{stats.outreachSent}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Covered</span>
              <span className="text-green-400 font-semibold">{stats.covered}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="font-medium text-gray-900">{RESTAURANT_NAME}</span>
            <ChevronRight size={14} />
            <span>{pageTitle()}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{formatHeaderDate(now)}</span>
            {user?.email && (
              <span className="text-sm text-gray-600 hidden sm:inline">{user.email}</span>
            )}
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-sm font-bold">{userInitial}</div>
            <button
              type="button"
              onClick={signOut}
              title="Sign out"
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
