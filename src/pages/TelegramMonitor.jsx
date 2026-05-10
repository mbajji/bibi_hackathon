import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, AlertTriangle, Bot, ExternalLink } from 'lucide-react';
import { TELEGRAM_MESSAGES } from '../data/mockData';
import { useApp } from '../context/AppContext';

const CALL_OUT_KEYWORDS = ['sick', "can't make it", 'cant make it', 'not coming', 'not going to be able', 'emergency', 'late', 'cover my shift', 'swap', 'urgent care', 'hospital', 'fever', 'throwing up', 'cant come', "can't come", 'unable to make', 'not able to come'];

function detectCallOut(text) {
  const lower = text.toLowerCase();
  const matched = CALL_OUT_KEYWORDS.filter(k => lower.includes(k));
  return { isCallOut: matched.length > 0, keywords: matched };
}

export default function TelegramMonitor() {
  const { callOuts } = useApp();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(TELEGRAM_MESSAGES);
  const [input, setInput] = useState('');
  const [senderName, setSenderName] = useState('Staff Member');
  const [lastDetection, setLastDetection] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;

    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const initials = senderName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const userMsg = {
      id: Date.now(),
      sender: senderName,
      username: `@${senderName.toLowerCase().replace(/\s/g, '')}`,
      initials,
      time,
      text,
      isCallOut: false,
      isBot: false,
      isSimulated: true,
    };

    const { isCallOut, keywords } = detectCallOut(text);

    if (isCallOut) {
      userMsg.isCallOut = true;
      const botMsg = {
        id: Date.now() + 1,
        sender: 'ShiftSaver Bot',
        username: '@shiftsaverbot',
        initials: '🤖',
        time,
        text: `🚨 Possible call-out detected from ${senderName}. Keywords: "${keywords.join('", "')}" — Creating draft case for manager review...`,
        isCallOut: false,
        isBot: true,
        isSimulated: true,
      };
      setMessages(prev => [...prev, userMsg, botMsg]);
      setLastDetection({ sender: senderName, keywords, text });
    } else {
      setMessages(prev => [...prev, userMsg]);
      setLastDetection(null);
    }

    setInput('');
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
        <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-1.5 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Bot Active
        </div>
      </div>

      {/* Detection alert */}
      {lastDetection && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Call-out detected in your simulation!</p>
            <p className="text-sm text-orange-700 mt-0.5">
              Keywords found: <span className="font-mono bg-orange-100 px-1 rounded">{lastDetection.keywords.join(', ')}</span>
            </p>
            <p className="text-xs text-orange-600 mt-1">In a live setup, this would create a draft recovery case for manager review.</p>
          </div>
        </div>
      )}

      {/* Chat window */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ height: '460px' }}>
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-blue-500">
          <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center text-white text-sm font-bold">GF</div>
          <div>
            <p className="text-white font-semibold text-sm">The Golden Fork — Staff 🍴</p>
            <p className="text-blue-100 text-xs">12 members · ShiftSaver Bot active</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {messages.map(msg => (
            <ChatMessage key={msg.id} msg={msg} callOuts={callOuts} navigate={navigate} />
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
            <span className="text-xs text-gray-400">(try: "I'm sick, can't make my shift")</span>
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
            ShiftSaver Bot reads every message in the staff group. When it detects call-out language (sickness, emergencies, lateness, coverage requests), it creates a draft recovery case on the manager dashboard — but doesn't contact anyone until the manager approves.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Detection keywords: {CALL_OUT_KEYWORDS.slice(0, 6).join(', ')}, and more...
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ msg, callOuts, navigate }) {
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
    <div className={`flex items-end gap-2 ${msg.isSimulated ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${msg.isCallOut ? 'bg-red-200 text-red-700' : 'bg-slate-200 text-slate-700'}`}>
        {typeof msg.initials === 'string' && msg.initials.length <= 2 ? msg.initials : '👤'}
      </div>
      <div className={`max-w-xs ${msg.isSimulated ? 'items-end' : ''}`}>
        <p className={`text-xs text-gray-400 mb-0.5 ${msg.isSimulated ? 'text-right' : ''}`}>
          {msg.sender} · {msg.time}
        </p>
        <div className={`rounded-2xl px-3 py-2 ${msg.isCallOut
          ? 'bg-red-100 border border-red-200'
          : msg.isSimulated
          ? 'bg-blue-500 text-white'
          : 'bg-white border border-gray-200'
        }`}>
          <p className={`text-sm ${msg.isSimulated ? 'text-white' : 'text-gray-800'}`}>{msg.text}</p>
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
