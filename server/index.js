require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');

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

// ── Supabase ──────────────────────────────────────────────────────────────────

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

if (!supabase) console.warn('⚠️  Supabase not configured — discord_links will not persist');

function bearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function requireSupabaseUser(req, res) {
  if (!supabase) {
    res.status(503).json({ error: 'Supabase not configured' });
    return null;
  }
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' });
    return null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'Invalid authorization token' });
    return null;
  }
  return data.user;
}

async function requireWorkspaceOwner(req, res, workspaceId) {
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId required' });
    return null;
  }
  const user = await requireSupabaseUser(req, res);
  if (!user) return null;

  const { data, error } = await supabase
    .from('workspaces')
    .select('id, owner_user_id')
    .eq('id', workspaceId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return null;
  }
  if (!data || data.owner_user_id !== user.id) {
    res.status(403).json({ error: 'Workspace access denied' });
    return null;
  }
  return { user, workspace: data };
}

// ── Groq ──────────────────────────────────────────────────────────────────────

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
if (groq) console.log('🤖 Groq LLM detection enabled');

// ── Normalization + cache ─────────────────────────────────────────────────────

function normalize(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

const classCache = new Map();
function cacheGet(key) { return classCache.get(key); }
function cacheSet(key, value) {
  if (classCache.size >= 500) classCache.delete(classCache.keys().next().value);
  classCache.set(key, value);
}

// ── Local rules ───────────────────────────────────────────────────────────────

const LOCAL_CALL_OUT = [
  "i can't come in", "i cant come in", "i cannot make it", "can someone cover",
  "i need coverage", "i'm not coming", "im not coming", "i won't be in", "i wont be in",
  "calling out", "not able to come", "unable to make it", "can't make it", "cant make it",
  "cover my shift", "need someone to cover", "sick", "fever", "throwing up",
  "hospital", "urgent care", "emergency", "not gonna make it", "not going to make it",
];

const LOCAL_LATE = [
  "i'm late", "im late", "running late", "i'll be late", "ill be late",
  "going to be late", "gonna be late", "mins late", "min late", "minutes late",
  "few minutes late", "i'm running late", "im running late",
];

const LOCAL_REJOIN = [
  "never mind", "nevermind", "nvm", "nvmd", "actually i can", "i can make it",
  "i can come in", "found a ride", "no longer need", "disregard", "cancel that",
  "ignore that", "i'm good now", "im good now", "scratch that", "false alarm",
];

const LOCAL_NOT_RELEVANT = [
  "lol", "lmao", "lmfao", "haha", "hahaha", "thanks", "thank you", "ty",
  "ok", "okay", "got it", "sounds good", "will do", "on my way", "omw",
  "clocked in", "here", "just arrived",
];

function localClassify(text) {
  const lower = text.toLowerCase().trim();
  if (LOCAL_NOT_RELEVANT.some(k => lower === k || lower === k + '!'))
    return { category: 'NOT_RELEVANT', confidence: 0.95, source: 'local' };
  if (LOCAL_REJOIN.some(k => lower.includes(k)))
    return { category: 'REJOIN', confidence: 0.9, source: 'local' };
  if (LOCAL_LATE.some(k => lower.includes(k)))
    return { category: 'LATE', confidence: 0.9, source: 'local' };
  if (LOCAL_CALL_OUT.some(k => lower.includes(k)))
    return { category: 'CALL_OUT', confidence: 0.9, source: 'local' };
  return null;
}

// ── Third-party detection ─────────────────────────────────────────────────────

function isThirdParty(text) {
  return /\b(he|she|they)\s+(is|are|can'?t|cannot|won'?t|will not|isn'?t|aren'?t)\b/i.test(text);
}

// ── Flip-flop protection ──────────────────────────────────────────────────────

const flipFlops = new Map();
const SHIFT_WINDOW_MS = 8 * 60 * 60 * 1000;

function checkFlipFlop(username, category) {
  if (!['CALL_OUT', 'REJOIN'].includes(category)) return false;
  const now = Date.now();
  const e = flipFlops.get(username) || { count: 0, lastCategory: null, resetAt: now + SHIFT_WINDOW_MS };
  if (now > e.resetAt) {
    flipFlops.set(username, { count: 1, lastCategory: category, resetAt: now + SHIFT_WINDOW_MS });
    return false;
  }
  if (e.lastCategory && e.lastCategory !== category) {
    e.count++;
    e.lastCategory = category;
    flipFlops.set(username, e);
    return e.count >= 2;
  }
  e.lastCategory = category;
  flipFlops.set(username, e);
  return false;
}

// ── Truncation ────────────────────────────────────────────────────────────────

function truncate(text, max = 500) {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

// ── LLM classification ────────────────────────────────────────────────────────

const SEED_EXAMPLES = [
  '"yo im cooked tonight" → CALL_OUT',
  '"my car chose violence" → UNCLEAR',
  '"nvm i can make it" → REJOIN',
  '"im gonna be 20 late" → LATE',
  '"work was insane yesterday" → NOT_RELEVANT',
];

async function llmClassify(msgs) {
  if (!groq) return null;

  const lines = msgs.map((m, i) => `[${i + 1}] ${truncate(m)}`);
  if (lines.join('').length > 2000) {
    return { category: 'UNCLEAR', report_type: 'UNKNOWN', confidence: 0, needs_manager_review: true, source: 'limit_exceeded' };
  }

  const prompt = `Classify workplace attendance intent. Return JSON only.

Categories: CALL_OUT, REJOIN, LATE, UNCLEAR, NOT_RELEVANT.
Report types: SELF, THIRD_PARTY.

Rules:
- Employees can only report their own attendance.
- Third-party reports (about someone else) need manager review.
- Classify the latest status if multiple messages provided.
- Set needs_manager_review=true for UNCLEAR, THIRD_PARTY, or confidence<0.7.

Examples:
${SEED_EXAMPLES.join('\n')}

Messages from same sender:
${lines.join('\n')}

Return: {"category":"...","report_type":"SELF","minutes_late":null,"confidence":0.0,"needs_manager_review":false}`;

  try {
    const res = await groq.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 80,
      temperature: 0,
    });
    const result = JSON.parse(res.choices[0].message.content);
    return { ...result, source: 'llm' };
  } catch (err) {
    console.error('[Groq] Classification failed:', err.message);
    return null;
  }
}

// ── In-memory message log ─────────────────────────────────────────────────────

const messages = [];
let msgIdCounter = Date.now();
function nextId() { return ++msgIdCounter; }
function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ── Classification result handler ─────────────────────────────────────────────

async function handleClassificationResult(result, { sender, username, avatar, time, text, discordChannel }) {
  const { category, needs_manager_review, minutes_late, flip_flop } = result;

  if (category === 'NOT_RELEVANT') return;

  const msg = {
    id: nextId(), sender, username,
    initials: sender.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
    avatar: avatar || null,
    time: time || nowTime(),
    text, isCallOut: category === 'CALL_OUT', isBot: false,
  };
  messages.push(msg);
  io.emit('new_message', msg);

  let alertText = '';
  let emitEvent = null;

  if (needs_manager_review || flip_flop) {
    const reason = flip_flop ? 'repeated status changes'
      : result.report_type === 'THIRD_PARTY' ? 'third-party report'
      : 'unclear message';
    alertText = `⚠️ Attendance message from **${sender}** flagged for manager review (${reason}).`;
    emitEvent = 'manager_review_needed';
  } else if (category === 'CALL_OUT') {
    alertText = `🚨 Call-out detected from **${sender}** — Creating recovery case for manager review...`;
    emitEvent = 'call_out_detected';
  } else if (category === 'LATE') {
    alertText = `⏰ **${sender}** will be late${minutes_late ? ` (~${minutes_late} min)` : ''} — noted.`;
    emitEvent = 'employee_late';
  } else if (category === 'REJOIN') {
    alertText = `✅ **${sender}** is back on track — no longer needs coverage.`;
    emitEvent = 'employee_rejoined';
  }

  if (!alertText) return;

  const botMsg = {
    id: nextId(), sender: 'ShiftSaver', username: 'shiftsaver',
    initials: '⚡', avatar: null, time: msg.time,
    text: alertText, isCallOut: false, isBot: true,
  };
  messages.push(botMsg);
  io.emit('new_message', botMsg);

  if (emitEvent) {
    io.emit(emitEvent, { sender, username, text, time: msg.time, category, minutes_late: minutes_late || null });
  }

  if (discordChannel) discordChannel.send(alertText).catch(() => {});
}

// ── Debounce batching ─────────────────────────────────────────────────────────

const userBatches = new Map();
const DEBOUNCE_MS = 7000;
const MAX_BATCH = 5;

function queueMessage(username, text, senderInfo, discordChannel) {
  // Fast path: local rules fire immediately without debounce
  const quickResult = localClassify(text);
  if (quickResult && quickResult.category !== 'UNCLEAR') {
    if (['CALL_OUT', 'REJOIN'].includes(quickResult.category) && checkFlipFlop(username, quickResult.category)) {
      quickResult.needs_manager_review = true;
      quickResult.flip_flop = true;
    }
    handleClassificationResult(quickResult, {
      sender: senderInfo.sender, username, avatar: senderInfo.avatar,
      time: senderInfo.time, text, discordChannel,
    });
    return;
  }

  // Slow path: debounce and send to LLM
  const batch = userBatches.get(username) || { msgs: [], senderInfo, discordChannel };
  if (batch.timer) clearTimeout(batch.timer);

  batch.msgs.push(text);
  if (batch.msgs.length > MAX_BATCH) batch.msgs = batch.msgs.slice(-MAX_BATCH);

  batch.timer = setTimeout(async () => {
    userBatches.delete(username);
    const { msgs, senderInfo: si, discordChannel: dc } = batch;
    const latest = msgs[msgs.length - 1];

    // 1. Third-party check
    let result = null;
    if (isThirdParty(latest)) {
      result = { category: 'CALL_OUT', report_type: 'THIRD_PARTY', confidence: 0.8, needs_manager_review: true, source: 'local' };
    }

    // 2. Cache check
    const cacheKey = username + ':' + msgs.map(normalize).join('|');
    if (!result) result = cacheGet(cacheKey);

    // 3. LLM
    if (!result) {
      result = await llmClassify(msgs) || { category: 'UNCLEAR', needs_manager_review: true, source: 'fallback' };
      cacheSet(cacheKey, result);
    }

    // 4. Flip-flop check
    if (['CALL_OUT', 'REJOIN'].includes(result.category) && checkFlipFlop(username, result.category)) {
      result = { ...result, needs_manager_review: true, flip_flop: true };
    }

    await handleClassificationResult(result, {
      sender: si.sender, username, avatar: si.avatar,
      time: si.time, text: msgs.join(' '), discordChannel: dc,
    });
  }, DEBOUNCE_MS);

  userBatches.set(username, batch);
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

  discordClient.on('messageCreate', async (msg) => {
    // Step 1 — ignore invalid messages
    if (msg.author.bot) return;
    if (!msg.guild) return;
    if (!msg.content?.trim()) return;
    if (/^\p{Emoji}+$/u.test(msg.content.trim())) return;
    if (!supabase) return;

    // Step 2 — verify channel is monitored
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

    // Step 3 — check if this is a coverage response from someone we asked
    const coverageKey = `${msg.channel.id}:${username}`;
    if (pendingCoverage.has(coverageKey)) {
      const response = detectCoverageResponse(msg.content);
      if (response) {
        const { callOutId } = pendingCoverage.get(coverageKey);
        pendingCoverage.delete(coverageKey);
        io.emit('coverage_response', { callOutId, accepted: response === 'yes', respondent: sender });
        const ack = response === 'yes'
          ? `✅ ${sender} confirmed they can cover the shift!`
          : `❌ ${sender} can't cover. Manager should contact the next candidate.`;
        msg.channel.send(ack).catch(() => {});
        return;
      }
    }

    // Step 4 — queue with debounce for call-out detection
    queueMessage(username, msg.content, { sender, avatar, time }, msg.channel);
  });

  discordClient.on('error', (err) => console.error('[Discord error]', err.message));
  discordClient.login(BOT_TOKEN).catch(err => console.error('Discord login failed:', err.message));
} else {
  console.log('⚠️  No DISCORD_BOT_TOKEN/CLIENT_ID — running without Discord bot');
}

// ── OAuth state store ─────────────────────────────────────────────────────────

const oauthStates = new Map();
function makeState() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Pending coverage responses ────────────────────────────────────────────────
// Maps `channelId:discordUsername` → { callOutId }

const pendingCoverage = new Map();

const YES_WORDS = ['yes', 'yeah', 'yep', 'sure', 'absolutely', 'i can', 'can cover', "i'll cover", 'ill cover', 'coming in', 'on my way', 'okay', 'ok', 'will do', 'count me in', 'ill be there'];
const NO_WORDS = ["can't", 'cannot', 'not able', 'unable', "won't be", 'nope', 'sorry no', 'i cant', 'busy'];

function detectCoverageResponse(text) {
  const lower = text.toLowerCase();
  if (NO_WORDS.some(w => lower.includes(w))) return 'no';
  if (YES_WORDS.some(w => lower.includes(w))) return 'yes';
  return null;
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

app.post('/api/workspace/ensure', async (req, res) => {
  const user = await requireSupabaseUser(req, res);
  if (!user) return;
  const name = String(req.body?.name || 'My Restaurant').trim().slice(0, 120) || 'My Restaurant';

  const { data: existing } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return res.json({ workspace: existing });

  const { data, error } = await supabase
    .from('workspaces')
    .insert({ owner_user_id: user.id, name })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ workspace: data });
});

// ── Discord link endpoints ────────────────────────────────────────────────────

app.get('/api/discord/link/status', async (req, res) => {
  const { workspaceId } = req.query;
  const access = await requireWorkspaceOwner(req, res, workspaceId);
  if (!access) return;

  const { data } = await supabase
    .from('discord_links')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('active', true)
    .maybeSingle();

  res.json({ link: data || null });
});

app.post('/api/discord/link', async (req, res) => {
  const { workspaceId, guildId, guildName, channelId, channelName, linkMethod } = req.body;
  if (!workspaceId || !guildId || !channelId) {
    return res.status(400).json({ error: 'workspaceId, guildId, channelId required' });
  }
  const access = await requireWorkspaceOwner(req, res, workspaceId);
  if (!access) return;

  const { data: existing } = await supabase
    .from('discord_links')
    .select('workspace_id')
    .eq('guild_id', guildId)
    .eq('active', true)
    .maybeSingle();

  if (existing && existing.workspace_id !== workspaceId) {
    return res.status(409).json({ error: 'This Discord server is already linked to another workspace.' });
  }

  await supabase.from('discord_links').update({ active: false }).eq('workspace_id', workspaceId);

  const { data, error } = await supabase.from('discord_links').insert({
    workspace_id: workspaceId,
    guild_id: String(guildId).trim(),
    guild_name: String(guildName || '').trim().slice(0, 120),
    channel_id: String(channelId).trim(),
    channel_name: String(channelName || '').trim().slice(0, 120),
    link_method: linkMethod || 'manual_guild_id',
    active: true,
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ link: data });
});

app.delete('/api/discord/link', async (req, res) => {
  const { workspaceId } = req.body;
  const access = await requireWorkspaceOwner(req, res, workspaceId);
  if (!access) return;

  await supabase.from('discord_links').update({ active: false }).eq('workspace_id', workspaceId);
  res.json({ ok: true });
});

// ── Discord server/channel lookup ─────────────────────────────────────────────

app.get('/api/discord/channels/:guildId', (req, res) => {
  const channels = guildTextChannels(req.params.guildId);
  if (channels === null) {
    return res.status(404).json({ error: 'Bot is not installed in this server, or bot is not connected.' });
  }
  res.json({ channels });
});

app.get('/api/discord/members/:guildId', async (req, res) => {
  if (!BOT_TOKEN) return res.status(503).json({ error: 'Bot token not configured' });
  const { guildId } = req.params;
  const headers = { Authorization: `Bot ${BOT_TOKEN}` };

  try {
    // Fetch roles and members in parallel
    const [rolesRes, membersRes] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, { headers }),
    ]);

    if (!membersRes.ok) {
      if (membersRes.status === 403) {
        return res.status(403).json({
          error: 'Server Members Intent not enabled',
          hint: 'Go to discord.com/developers/applications → your app → Bot → enable "Server Members Intent"',
        });
      }
      const err = await membersRes.json().catch(() => ({}));
      return res.status(membersRes.status).json({ error: err.message || 'Discord API error' });
    }

    // Build role ID → name map
    const rolesRaw = rolesRes.ok ? await rolesRes.json() : [];
    const roleMap = Object.fromEntries(rolesRaw.map(r => [r.id, r.name]));

    // Manager role heuristic: role named "Manager", "Admin", or "Owner" (case-insensitive), or has admin permission bit
    const ADMIN_PERMISSION = 0x8n;
    const managerRoleIds = new Set(
      rolesRaw
        .filter(r => /manager|admin|owner|moderator/i.test(r.name) || (BigInt(r.permissions) & ADMIN_PERMISSION) !== 0n)
        .map(r => r.id)
    );

    const raw = await membersRes.json();
    const list = raw
      .filter(m => !m.user.bot)
      .map(m => {
        const roleNames = (m.roles || []).map(id => roleMap[id]).filter(Boolean);
        const isManager = (m.roles || []).some(id => managerRoleIds.has(id));
        return {
          id: m.user.id,
          username: m.user.username,
          displayName: m.nick || m.user.global_name || m.user.username,
          avatar: m.avatar
            ? `https://cdn.discordapp.com/guilds/${guildId}/users/${m.user.id}/avatars/${m.avatar}.png?size=64`
            : m.user.avatar
              ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=64`
              : null,
          roles: roleNames,
          isManager,
        };
      })
      .sort((a, b) => (b.isManager ? 1 : 0) - (a.isManager ? 1 : 0) || a.displayName.localeCompare(b.displayName));

    res.json({ members: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

app.get('/api/discord/install-url', (req, res) => {
  if (!CLIENT_ID) return res.status(503).json({ error: 'CLIENT_ID not configured' });
  const perms = '68608';
  const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${perms}&scope=bot%20applications.commands`;
  res.json({ url });
});

// ── Discord OAuth ─────────────────────────────────────────────────────────────

app.get('/api/discord/oauth/url', (req, res) => {
  const { workspaceId } = req.query;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(503).json({ error: 'Discord OAuth not configured (CLIENT_ID/CLIENT_SECRET missing)' });
  }
  requireWorkspaceOwner(req, res, workspaceId).then((access) => {
    if (!access) return;
    const state = makeState();
    oauthStates.set(state, { workspaceId, userId: access.user.id, guilds: null });
    setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000);
    const params = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: REDIRECT_URI,
      response_type: 'code', scope: 'identify guilds', state,
    });
    res.json({ url: `https://discord.com/oauth2/authorize?${params}` });
  });
});

app.get('/api/discord/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/connect-discord?error=${encodeURIComponent(error)}`);
  if (!oauthStates.has(state)) return res.redirect(`${FRONTEND_URL}/connect-discord?error=invalid_state`);

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token returned');

    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const allGuilds = await guildsRes.json();
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

app.get('/api/discord/oauth/guilds', (req, res) => {
  const { state } = req.query;
  const stored = oauthStates.get(state);
  if (!stored) return res.status(404).json({ error: 'OAuth state expired or invalid' });
  res.json({ guilds: stored.guilds || [], workspaceId: stored.workspaceId });
});

// ── Existing endpoints ────────────────────────────────────────────────────────

app.post('/send-messages', async (req, res) => {
  const { messages: drafts, workspaceId, callOutId, askedUsername } = req.body;
  if (!Array.isArray(drafts)) return res.status(400).json({ error: 'messages array required' });
  const access = await requireWorkspaceOwner(req, res, workspaceId);
  if (!access) return;
  if (!discordClient) return res.json({ ok: true, sent: 0, note: 'no bot connected' });

  let channelId = null;
  const { data: link } = await supabase
    .from('discord_links').select('channel_id')
    .eq('workspace_id', workspaceId).eq('active', true).maybeSingle();
  channelId = link?.channel_id;

  if (!channelId) return res.json({ ok: true, sent: 0, note: 'no active link for workspace' });

  let sent = 0;
  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (channel) {
      for (const draft of drafts) {
        const message = String(draft?.message || '').trim().slice(0, 1800);
        if (!message) continue;
        await channel.send(message);
        sent++;
      }
    }
  } catch (err) {
    console.error('Failed to send messages:', err.message);
  }

  // Track who we asked so we can detect their yes/no reply
  if (callOutId && askedUsername && channelId) {
    const key = `${channelId}:${askedUsername}`;
    pendingCoverage.set(key, { callOutId });
    setTimeout(() => pendingCoverage.delete(key), 4 * 60 * 60 * 1000); // expire after 4h
  }

  res.json({ ok: true, sent });
});

app.get('/messages', (req, res) => res.json(messages));

app.get('/health', (req, res) => res.json({
  ok: true,
  botConnected: !!discordClient?.isReady(),
  supabaseConfigured: !!supabase,
  groqEnabled: !!groq,
}));

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`🚀 ShiftSaver backend running on http://localhost:${PORT}`);
});
