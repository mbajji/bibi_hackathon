require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ── Call-out detection ────────────────────────────────────────────────────────

const CALL_OUT_KEYWORDS = [
  'sick', "can't make it", 'cant make it', 'not coming', 'not going to be able',
  'emergency', 'late', 'cover my shift', 'swap', 'urgent care', 'hospital',
  'fever', 'throwing up', 'cant come', "can't come", 'unable to make',
  'not able to come', 'wont be in', "won't be in",
];

function detectCallOut(text) {
  const lower = text.toLowerCase();
  const matched = CALL_OUT_KEYWORDS.filter(k => lower.includes(k));
  return { isCallOut: matched.length > 0, keywords: matched };
}

// ── In-memory message log ─────────────────────────────────────────────────────

const messages = [];
let msgIdCounter = Date.now();

function nextId() { return ++msgIdCounter; }

function now() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ── Core message processing ───────────────────────────────────────────────────

function processMessage({ sender, username, text, time, telegramChatId }) {
  const initials = sender.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const { isCallOut, keywords } = detectCallOut(text);

  const msg = {
    id: nextId(),
    sender,
    username,
    initials,
    time: time || now(),
    text,
    isCallOut,
    isBot: false,
  };

  messages.push(msg);
  io.emit('new_message', msg);

  if (isCallOut) {
    const botMsg = {
      id: nextId(),
      sender: 'ShiftSaver Bot',
      username: '@shiftsaverbot',
      initials: '🤖',
      time: msg.time,
      text: `🚨 Call-out detected from ${sender}. Keywords: "${keywords.join('", "')}" — Creating recovery case for manager review...`,
      isCallOut: false,
      isBot: true,
    };
    messages.push(botMsg);
    io.emit('new_message', botMsg);

    io.emit('call_out_detected', {
      sender,
      username,
      text,
      keywords,
      time: msg.time,
    });

    // Echo the bot alert back to the Telegram group if we have a chat ID
    if (bot && telegramChatId) {
      bot.sendMessage(telegramChatId, botMsg.text).catch(() => {});
    }
  }
}

// ── Telegram bot ──────────────────────────────────────────────────────────────

let bot = null;

if (BOT_TOKEN) {
  const TelegramBot = require('node-telegram-bot-api');
  bot = new TelegramBot(BOT_TOKEN, { polling: true });

  bot.on('message', (msg) => {
    if (!msg.text) return;
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const sender = [firstName, lastName].filter(Boolean).join(' ');
    const username = msg.from.username ? `@${msg.from.username}` : `@${sender.toLowerCase().replace(/\s/g, '')}`;
    const time = new Date(msg.date * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    processMessage({ sender, username, text: msg.text, time, telegramChatId: msg.chat.id });
  });

  bot.on('polling_error', (err) => {
    console.error('[Telegram polling error]', err.message);
  });

  console.log('✅ Telegram bot connected (polling)');
} else {
  console.log('⚠️  No TELEGRAM_BOT_TOKEN — running in mock-only mode');
}

// ── REST endpoints ────────────────────────────────────────────────────────────

// Mock message from the frontend UI
app.post('/mock-message', (req, res) => {
  const { sender, text } = req.body;
  if (!sender || !text) return res.status(400).json({ error: 'sender and text required' });

  const username = `@${sender.toLowerCase().replace(/\s/g, '')}`;
  processMessage({ sender, username, text });
  res.json({ ok: true });
});

// Initial message history for page load
app.get('/messages', (req, res) => {
  res.json(messages);
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true, botConnected: !!bot }));

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`🚀 ShiftSaver backend running on http://localhost:${PORT}`);
});
