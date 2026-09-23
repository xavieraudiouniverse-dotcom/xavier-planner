# Xavier Planner — Cloudflare Qwen setup

This integration changes Xavier Planner so Qwen runs server-side on Cloudflare Workers AI instead of depending on the phone's GPU.

## Architecture

Browser / phone -> Vercel Next.js API -> Cloudflare Workers AI -> Qwen 3 30B

If Cloudflare is unavailable, task breakdown tries the smaller local WebLLM model and then falls back to the instant planner template.

## 1. Create Cloudflare credentials

In Cloudflare Dashboard:

1. Open **Workers AI**.
2. Choose **Use REST API**.
3. Choose **Create a Workers AI API Token**.
4. Create/copy the token.
5. Copy your **Account ID**.

Do not put the token in GitHub, client-side code, screenshots, or chat messages.

## 2. Add secrets to Vercel

In the Vercel project that actually serves Planned-out, add:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_AI_API_TOKEN`

Apply them to Production and Preview. Redeploy after adding them.

## 3. Install the additional dependency

Run:

```bash
npm install @ai-sdk/openai-compatible@^3.0.53
```

The replacement package.json in this integration folder already includes it.

## 4. Copy the integration files

Copy these paths into the matching paths in the app repository:

- `app/api/assistant/route.ts`
- `app/api/ai/breakdown/route.ts`
- `lib/ai.ts`
- merge the dependency from `package.json`

Then run:

```bash
npm install
npm run typecheck
npm run build
```

## 5. Cloudflare model

The integration uses:

`@cf/qwen/qwen3-30b-a3b-fp8`

The Cloudflare token is used only by Vercel server routes and is never returned to the browser.

## 6. Zero Trust

Zero Trust is optional for this Workers AI REST connection because the Cloudflare API token already authenticates Vercel to Cloudflare and remains server-side.

Use Cloudflare Access / Zero Trust later for private admin dashboards, internal Workers, private APIs, or machine-to-machine services. If an Access-protected service is added, use a Cloudflare Service Token and store its Client ID and Client Secret in Vercel environment variables.
