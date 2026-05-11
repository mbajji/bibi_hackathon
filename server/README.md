# ShiftSaver Server

Express + Socket.IO backend that:

- Optionally connects to a Telegram bot and listens for staff messages.
- Detects call-out keywords (sick, can't make it, emergency, …) in incoming messages.
- Broadcasts `new_message` and `call_out_detected` events over Socket.IO to the React frontend.

Messages are kept **in memory** for the lifetime of the process — there is no database. Shift data is stored in Supabase and accessed directly from the frontend.

## Setup

```
npm install
cp .env.example .env   # optional: only needed if you want a real Telegram bot
npm start
```

You should see:
```
🚀 ShiftSaver backend running on http://localhost:3001
```

If `TELEGRAM_BOT_TOKEN` is set in `.env`, the bot connects via polling. Without it, the server still runs in mock-only mode and you can POST fake messages from the UI or curl.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/health`        | Liveness check — returns `{ ok, botConnected }` |
| `GET`  | `/messages`      | All messages logged this session |
| `POST` | `/mock-message`  | Inject a fake chat message — body: `{ sender, text }` |

## Socket.IO events emitted

- `new_message` — every chat message (user or bot reply).
- `call_out_detected` — fired when a message matches a call-out keyword. The frontend uses this to open a recovery case.

## Telegram bot setup (optional)

1. Talk to `@BotFather` on Telegram, run `/newbot`, follow the prompts, copy the token.
2. Put the token in `.env`:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
   ```
3. Restart `npm start`. You should see `✅ Telegram bot connected (polling)`.
4. Add the bot to a group chat and send messages. Call-outs will appear in the React app.
