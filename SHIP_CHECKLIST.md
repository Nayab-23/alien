# Ship Checklist - Signal Market Demo Preparation

Complete this checklist in order to prepare for your demo/hackathon submission.

## Phase 1: Local Setup (15-20 minutes)

### Environment Configuration

- [ ] Copy `.env.example` to `.env`: `cp .env.example .env`
- [ ] Generate `NONCE_SECRET`: `openssl rand -base64 32` → paste into `.env`
- [ ] Set `DATABASE_URL=sqlite.db` (for local testing)
- [ ] Keep other variables empty for now (will fill from Developer Portal)

### Database Setup

- [ ] Install dependencies: `npm install`
- [ ] Run database migrations: `npm run db:migrate`
- [ ] Verify database created: `ls -la sqlite.db` (should show file)
- [ ] (Optional) Open Drizzle Studio to inspect tables: `npm run db:studio`

### Start Development Server

- [ ] Start server: `npm run dev`
- [ ] Verify server running: visit `http://localhost:3000`
- [ ] Test health endpoint: `curl http://localhost:3000/api/health`
- [ ] Expected: `{"status":"healthy","timestamp":"...","version":"1.0.0","database":"connected"}`

---

## Phase 2: Developer Portal Setup (10-15 minutes)

### Create Application

- [ ] Go to [developer.worldcoin.org](https://developer.worldcoin.org)
- [ ] Click "Create App" or "New Application"
- [ ] Name: `Signal Market` (or your preferred name)
- [ ] Copy `APP_ID` (format: `app_staging_...`)
- [ ] Paste `APP_ID` into `.env`

### Generate API Key

- [ ] In Developer Portal → API Keys section
- [ ] Click "Generate New Key"
- [ ] Copy the key immediately (shown only once!)
- [ ] Paste as `DEV_PORTAL_API_KEY` in `.env`

### Configure Payment Recipient

- [ ] Choose a wallet address you control (MetaMask, etc.)
- [ ] In Developer Portal → Settings → Payment Recipients
- [ ] Click "Add Address"
- [ ] Enter your wallet address
- [ ] Save
- [ ] Paste same address as `RECIPIENT_ADDRESS` in `.env`

### Set Admin Wallets

- [ ] Copy the same wallet address (or different admin wallets)
- [ ] Paste as `ADMIN_ALIEN_SUBJECTS` in `.env` (comma-separated if multiple)
- [ ] Example: `ADMIN_ALIEN_SUBJECTS=0x742d35Cc6634C0532925a3b844Bc454e4438f44e`

### Restart Server

- [ ] Stop dev server (Ctrl+C)
- [ ] Start again: `npm run dev`
- [ ] Test health endpoint again: `curl http://localhost:3000/api/health`
- [ ] Verify no "Missing env vars" error

---

## Phase 3: Expose Local Server (5-10 minutes)

### Install ngrok

- [ ] Install ngrok: `brew install ngrok` (macOS) or download from [ngrok.com](https://ngrok.com)
- [ ] Sign up for free ngrok account if needed
- [ ] Authenticate: `ngrok config add-authtoken YOUR_TOKEN`

### Start ngrok Tunnel

- [ ] Start tunnel: `ngrok http 3000`
- [ ] Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
- [ ] Keep ngrok terminal running (don't close it!)

### Update Developer Portal

- [ ] Go back to Developer Portal
- [ ] Select your app
- [ ] Go to Settings → Mini App URL
- [ ] Paste ngrok URL: `https://abc123.ngrok.io`
- [ ] Save

---

## Phase 4: Test in World App (15-20 minutes)

### Open Mini App

- [ ] Get deeplink: `https://worldcoin.org/mini-app?app_id=YOUR_APP_ID`
- [ ] Replace `YOUR_APP_ID` with your actual app ID
- [ ] Send link to your phone (email, Messages, etc.)
- [ ] Open link on phone with World App installed
- [ ] Alternatively: Generate QR code and scan with World App

### Test Authentication

- [ ] Click "Sign In with World ID" in mini app
- [ ] Approve wallet auth in World App
- [ ] Verify signed in (should see "✓ Verified Human" badge)
- [ ] Check server logs for `/api/nonce` and `/api/auth/siwe` requests

### Test Prediction Creation

- [ ] Click "+ Create Prediction"
- [ ] Fill form:
  - Asset: BTC
  - Direction: UP
  - Timeframe: 24 hours
  - Confidence: 75%
- [ ] Submit
- [ ] Verify prediction appears in feed
- [ ] Check server logs for `POST /api/predictions` request

### Test Staking Flow

- [ ] Click on your prediction in feed
- [ ] Click "Stake FOR" or "Stake AGAINST"
- [ ] Enter amount: 0.5 WLD (or minimum 0.1)
- [ ] Click "Confirm Stake"
- [ ] MiniKit Pay UI should appear
- [ ] **IMPORTANT**: For demo, you can cancel here (to avoid actual payment)
- [ ] If testing with real funds:
  - [ ] Approve payment in World App
  - [ ] Wait for transaction confirmation
  - [ ] Verify stake shows as "confirmed" in UI

### Test Leaderboard

- [ ] Click "Leaderboard" link in header
- [ ] Verify your user appears (if you created predictions)
- [ ] Check reputation score, win rate, total settled

---

## Phase 5: Backend Testing (10 minutes)

### Test API Endpoints Directly

```bash
# Get your session cookie from browser DevTools (Application → Cookies → session)
export SESSION_COOKIE="your-session-cookie-value"

# Test create prediction
curl -X POST https://your-ngrok-url.ngrok.io/api/predictions \
  -H "Content-Type: application/json" \
  -H "Cookie: session=$SESSION_COOKIE" \
  -d '{
    "asset_symbol": "ETH",
    "direction": "down",
    "timeframe_hours": 48,
    "confidence": 80
  }'

# Test leaderboard
curl https://your-ngrok-url.ngrok.io/api/leaderboard

# Test health
curl https://your-ngrok-url.ngrok.io/api/health
```

- [ ] Create prediction via API returns 200 with prediction object
- [ ] Leaderboard returns 200 with users array
- [ ] Health endpoint returns `"status":"healthy"`

### Test Settlement (Manual)

- [ ] Create a prediction with short timeframe (1 hour)
- [ ] Wait for timeframe to expire (or manually update DB)
- [ ] Call settlement endpoint:

```bash
curl -X POST https://your-ngrok-url.ngrok.io/api/predictions/1/settle \
  -H "Content-Type: application/json" \
  -H "Cookie: session=$SESSION_COOKIE"
```

- [ ] Verify response includes `winners` and `losers` arrays
- [ ] Check leaderboard for updated reputation scores

---

## Phase 6: Production Deployment (Optional, 30-45 minutes)

**Skip this section if demoing with ngrok + local dev server.**

### Option A: Deploy to Vercel

- [ ] Sign up for Vercel account
- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Login: `vercel login`
- [ ] Deploy: `vercel deploy --prod`
- [ ] In Vercel dashboard → Settings → Environment Variables:
  - [ ] Add `DATABASE_URL` (PostgreSQL URL from Neon, Supabase, or Vercel Postgres)
  - [ ] Add `NONCE_SECRET`
  - [ ] Add `APP_ID`
  - [ ] Add `DEV_PORTAL_API_KEY`
  - [ ] Add `RECIPIENT_ADDRESS`
  - [ ] Add `ADMIN_ALIEN_SUBJECTS`
- [ ] Set all variables for "Production" environment
- [ ] Redeploy: `vercel --prod`
- [ ] Get production URL (e.g., `https://your-app.vercel.app`)

### Run Production Migrations

```bash
# Set DATABASE_URL to production Postgres
export DATABASE_URL=postgresql://user:password@host:5432/database

# Run migrations
npm run db:migrate
```

- [ ] Migrations completed successfully
- [ ] Test health endpoint: `curl https://your-app.vercel.app/api/health`

### Update Developer Portal with Production URL

- [ ] Go to Developer Portal → Settings → Mini App URL
- [ ] Change from ngrok URL to `https://your-app.vercel.app`
- [ ] Save
- [ ] Test deeplink again in World App

---

## Phase 7: Pre-Demo Verification (10 minutes)

### Final Checks

- [ ] Health endpoint returns healthy: `curl YOUR_URL/api/health`
- [ ] Can sign in with World ID
- [ ] Can create prediction
- [ ] Can view prediction detail
- [ ] Can see leaderboard
- [ ] (Optional) Can complete stake payment
- [ ] No console errors in browser DevTools
- [ ] No 500 errors in server logs

### Demo Data Preparation

- [ ] Create 2-3 sample predictions with different assets (BTC, ETH, WLD)
- [ ] Create 1-2 sample stakes on predictions (use small amounts)
- [ ] (Optional) Settle one prediction to show reputation changes
- [ ] Clear any test data that looks messy

### Demo Script Preparation

Prepare a 2-3 minute demo script:

1. **Intro (30 sec)**:
   - "Signal Market is a prediction market for verified humans only"
   - "All participants verified via World ID, all payments via MiniKit Pay"
   - "Reputation tied to immutable nullifier - can't reset by creating new accounts"

2. **Show Feed (30 sec)**:
   - Open mini app in World App (via deeplink)
   - Show existing predictions with stake totals
   - Point out verified human badge

3. **Create Prediction (60 sec)**:
   - Click "+ Create Prediction"
   - Fill form: BTC UP in 24h, 75% confidence
   - Submit
   - Show prediction appears in feed

4. **Stake Flow (60 sec)**:
   - Click on a prediction
   - Click "Stake FOR"
   - Enter amount (0.5 WLD)
   - Show MiniKit Pay UI
   - (Cancel or complete payment)

5. **Leaderboard (30 sec)**:
   - Show leaderboard with reputation scores
   - Explain reputation formula (±confidence based on outcome)
   - Explain settlement (admin settles after timeframe)

---

## Phase 8: Hackathon Submission (15 minutes)

### Repository Preparation

- [ ] Ensure `.env` is in `.gitignore` (already done)
- [ ] Ensure `sqlite.db` is in `.gitignore` (already done)
- [ ] Push all code to GitHub: `git push origin main`
- [ ] Create `.env.example` if not exists (already done)
- [ ] Verify README.md is up-to-date (already done)

### Create Demo Video (If Required)

- [ ] Record 2-3 minute screen recording of demo
- [ ] Show World App on phone (use screen mirroring to computer)
- [ ] Walk through: sign in → create prediction → stake → leaderboard
- [ ] Upload to YouTube, Loom, or similar
- [ ] Add video link to README or submission form

### Submission Form

Prepare these items for submission:

- [ ] **Project Name**: Signal Market (or your chosen name)
- [ ] **Description**: "Human-anchored prediction market where verified humans bet on price predictions using World ID and MiniKit Pay. Reputation tied to immutable nullifiers prevents gaming the system."
- [ ] **GitHub Repo**: `https://github.com/YOUR_USERNAME/alien`
- [ ] **Live Demo URL**: Your ngrok URL or Vercel URL
- [ ] **World App Deeplink**: `https://worldcoin.org/mini-app?app_id=YOUR_APP_ID`
- [ ] **Demo Video**: Link to video (if required)
- [ ] **Tech Stack**: Next.js, Drizzle ORM, MiniKit SDK, World ID, MiniKit Pay
- [ ] **Team Members**: Your name(s)

---

## Troubleshooting Quick Reference

### Mini app won't open in World App

- [ ] Verify `APP_ID` in deeplink matches Developer Portal
- [ ] Verify Mini App URL in Developer Portal is correct (ngrok or production)
- [ ] Check ngrok tunnel is still running
- [ ] Try regenerating deeplink

### "Unauthorized" errors in API

- [ ] Verify `NONCE_SECRET` is set in `.env`
- [ ] Restart dev server after changing `.env`
- [ ] Check session cookie is being set (browser DevTools → Application → Cookies)
- [ ] Try signing out and signing in again

### MiniKit.pay fails

- [ ] Verify `RECIPIENT_ADDRESS` is whitelisted in Developer Portal
- [ ] Verify amount >= 0.1 WLD (minimum)
- [ ] Must test in actual World App (not browser)
- [ ] Check World Chain network is selected in Developer Portal

### Health endpoint shows errors

- [ ] "Database locked": Switch to PostgreSQL (production only)
- [ ] "Missing env vars": Check `.env` has all required variables
- [ ] "Database not connected": Run `npm run db:migrate`

### Settlement fails

- [ ] Verify prediction `timeframe_end` has passed
- [ ] Verify admin wallet in `ADMIN_ALIEN_SUBJECTS` matches session
- [ ] Check CoinGecko API is accessible: `curl "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"`

---

## Post-Demo Cleanup (Optional)

After demo/hackathon:

- [ ] Stop ngrok tunnel (Ctrl+C)
- [ ] Stop dev server (Ctrl+C)
- [ ] (Optional) Remove test data from database: `rm sqlite.db && npm run db:migrate`
- [ ] (Optional) Deploy to production if ngrok was used
- [ ] Update Developer Portal Mini App URL to production
- [ ] Celebrate! 🎉

---

## Quick Command Reference

```bash
# Setup
npm run setup                          # One-command setup
openssl rand -base64 32                # Generate NONCE_SECRET

# Development
npm run dev                            # Start dev server
npm run db:studio                      # Database browser
ngrok http 3000                        # Expose local server

# Testing
curl http://localhost:3000/api/health  # Health check
npm run test:health                    # Same as above

# Database
npm run db:migrate                     # Apply migrations
npm run db:generate                    # Generate new migration

# Deployment
vercel deploy --prod                   # Deploy to Vercel
npm run build                          # Build for production
npm run start                          # Start production server

# Debugging
tail -f ~/.npm/_logs/*.log             # npm error logs
vercel logs --follow                   # Vercel logs (if deployed)
```

---

## Success Criteria

You're ready to demo when:

✅ Health endpoint returns `"status":"healthy"`
✅ Can sign in with World ID in World App
✅ Can create predictions via UI
✅ Can view prediction list and details
✅ Can view leaderboard
✅ MiniKit Pay UI appears when staking (even if you cancel payment)
✅ No console errors or 500 errors
✅ Demo script prepared (2-3 minutes)
✅ GitHub repo pushed with latest code
✅ Submission form filled with all required info

---

**Good luck with your demo! 🚀**
