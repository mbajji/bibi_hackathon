require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Groq = require('groq-sdk');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

// ── Call-out detection ────────────────────────────────────────────────────────

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const CALL_OUT_KEYWORDS = [
  'sick', "can't make it", 'cant make it', 'not coming', 'not going to be able',
  'emergency', 'cover my shift', 'swap', 'urgent care', 'hospital',
  'fever', 'throwing up', 'cant come', "can't come", 'unable to make',
  'not able to come', 'wont be in', "won't be in",
];

async function detectCallOut(text) {
  if (groq) {
    try {
      const response = await groq.chat.completions.create({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are a call-out detection assistant for a restaurant shift management system. Determine if the message is an employee calling out of work (sick, emergency, unable to come in, etc.). Respond with JSON only: {"isCallOut": boolean, "keywords": string[]}',
          },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 100,
        temperature: 0,
      });
      const result = JSON.parse(response.choices[0].message.content);
      return { isCallOut: !!result.isCallOut, keywords: result.keywords || [] };
    } catch (err) {
      console.error('[Groq] Detection failed, falling back to keywords:', err.message);
    }
  }
  const lower = text.toLowerCase();
  const matched = CALL_OUT_KEYWORDS.filter(k => lower.includes(k));
  return { isCallOut: matched.length > 0, keywords: matched };
}

// ── In-memory state ───────────────────────────────────────────────────────────

const messages = [];
let msgIdCounter = Date.now();
function nextId() { return ++msgIdCounter; }
function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// guildId → channelId (set via /setup)
const watchedChannels = new Map();

// ── Core message processing ───────────────────────────────────────────────────

async function processMessage({ sender, username, avatar, text, time, discordChannel }) {
  const initials = sender.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const { isCallOut, keywords } = await detectCallOut(text);

  const msg = {
    id: nextId(),
    sender,
    username,
    initials,
    avatar: avatar || null,
    time: time || nowTime(),
    text,
    isCallOut,
    isBot: false,
  };

  messages.push(msg);
  io.emit('new_message', msg);

  if (isCallOut) {
    const alertText = `🚨 Call-out detected from **${sender}**. Keywords: "${keywords.join('", "')}" — Creating recovery case for manager review...`;

    const botMsg = {
      id: nextId(),
      sender: 'ShiftSaver',
      username: 'shiftsaver',
      initials: '⚡',
      avatar: null,
      time: msg.time,
      text: alertText,
      isCallOut: false,
      isBot: true,
    };

    messages.push(botMsg);
    io.emit('new_message', botMsg);
    io.emit('call_out_detected', { sender, username, text, keywords, time: msg.time });

    if (discordChannel) {
      discordChannel.send(alertText).catch(() => {});
    }
  }
}

// ── /setup slash command ──────────────────────────────────────────────────────

const setupCommand = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Set this channel as the ShiftSaver call-out monitoring channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .toJSON();

async function registerCommandsForGuild(guildId) {
  if (!BOT_TOKEN || !CLIENT_ID) return;
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: [setupCommand] });
    console.log(`✅ Registered /setup for guild ${guildId}`);
  } catch (err) {
    console.error(`Failed to register commands for guild ${guildId}:`, err.message);
  }
}

// ── Discord client ────────────────────────────────────────────────────────────

let discordClient = null;

if (BOT_TOKEN && CLIENT_ID) {
  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  discordClient.once('ready', async () => {
    console.log(`✅ Discord bot logged in as ${discordClient.user.tag}`);
    for (const guild of discordClient.guilds.cache.values()) {
      await registerCommandsForGuild(guild.id);
    }
  });

  discordClient.on('guildCreate', async (guild) => {
    console.log(`Joined new guild: ${guild.name}`);
    await registerCommandsForGuild(guild.id);
  });

  discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'setup') return;
    watchedChannels.set(interaction.guildId, interaction.channelId);
    console.log(`Guild ${interaction.guildId} → monitoring channel ${interaction.channelId}`);
    await interaction.reply({
      content: '⚡ **ShiftSaver is now monitoring this channel.** Any call-out messages will automatically create a recovery case on the manager dashboard.',
      ephemeral: false,
    });
  });

  discordClient.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    if (!watchedChannels.has(msg.guildId)) return;
    if (watchedChannels.get(msg.guildId) !== msg.channelId) return;

    const sender = msg.member?.displayName || msg.author.displayName || msg.author.username;
    const username = msg.author.username;
    const avatar = msg.author.displayAvatarURL({ size: 32 });
    const time = new Date(msg.createdTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    await processMessage({ sender, username, avatar, text: msg.content, time, discordChannel: msg.channel });
  });

  discordClient.on('error', (err) => console.error('[Discord error]', err.message));

  discordClient.login(BOT_TOKEN).catch(err => {
    console.error('Failed to login to Discord:', err.message);
  });
} else {
  console.log('⚠️  No DISCORD_BOT_TOKEN/CLIENT_ID — running without Discord bot');
}

// ── REST endpoints ────────────────────────────────────────────────────────────

app.post('/send-messages', async (req, res) => {
  const { messages: drafts } = req.body;
  if (!Array.isArray(drafts)) return res.status(400).json({ error: 'messages array required' });

  if (!discordClient) return res.json({ ok: true, sent: 0, note: 'no bot connected' });

  let sent = 0;
  for (const [guildId, channelId] of watchedChannels.entries()) {
    try {
      const channel = await discordClient.channels.fetch(channelId);
      if (!channel) continue;
      for (const draft of drafts) {
        await channel.send(draft.message);
        sent++;
      }
    } catch (err) {
      console.error(`Failed to send to guild ${guildId}:`, err.message);
    }
  }

  res.json({ ok: true, sent });
});

app.get('/messages', (req, res) => res.json(messages));

app.get('/health', (req, res) => res.json({
  ok: true,
  botConnected: !!discordClient?.isReady(),
  watchedChannels: watchedChannels.size,
  groqEnabled: !!groq,
}));

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`🚀 ShiftSaver backend running on http://localhost:${PORT}`);
  if (groq) console.log('🤖 Groq LLM detection enabled');
});
