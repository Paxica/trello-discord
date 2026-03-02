# Trello → Discord Sync (Vercel-ready)

This app connects Trello and Discord in one shared channel:
- Sends a Discord message when cards are created/updated in Trello.
- Shows due dates in multiple formats (Discord absolute, relative, and CET display).
- Runs **daily** reminders for cards due soon or overdue.
- Optionally @mentions mapped Discord users from Trello assignees.

## Architecture

- `api/trello-webhook.js`: Trello webhook receiver for card events.
- `api/cron-reminders.js`: daily reminder endpoint (called by Vercel Cron).
- `lib/discord.js`: sends bot messages to one Discord channel.
- `lib/trello.js`: Trello API access, date formatting, Discord mention mapping, and embed helpers.
- `scripts/register-webhook.js`: helper script to register a Trello webhook.

## 1) Prerequisites (free)

1. **Trello API key + token** from Trello developer portal.
2. **Discord bot token** + channel ID.
3. **Vercel project** linked to this repo.

## 2) Environment variables

Copy `.env.example` to `.env` for local testing and set the same vars in Vercel Project Settings.

- `TRELLO_API_KEY`
- `TRELLO_API_TOKEN`
- `TRELLO_BOARD_ID`
- `TRELLO_WEBHOOK_SECRET` (optional but recommended)
- `DISCORD_BOT_TOKEN`
- `DISCORD_CHANNEL_ID` (same channel for updates + reminders)
- `DISCORD_USER_MAP` (optional JSON map from Trello member ID or username to Discord user ID)
- `REMIND_WITHIN_HOURS` (default: `24`, used by daily run)
- `APP_TIMEZONE` (default: `Europe/Paris`, i.e. CET/CEST handling)

Example `DISCORD_USER_MAP`:

```json
{"65f123abc456def":"123456789012345678","trello_username":"123456789012345678"}
```

## 3) Deploy to Vercel

Deploy this repo to Vercel. Your webhook URL will be:

`https://<your-vercel-domain>/api/trello-webhook`

## 4) Register Trello webhook

After deploy, run:

```bash
TRELLO_API_KEY=... \
TRELLO_API_TOKEN=... \
TRELLO_BOARD_ID=... \
TRELLO_CALLBACK_URL=https://<your-vercel-domain>/api/trello-webhook \
node scripts/register-webhook.js
```

## 5) Discord bot permissions

The bot must have permission to post in your chosen channel:
- `View Channel`
- `Send Messages`
- `Embed Links`

## Reminder cadence

`vercel.json` schedules `/api/cron-reminders` once daily at `08:00 UTC` (09:00 CET in winter).

If you want a different local delivery time, update the cron expression.
