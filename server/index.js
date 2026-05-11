require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3001/api/discord/oauth/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3002';

// ── Supabase (service role — bypasses RLS) ────────────────────────────────────

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

if (!supabase) console.warn('⚠️  Supabase not configured — discord_links will not persist');

// ── Call-out detection (keyword filter) ───────────────────────────────────────

const CALL_OUT_KEYWORDS = [
  'sick', "can't make it", 'cant make it', 'not coming', 'not going to be able',
  'emergency', 'cover my shift', 'swap', 'urgent care', 'hospital',
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
function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ── Core message processing ───────────────────────────────────────────────────

function processMessage({ sender, username, avatar, text, time, discordChannel }) {
  const initials = sender.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const { isCallOut, keywords } = detectCallOut(text);

  const msg = {
    id: nextId(), sender, username, initials,
    avatar: avatar || null,
    time: time || nowTime(),
    text, isCallOut, isBot: false,
  };

  messages.push(msg);
  io.emit('new_message', msg);

  if (isCallOut) {
    const alertText = `🚨 Call-out detected from **${sender}**. Keywords: "${keywords.join('", "')}" — Creating recovery case for manager review...`;
    const botMsg = {
      id: nextId(), sender: 'ShiftSaver', username: 'shiftsaver',
      initials: '⚡', avatar: null, time: msg.time,
      text: alertText, isCallOut: false, isBot: true,
    };
    messages.push(botMsg);
    io.emit('new_message', botMsg);
    io.emit('call_out_detected', { sender, username, text, keywords, time: msg.time });
    if (discordChannel) discordChannel.send(alertText).catch(() => {});
  }
}

// ── Discord client ────────────────────────────────────────────────────────────

let discordClient = null;

if (BOT_TOKEN && CLIENT_ID) {
  discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  discordClient.once('clientReady', () => {
    console.log(`✅ Discord bot logged in as ${discordClient.user.tag}`);
  });

  discordClient.on('guildCreate', (guild) => {
    console.log(`Joined new guild: ${guild.name} (${guild.id})`);
  });

  // Route messages via DB lookup instead of in-memory map
  discordClient.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    if (!msg.guild) return;
    if (!supabase) return;

    const { data: link } = await supabase
      .from('discord_links')
      .select('workspace_id')
      .eq('guild_id', msg.guild.id)
      .eq('channel_id', msg.channel.id)
      .eq('active', true)
      .maybeSingle();

    if (!link) return;

    const sender = msg.member?.displayName || msg.author.displayName || msg.author.username;
    const username = msg.author.username;
    const avatar = msg.author.displayAvatarURL({ size: 32 });
    const time = new Date(msg.createdTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    processMessage({ sender, username, avatar, text: msg.content, time, discordChannel: msg.channel });
  });

  discordClient.on('error', (err) => console.error('[Discord error]', err.message));
  discordClient.login(BOT_TOKEN).catch(err => console.error('Discord login failed:', err.message));
} else {
  console.log('⚠️  No DISCORD_BOT_TOKEN/CLIENT_ID — running without Discord bot');
}

// ── OAuth state store (temp, in-memory) ───────────────────────────────────────
// Maps state → { workspaceId, guilds }

const oauthStates = new Map();

function makeState() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function guildTextChannels(guildId) {
  if (!discordClient) return null;
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) return null;
  return guild.channels.cache
    .filter(c => c.type === ChannelType.GuildText)
    .map(c => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function botInGuild(guildId) {
  return !!discordClient?.guilds.cache.get(guildId);
}

// ── Workspace endpoints ───────────────────────────────────────────────────────

// Get or create a workspace for a user
app.post('/api/workspace/ensure', async (req, res) => {
  const { userId, name } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  // Check for existing workspace
  const { data: existing } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return res.json({ workspace: existing });

  // Create new
  const { data, error } = await supabase
    .from('workspaces')
    .insert({ owner_user_id: userId, name: name || 'My Restaurant' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ workspace: data });
});

// ── Discord link endpoints ────────────────────────────────────────────────────

// Get active link for a workspace
app.get('/api/discord/link/status', async (req, res) => {
  const { workspaceId } = req.query;
  if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
  if (!supabase) return res.json({ link: null });

  const { data } = await supabase
    .from('discord_links')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('active', true)
    .maybeSingle();

  res.json({ link: data || null });
});

// Create a link
app.post('/api/discord/link', async (req, res) => {
  const { workspaceId, guildId, guildName, channelId, channelName, linkMethod } = req.body;
  if (!workspaceId || !guildId || !channelId) {
    return res.status(400).json({ error: 'workspaceId, guildId, channelId required' });
  }
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  // Check if guild is already actively linked to a different workspace
  const { data: existing } = await supabase
    .from('discord_links')
    .select('workspace_id')
    .eq('guild_id', guildId)
    .eq('active', true)
    .maybeSingle();

  if (existing && existing.workspace_id !== workspaceId) {
    return res.status(409).json({ error: 'This Discord server is already linked to another workspace.' });
  }

  // Deactivate any previous link for this workspace
  await supabase.from('discord_links').update({ active: false }).eq('workspace_id', workspaceId);

  // Insert new link
  const { data, error } = await supabase.from('discord_links').insert({
    workspace_id: workspaceId,
    guild_id: guildId,
    guild_name: guildName,
    channel_id: channelId,
    channel_name: channelName,
    link_method: linkMethod || 'manual_guild_id',
    active: true,
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ link: data });
});

// Deactivate a link
app.delete('/api/discord/link', async (req, res) => {
  const { workspaceId } = req.body;
  if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  await supabase.from('discord_links').update({ active: false }).eq('workspace_id', workspaceId);
  res.json({ ok: true });
});

// ── Discord server/channel lookup ─────────────────────────────────────────────

// List channels in a guild (bot must be installed)
app.get('/api/discord/channels/:guildId', (req, res) => {
  const channels = guildTextChannels(req.params.guildId);
  if (channels === null) {
    return res.status(404).json({ error: 'Bot is not installed in this server, or bot is not connected.' });
  }
  res.json({ channels });
});

// Validate a manually entered guild ID
app.post('/api/discord/check-guild', (req, res) => {
  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });

  if (!botInGuild(guildId)) {
    return res.status(404).json({ error: 'Bot is not installed in this server. Add the bot first.' });
  }

  const guild = discordClient.guilds.cache.get(guildId);
  const channels = guildTextChannels(guildId);
  res.json({ valid: true, guildName: guild.name, channels });
});

// Bot install URL (Option 2)
app.get('/api/discord/install-url', (req, res) => {
  if (!CLIENT_ID) return res.status(503).json({ error: 'CLIENT_ID not configured' });
  const perms = '68608'; // Read Messages + Send Messages + Read Message History
  const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${perms}&scope=bot%20applications.commands`;
  res.json({ url });
});

// ── Discord OAuth (Option 1) ──────────────────────────────────────────────────

// Step 1: Generate OAuth URL
app.get('/api/discord/oauth/url', (req, res) => {
  const { workspaceId } = req.query;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(503).json({ error: 'Discord OAuth not configured (CLIENT_ID/CLIENT_SECRET missing)' });
  }

  const state = makeState();
  oauthStates.set(state, { workspaceId, guilds: null });
  setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000); // expire in 10 min

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });

  res.json({ url: `https://discord.com/oauth2/authorize?${params}` });
});

// Step 2: OAuth callback — exchange code, fetch guilds, redirect to frontend
app.get('/api/discord/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${FRONTEND_URL}/connect-discord?error=${encodeURIComponent(error)}`);
  }

  if (!oauthStates.has(state)) {
    return res.redirect(`${FRONTEND_URL}/connect-discord?error=invalid_state`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token returned');

    // Fetch user's guilds
    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const allGuilds = await guildsRes.json();

    // Filter: bot must be installed in the guild
    const eligibleGuilds = allGuilds
      .filter(g => botInGuild(g.id))
      .map(g => ({ id: g.id, name: g.name, icon: g.icon }));

    const stored = oauthStates.get(state);
    stored.guilds = eligibleGuilds;

    res.redirect(`${FRONTEND_URL}/connect-discord?oauthState=${state}`);
  } catch (err) {
    console.error('[OAuth callback error]', err.message);
    res.redirect(`${FRONTEND_URL}/connect-discord?error=${encodeURIComponent(err.message)}`);
  }
});

// Step 3: Frontend fetches guild list using the state token
app.get('/api/discord/oauth/guilds', (req, res) => {
  const { state } = req.query;
  const stored = oauthStates.get(state);
  if (!stored) return res.status(404).json({ error: 'OAuth state expired or invalid' });
  res.json({ guilds: stored.guilds || [], workspaceId: stored.workspaceId });
});

// ── Existing endpoints ────────────────────────────────────────────────────────

app.post('/mock-message', (req, res) => {
  const { sender, text } = req.body;
  if (!sender || !text) return res.status(400).json({ error: 'sender and text required' });
  processMessage({ sender, username: sender.toLowerCase().replace(/\s/g, ''), text });
  res.json({ ok: true });
});

app.post('/send-messages', async (req, res) => {
  const { messages: drafts, workspaceId } = req.body;
  if (!Array.isArray(drafts)) return res.status(400).json({ error: 'messages array required' });
  if (!discordClient) return res.json({ ok: true, sent: 0, note: 'no bot connected' });

  let channelId = null;
  if (workspaceId && supabase) {
    const { data: link } = await supabase
      .from('discord_links')
      .select('channel_id')
      .eq('workspace_id', workspaceId)
      .eq('active', true)
      .maybeSingle();
    channelId = link?.channel_id;
  }

  if (!channelId) return res.json({ ok: true, sent: 0, note: 'no active link for workspace' });

  let sent = 0;
  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (channel) {
      for (const draft of drafts) {
        await channel.send(draft.message);
        sent++;
      }
    }
  } catch (err) {
    console.error('Failed to send messages:', err.message);
  }

  res.json({ ok: true, sent });
});

app.get('/messages', (req, res) => res.json(messages));

app.get('/health', (req, res) => res.json({
  ok: true,
  botConnected: !!discordClient?.isReady(),
  supabaseConfigured: !!supabase,
}));

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`🚀 ShiftSaver backend running on http://localhost:${PORT}`);
});
