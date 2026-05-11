import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, AlertTriangle, Bot, ExternalLink, Wifi, WifiOff } from 'lucide-react';
import { io } from 'socket.io-client';
import { TELEGRAM_MESSAGES } from '../data/mockData';
import { useApp } from '../context/AppContext';

const BACKEND_URL = 'http://localhost:3001';

export default function TelegramMonitor() {
  const { callOuts } = useApp();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(TELEGRAM_MESSAGES);
  const [input, setInput] = useState('');
  const [senderName, setSenderName] = useState('Staff Member');
  const [lastDetection, setLastDetection] = useState(null);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef(null);
  const socketRef = useRef(null);

  // Connect to backend socket for live messages
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // Load existing backend message history on connect
    fetch(`${BACKEND_URL}/messages`)
      .then(r => r.json())
      .then(backendMsgs => {
        if (backendMsgs.length > 0) {
          setMessages(prev => [...prev, ...backendMsgs]);
        }
      })
      .catch(() => {});

    socket.on('new_message', (msg) => {
      setMessages(prev => {
        // Avoid duplicate IDs
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.isBot && msg.text.includes('Call-out detected')) {
        const senderMatch = msg.text.match(/from (.+?)\./);
        const sender = senderMatch ? senderMatch[1] : 'someone';
        const kwMatch = msg.text.match(/Keywords: "(.+?)"/);
        const keywords = kwMatch ? kwMatch[1].split('", "') : [];
        setLastDetection({ sender, keywords });
      }
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput('');

    try {
      await fetch(`${BACKEND_URL}/mock-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: senderName, text }),
      });
      // Message will come back via socket
    } catch {
      // Backend not running — fall back to local-only simulation
      const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const initials = senderName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: senderName,
        username: `@${senderName.toLowerCase().replace(/\s/g, '')}`,
        initials,
        time: now,
        text,
        isCallOut: false,
        isBot: false,
      }]);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Telegram Monitor</h1>
          <p className="text-sm text-gray-500 mt-0.5">Staff group chat · Bot detects call-outs automatically</p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border ${connected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
          {connected
            ? <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Bot Active</>
            : <><WifiOff size={13} /> Mock Mode</>
          }
        </div>
      </div>

      {/* Detection alert */}
      {lastDetection && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Call-out detected — new case created on dashboard</p>
            <p className="text-sm text-orange-700 mt-0.5">
              Keywords: <span className="font-mono bg-orange-100 px-1 rounded">{lastDetection.keywords.join(', ')}</span>
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-1.5 text-xs text-orange-600 font-medium underline hover:text-orange-700"
            >
              View on dashboard →
            </button>
          </div>
        </div>
      )}

      {/* Chat window */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ height: '460px' }}>
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-blue-500">
          <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center text-white text-sm font-bold">GF</div>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">The Golden Fork — Staff 🍴</p>
            <p className="text-blue-100 text-xs">12 members · ShiftSaver Bot active</p>
          </div>
          {connected
            ? <Wifi size={14} className="text-blue-200" />
            : <WifiOff size={14} className="text-blue-300" />
          }
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {messages.map(msg => (
            <ChatMessage key={msg.id} msg={msg} callOuts={callOuts} navigate={navigate} currentSender={senderName} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-100 p-3 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-gray-500">Sending as:</label>
            <input
              type="text"
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="Your name"
            />
            <span className="text-xs text-gray-400">try: "I'm sick, can't make my shift"</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Type a message..."
            />
            <button
              onClick={handleSend}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg p-2 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Bot info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
        <Bot size={18} className="text-slate-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-700">How the Bot Works</p>
          <p className="text-sm text-slate-500 mt-0.5">
            ShiftSaver Bot reads every message in the staff group. When it detects call-out language it automatically creates a recovery case on the manager dashboard — but contacts nobody until the manager approves.
            {!connected && <span className="text-orange-600"> Start the backend server to connect to a real Telegram group.</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ msg, callOuts, navigate, currentSender }) {
  const isMe = msg.sender === currentSender && !msg.isBot;

  if (msg.isBot) {
    return (
      <div className="flex justify-center">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 max-w-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Bot size={13} className="text-yellow-600" />
            <span className="text-xs font-semibold text-yellow-700">ShiftSaver Bot</span>
            <span className="text-xs text-yellow-500">{msg.time}</span>
          </div>
          <p className="text-sm text-yellow-800">{msg.text}</p>
          {msg.callOutId && (
            <button
              onClick={() => navigate(`/callout/${msg.callOutId}`)}
              className="mt-2 flex items-center gap-1 text-xs text-orange-600 font-medium hover:text-orange-700"
            >
              View Recovery Plan <ExternalLink size={10} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${msg.isCallOut ? 'bg-red-200 text-red-700' : 'bg-slate-200 text-slate-700'}`}>
        {typeof msg.initials === 'string' && msg.initials.length <= 2 ? msg.initials : '👤'}
      </div>
      <div className={`max-w-xs ${isMe ? 'items-end' : ''}`}>
        <p className={`text-xs text-gray-400 mb-0.5 ${isMe ? 'text-right' : ''}`}>
          {msg.sender} · {msg.time}
        </p>
        <div className={`rounded-2xl px-3 py-2 ${msg.isCallOut
          ? 'bg-red-100 border border-red-200'
          : isMe
          ? 'bg-blue-500 text-white'
          : 'bg-white border border-gray-200'
        }`}>
          <p className={`text-sm ${isMe ? 'text-white' : 'text-gray-800'}`}>{msg.text}</p>
          {msg.isCallOut && (
            <div className="mt-1.5 flex items-center gap-1">
              <AlertTriangle size={11} className="text-red-500" />
              <span className="text-xs text-red-600 font-medium">Call-out detected</span>
            </div>
          )}
        </div>
        {msg.isCallOut && msg.callOutId && (
          <button
            onClick={() => navigate(`/callout/${msg.callOutId}`)}
            className="mt-1 flex items-center gap-1 text-xs text-orange-600 font-medium hover:text-orange-700"
          >
            View case <ExternalLink size={10} />
          </button>
        )}
      </div>
    </div>
  );
}
