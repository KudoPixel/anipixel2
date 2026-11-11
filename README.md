# AniPixel 2

Anime and manga discovery with a Telegram bot and Telegram Mini App, powered by Cloudflare Workers and AniList GraphQL.

## Stack

- Cloudflare Workers (ES modules)
- Workers Static Assets for the Mini App
- Cloudflare KV for Telegram callback state
- AniList GraphQL API
- Telegram Bot API
- Wrangler

## Features

- Trending, popular, romance, comedy and mystery anime lists
- Search across anime and manga
- Detail pages with metadata, relations, characters, staff, trailer and next-episode countdown
- Telegram `/start` menu, inline lists, pagination, detail cards and Mini App deep links
- Webhook authentication using Telegram's `secret_token`
- Request size limits, API timeouts, safe HTML rendering and structured logs

## Requirements

- Node.js 22+
- Cloudflare account
- Telegram bot token
- Cloudflare KV namespace

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a KV namespace:

   ```sh
   npx wrangler kv namespace create BOT_STATE
   ```

3. Replace `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.jsonc` with the returned namespace ID.

4. Configure local variables:

   ```sh
   cp .dev.vars.example .dev.vars
   ```

   Set `BOT_TOKEN`, `WEB_APP_URL`, and a long random `WEBHOOK_SECRET`. `ADMIN_CHAT_ID` is optional.

5. Run locally:

   ```sh
   npm run dev
   ```

6. Set production Worker secrets:

   ```sh
   npx wrangler secret put BOT_TOKEN
   npx wrangler secret put WEBHOOK_SECRET
   npx wrangler secret put WEB_APP_URL
   npx wrangler secret put ADMIN_CHAT_ID
   ```

   `ADMIN_CHAT_ID` is optional.

7. Deploy:

   ```sh
   npm run deploy
   ```

8. Register the Telegram webhook. Replace the placeholders with your bot token, deployed Worker URL and the same webhook secret configured above:

   ```sh
   curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
     -H "content-type: application/json" \
     -d "{\"url\":\"https://YOUR-WORKER.workers.dev/telegram/webhook\",\"secret_token\":\"YOUR_WEBHOOK_SECRET\",\"allowed_updates\":[\"message\",\"callback_query\"]}"
   ```

   Never commit real tokens or secrets.

## Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/home` | Home page collections |
| GET | `/api/search?q=...&type=ANIME` | Search anime or manga |
| GET | `/api/media/:type/:id` | Media details |
| POST | `/telegram/webhook` | Telegram updates |

The Mini App is served from the root route.

## Development

```sh
npm test
npm run dev
```

Secrets are read from Worker environment bindings and are never stored in source control. Callback state is stored in KV with a 12-hour TTL. AniList requests are made server-side.
