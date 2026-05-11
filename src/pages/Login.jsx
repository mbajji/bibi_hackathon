import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabaseConfigured } from '../lib/supabase';

export default function Login() {
  const { session, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  if (session) return <Navigate to={from} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        navigate(from, { replace: true });
      } else {
        const { session: s } = await signUp(email, password);
        if (s) {
          navigate(from, { replace: true });
        } else {
          setInfo('Check your email to confirm your account, then sign in.');
          setMode('signin');
        }
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-orange-400 text-2xl">⚡</span>
          <span className="text-slate-900 font-bold text-xl tracking-tight">ShiftSaver AI</span>
        </div>

        <div className="flex gap-2 mb-6 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(null); setInfo(null); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); setInfo(null); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Sign up
          </button>
        </div>

        {!supabaseConfigured && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
            Supabase not configured. Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY to bibi_hackathon/.env, then restart npm start.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
              {error}
            </div>
          )}
          {info && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2">
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !supabaseConfigured}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-medium py-2 rounded-md transition-colors"
          >
            {submitting ? '...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
