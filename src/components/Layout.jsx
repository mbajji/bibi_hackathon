import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, MessageSquare, ClipboardList, ChevronRight, LogOut, Link, Unlink } from 'lucide-react';
import { RESTAURANT_NAME } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useWorkspace } from '../context/WorkspaceContext';

function formatHeaderDate(d) {
  const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/schedule', icon: CalendarDays, label: 'Staff Schedule' },
  { to: '/discord', icon: MessageSquare, label: 'Discord Monitor' },
  { to: '/actions', icon: ClipboardList, label: 'Action Queue' },
];

export default function Layout({ children }) {
  const { stats } = useApp();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { discordLink } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';
  const userInitial = (userEmail || user?.firstName || 'M').trim().charAt(0).toUpperCase();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const pageTitle = () => {
    if (location.pathname === '/') return 'Call-Out Dashboard';
    if (location.pathname === '/schedule') return 'Staff Schedule';
    if (location.pathname === '/discord') return 'Discord Monitor';
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

          {/* Discord connection status */}
          <button
            onClick={() => navigate('/connect-discord')}
            className={`mt-3 w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
              discordLink
                ? 'bg-indigo-900/40 text-indigo-300 hover:bg-indigo-900/60'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
            }`}
          >
            {discordLink ? <Link size={12} /> : <Unlink size={12} />}
            <span className="truncate flex-1 text-left">
              {discordLink ? discordLink.guild_name : 'Connect Discord'}
            </span>
            {discordLink && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
            )}
          </button>
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
            {userEmail && (
              <span className="text-sm text-gray-600 hidden sm:inline">{userEmail}</span>
            )}
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-sm font-bold">{userInitial}</div>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: '/login' })}
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
