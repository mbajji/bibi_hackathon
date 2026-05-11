import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Hash, Link, Plus, Server, Unlink, AlertTriangle, ChevronLeft, ExternalLink } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '@clerk/clerk-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export default function ConnectDiscord() {
  const { workspace, discordLink, linkDiscord, unlinkDiscord } = useWorkspace();
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [view, setView] = useState('idle'); // idle | select-guild | select-channel | manual-input | manual-channels
  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [channels, setChannels] = useState([]);
  const [manualGuildId, setManualGuildId] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // Handle OAuth return
  useEffect(() => {
    const oauthState = searchParams.get('oauthState');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      setError(`Discord connection failed: ${oauthError}`);
      return;
    }

    if (oauthState) {
      setLoading(true);
      fetch(`${BACKEND_URL}/api/discord/oauth/guilds?state=${oauthState}`)
        .then(r => r.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setGuilds(data.guilds || []);
          setView('select-guild');
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [searchParams]);

  async function handleOAuthConnect() {
    if (!workspace) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/discord/oauth/url?workspaceId=${workspace.id}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleGetInstallUrl() {
    const res = await fetch(`${BACKEND_URL}/api/discord/install-url`);
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank');
  }

  async function handleSelectGuild(guild) {
    setError(null);
    setLoading(true);
    setSelectedGuild(guild);
    try {
      const res = await fetch(`${BACKEND_URL}/api/discord/channels/${guild.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChannels(data.channels);
      setView('select-channel');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckManualGuild() {
    if (!manualGuildId.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/discord/check-guild`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: manualGuildId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedGuild({ id: manualGuildId.trim(), name: data.guildName });
      setChannels(data.channels);
      setView('manual-channels');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectChannel(channel, method) {
    setError(null);
    setLoading(true);
    try {
      await linkDiscord({
        guildId: selectedGuild.id,
        guildName: selectedGuild.name,
        channelId: channel.id,
        channelName: channel.name,
        linkMethod: method,
      });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlink() {
    setUnlinking(true);
    await unlinkDiscord();
    setUnlinking(false);
    setView('idle');
  }

  // ── Linked state ─────────────────────────────────────────────────────────────

  if (discordLink) {
    return (
      <div className="max-w-lg space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Discord Connection</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your staff server link</p>
        </div>

        <div className="bg-white rounded-xl border border-green-200 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-green-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Connected to {discordLink.guild_name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Hash size={13} className="text-gray-400" />
                <span className="text-sm text-gray-500">{discordLink.channel_name}</span>
                <span className="text-xs text-gray-400 ml-2">via {discordLink.link_method?.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                ShiftSaver is monitoring this channel for call-outs. Messages are routed to your dashboard.
              </p>
            </div>
          </div>
        </div>

        {error && <ErrorBox message={error} />}

        <button
          onClick={handleUnlink}
          disabled={unlinking}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
        >
          <Unlink size={14} />
          {unlinking ? 'Disconnecting...' : 'Disconnect Server'}
        </button>
      </div>
    );
  }

  // ── Channel selection ─────────────────────────────────────────────────────────

  if (view === 'select-channel' || view === 'manual-channels') {
    const method = view === 'select-channel' ? 'oauth_guild_select' : 'manual_guild_id';
    return (
      <div className="max-w-lg space-y-5">
        <BackHeader title="Select Monitored Channel" onBack={() => setView(view === 'select-channel' ? 'select-guild' : 'manual-input')} />
        <div className="bg-white rounded-xl border border-gray-200 p-1">
          <p className="text-xs text-gray-500 px-3 pt-3 pb-2">
            <Server size={12} className="inline mr-1" />{selectedGuild?.name}
          </p>
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => handleSelectChannel(ch, method)}
              disabled={loading}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-indigo-50 text-left transition-colors"
            >
              <Hash size={15} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-800">{ch.name}</span>
            </button>
          ))}
        </div>
        {error && <ErrorBox message={error} />}
      </div>
    );
  }

  // ── Guild selection (after OAuth) ─────────────────────────────────────────────

  if (view === 'select-guild') {
    return (
      <div className="max-w-lg space-y-5">
        <BackHeader title="Select Your Server" onBack={() => setView('idle')} />
        {guilds.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
            No eligible servers found. Make sure ShiftSaver is installed in your server first, then try again or use manual entry.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-1 space-y-0.5">
            {guilds.map(g => (
              <button
                key={g.id}
                onClick={() => handleSelectGuild(g)}
                disabled={loading}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-indigo-50 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                  {g.name[0]}
                </div>
                <span className="text-sm font-medium text-gray-800">{g.name}</span>
              </button>
            ))}
          </div>
        )}
        {error && <ErrorBox message={error} />}
      </div>
    );
  }

  // ── Manual guild ID entry ─────────────────────────────────────────────────────

  if (view === 'manual-input') {
    return (
      <div className="max-w-lg space-y-5">
        <BackHeader title="Enter Server ID Manually" onBack={() => setView('idle')} />
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="text-sm text-gray-600">
            Paste your Discord server's Guild ID. You can find it by right-clicking the server name in Discord (Developer Mode must be enabled in Discord settings).
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Guild ID</label>
            <input
              type="text"
              value={manualGuildId}
              onChange={e => setManualGuildId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCheckManualGuild()}
              placeholder="e.g. 1234567890123456789"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <button
            onClick={handleCheckManualGuild}
            disabled={loading || !manualGuildId.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Checking...' : 'Check Server'}
          </button>
        </div>
        {error && <ErrorBox message={error} />}
      </div>
    );
  }

  // ── Idle: show 3 options ──────────────────────────────────────────────────────

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Connect Discord Server</h1>
        <p className="text-sm text-gray-500 mt-0.5">Link your staff Discord server so ShiftSaver can monitor call-outs</p>
      </div>

      {error && <ErrorBox message={error} />}
      {loading && <p className="text-sm text-gray-500">Redirecting to Discord...</p>}

      <div className="space-y-3">
        {/* Option 1: OAuth */}
        <div className="bg-white rounded-xl border border-indigo-200 p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <Link size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm">Connect with Discord</p>
              <p className="text-xs text-gray-500 mt-0.5">Sign in with Discord to see your servers and select one. Best option if the bot is already installed.</p>
            </div>
          </div>
          <button
            onClick={handleOAuthConnect}
            disabled={loading}
            className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            Connect with Discord
          </button>
        </div>

        {/* Option 2: Install bot */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Plus size={16} className="text-slate-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm">Add Bot to Server</p>
              <p className="text-xs text-gray-500 mt-0.5">Install ShiftSaver into a new Discord server. Use this if your server doesn't have the bot yet.</p>
            </div>
          </div>
          <button
            onClick={handleGetInstallUrl}
            className="mt-4 w-full flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-lg text-sm transition-colors"
          >
            Add Bot to Server <ExternalLink size={12} />
          </button>
        </div>

        {/* Option 3: Manual */}
        <button
          onClick={() => { setView('manual-input'); setError(null); }}
          className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
        >
          Enter Server ID Manually →
        </button>
      </div>
    </div>
  );
}

function BackHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors">
        <ChevronLeft size={20} />
      </button>
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
      <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}
