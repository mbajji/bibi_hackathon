import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Zap, ExternalLink, Hash } from 'lucide-react';
import { io } from 'socket.io-client';
import { DISCORD_MESSAGES } from '../data/mockData';
import { useApp } from '../context/AppContext';

const BACKEND_URL = 'http://localhost:3001';

const ROLE_COLORS = {
  'Emma Wilson': '#14b8a6',
  'Tina Kowalski': '#ef4444',
  'Jake Thompson': '#f97316',
  'Carlos Rivera': '#3b82f6',
  'Priya Patel': '#8b5cf6',
  'Maria Santos': '#ec4899',
  'Sophie Chen': '#06b6d4',
  'Marcus Bell': '#84cc16',
  'Darius Okafor': '#f59e0b',
  'Luis Mendez': '#94a3b8',
};

function avatarColor(sender) {
  return ROLE_COLORS[sender] || '#6366f1';
}

export default function DiscordMonitor() {
  const { callOuts } = useApp();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(DISCORD_MESSAGES);
  const [lastDetection, setLastDetection] = useState(null);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    fetch(`${BACKEND_URL}/messages`)
      .then(r => r.json())
      .then(backendMsgs => {
        if (backendMsgs.length > 0) {
          setMessages(prev => [...prev, ...backendMsgs.filter(m => !prev.some(p => p.id === m.id))]);
        }
      })
      .catch(() => {});

    socket.on('new_message', (msg) => {
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      if (msg.isBot && msg.text.includes('Call-out detected')) {
        const senderMatch = msg.text.match(/from \*?\*?(.+?)\*?\*?\./);
        const sender = senderMatch ? senderMatch[1] : 'someone';
        setLastDetection({ sender });
      }
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Discord Monitor</h1>
          <p className="text-sm text-gray-500 mt-0.5">Staff server · ShiftSaver detects call-outs automatically</p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border ${connected ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
          {connected
            ? <><span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> Bot Active</>
            : <><span className="w-2 h-2 rounded-full bg-gray-400" /> Offline</>
          }
        </div>
      </div>

      {lastDetection && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Call-out detected — new case created on dashboard</p>
            <p className="text-sm text-orange-700 mt-0.5">From <span className="font-medium">{lastDetection.sender}</span></p>
            <button onClick={() => navigate('/')} className="mt-1.5 text-xs text-orange-600 font-medium underline hover:text-orange-700">
              View on dashboard →
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden flex flex-col" style={{ height: '500px', backgroundColor: '#313338' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-black/20" style={{ backgroundColor: '#2b2d31' }}>
          <Hash size={18} className="text-gray-400" />
          <span className="text-white font-semibold text-sm">staff-general</span>
          <div className="w-px h-4 bg-gray-600 mx-1" />
          <span className="text-gray-400 text-xs">The Golden Fork — Staff Server</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-500'}`} />
            <span className="text-xs text-gray-400">{connected ? 'ShiftSaver online' : 'offline'}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5" style={{ backgroundColor: '#313338' }}>
          {messages.map((msg, i) => {
            const prevMsg = messages[i - 1];
            const grouped = prevMsg && prevMsg.sender === msg.sender && !msg.isBot && !prevMsg.isBot;
            return (
              <DiscordMessage
                key={msg.id}
                msg={msg}
                grouped={grouped}
                callOuts={callOuts}
                navigate={navigate}
                color={avatarColor(msg.sender)}
              />
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
        <Zap size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-indigo-800">How it works</p>
          <p className="text-sm text-indigo-600 mt-0.5">
            Add ShiftSaver to your Discord server, then run <span className="font-mono bg-indigo-100 px-1 rounded">/setup</span> in the staff channel. The bot reads every message and auto-creates a recovery case when it detects a call-out — no action needed until the manager reviews it.
            {!connected && <span className="text-orange-600"> Start the backend to connect a real Discord server.</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function DiscordMessage({ msg, grouped, callOuts, navigate, color }) {
  if (msg.isBot) {
    return (
      <div className="flex items-start gap-3 py-1 px-2 rounded hover:bg-white/5 group mt-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 font-bold" style={{ backgroundColor: '#5865f2' }}>
          ⚡
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold" style={{ color: '#5865f2' }}>ShiftSaver</span>
            <span className="text-xs px-1 rounded text-white" style={{ backgroundColor: '#5865f2', fontSize: '10px' }}>APP</span>
            <span className="text-xs" style={{ color: '#87898c' }}>{msg.time}</span>
          </div>
          <div className="rounded px-3 py-2.5 text-sm" style={{ backgroundColor: '#2b2d31', borderLeft: '4px solid #5865f2', color: '#dbdee1' }}>
            {msg.text}
          </div>
          {msg.callOutId && (
            <button onClick={() => navigate(`/callout/${msg.callOutId}`)} className="mt-1 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
              View Recovery Plan <ExternalLink size={10} />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (grouped) {
    return (
      <div className="flex items-start gap-3 py-0.5 px-2 rounded hover:bg-white/5 group pl-11">
        <p className="text-sm flex-1" style={{ color: msg.isCallOut ? '#fca5a5' : '#dcddde' }}>
          {msg.text}
          {msg.isCallOut && <span className="ml-2 text-xs text-red-400 font-medium">⚠ call-out detected</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 py-1 px-2 rounded hover:bg-white/5 group mt-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: color }}>
        {msg.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-sm font-semibold" style={{ color }}>{msg.sender}</span>
          <span className="text-xs" style={{ color: '#87898c' }}>{msg.time}</span>
        </div>
        <p className="text-sm" style={{ color: msg.isCallOut ? '#fca5a5' : '#dcddde' }}>
          {msg.text}
          {msg.isCallOut && <span className="ml-2 text-xs text-red-400 font-medium">⚠ call-out detected</span>}
        </p>
        {msg.isCallOut && msg.callOutId && (
          <button onClick={() => navigate(`/callout/${msg.callOutId}`)} className="mt-1 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
            View case <ExternalLink size={10} />
          </button>
        )}
      </div>
    </div>
  );
}
