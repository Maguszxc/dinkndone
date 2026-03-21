# Picklehoster — Setup Guide

## Prerequisites
- [Node.js](https://nodejs.org) (v18 or higher)
- A Cloudflare account (free plan works)

---

## After cloning

### 1. Install dependencies
```bash
npm install --legacy-peer-deps
```
> `--legacy-peer-deps` is needed because `qrcode.react` hasn't declared React 19 support yet (it works fine).

---

## Run locally

### 2. Create the local D1 database (first time only)
```bash
npm run db:migrate:local
```

### 3. Start the local server
```bash
npm run cf:preview
```

Open **http://localhost:8788**

> No hot reload — re-run `cf:preview` after any code change.

---

## Deploy to Cloudflare

### 4. Log in to Cloudflare (first time on a new machine)
```bash
npx wrangler login
```
This opens a browser to authorize your account.

### 5. Run the remote DB migration (first time only)
```bash
npm run db:migrate:remote
```

### 6. Deploy
```bash
npm run cf:deploy
```

Your live URL will be printed at the end:
`https://picklehoster.<your-subdomain>.workers.dev`

---

## Ongoing workflow

| Task | Command |
|------|---------|
| Run locally | `npm run cf:preview` |
| Deploy latest changes | `npm run cf:deploy` |
| Reset local DB | delete `.wrangler/` then re-run `npm run db:migrate:local` |
