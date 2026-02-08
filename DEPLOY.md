# Deployment Guide — Signal Market

Complete guide for deploying the Signal Market mini app to production.

## Prerequisites

- Node.js 20+ installed
- A World Developer Portal account
- A deployment platform (Vercel recommended, or any Node.js host)
- PostgreSQL database (for production) or SQLite (for local dev)

## Local Setup (Development)

### 1. Clone and Install

```bash
# Clone repo
cd alien

# Install dependencies
npm install
```

### 2. Configure Environment

```bash
# Copy example env
cp .env.example .env

# Edit .env with your values
nano .env
```

Required environment variables:

```bash
# Database
DATABASE_URL=sqlite.db                # Use sqlite.db for local dev

# Auth (generate with: openssl rand -base64 32)
NONCE_SECRET=your-32-plus-char-secret-here

# World Developer Portal
APP_ID=app_staging_YOUR_APP_ID        # Get from developer.worldcoin.org
DEV_PORTAL_API_KEY=your_api_key_here  # From Developer Portal → API Keys

# Payments
RECIPIENT_ADDRESS=0xYourWalletAddress # Must be whitelisted in Dev Portal

# Settlement (admin wallets that can settle predictions)
ADMIN_ALIEN_SUBJECTS=0xAdmin1,0xAdmin2
```

### 3. Database Setup

```bash
# Run migrations
npm run db:migrate

# Verify database
npm run db:studio  # Opens Drizzle Studio at http://localhost:4983
```

### 4. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the app.

### 5. Test Health Endpoint

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-08T22:00:00.000Z",
  "version": "1.0.0",
  "database": "connected"
}
```

## Developer Portal Setup

### 1. Create Application

1. Go to [developer.worldcoin.org](https://developer.worldcoin.org)
2. Click "Create App"
3. Name: "Signal Market"
4. Copy your `APP_ID` (format: `app_staging_...`)

### 2. Generate API Key

1. Go to API Keys section
2. Click "Generate New Key"
3. Copy the key → use as `DEV_PORTAL_API_KEY`

### 3. Whitelist Payment Recipient

1. Go to Settings → Payment Recipients
2. Click "Add Address"
3. Enter your `RECIPIENT_ADDRESS` wallet
4. Save

### 4. Configure Mini App URL

**For local testing:**
```
# Use ngrok to expose localhost
ngrok http 3000

# Copy the ngrok URL (e.g., https://abc123.ngrok.io)
# Set as Mini App URL in Developer Portal
```

**For production:**
```
# Set to your deployed URL
https://your-app.vercel.app
```

### 5. Test in World App

Use the deeplink:
```
https://worldcoin.org/mini-app?app_id=YOUR_APP_ID
```

Or scan QR code from World App.

## Production Deployment

### Option 1: Vercel (Recommended)

#### Step 1: Prepare Database

Use PostgreSQL for production (not SQLite):

```bash
# Get Postgres URL from:
# - Vercel Postgres
# - Neon.tech
# - Supabase
# - Railway.app

# Example format:
DATABASE_URL=postgresql://user:password@host:5432/database
```

#### Step 2: Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel deploy --prod
```

#### Step 3: Set Environment Variables

In Vercel dashboard:
1. Go to Settings → Environment Variables
2. Add all variables from `.env.example`:
   - `DATABASE_URL`
   - `NONCE_SECRET`
   - `APP_ID`
   - `DEV_PORTAL_API_KEY`
   - `RECIPIENT_ADDRESS`
   - `ADMIN_ALIEN_SUBJECTS`
3. Set for "Production" environment
4. Redeploy: `vercel --prod`

#### Step 4: Run Migrations

**Using Vercel CLI:**
```bash
# SSH into Vercel environment
vercel env pull .env.production
DATABASE_URL=$(cat .env.production | grep DATABASE_URL | cut -d '=' -f2) npm run db:migrate
```

**Or manually:**
```bash
# Connect to Postgres directly
psql $DATABASE_URL < drizzle/0000_*.sql
```

#### Step 5: Verify Deployment

```bash
curl https://your-app.vercel.app/api/health
```

#### Step 6: Update Developer Portal

Set Mini App URL to `https://your-app.vercel.app`

### Option 2: Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build
docker build -t signal-market .

# Run
docker run -p 3000:3000 --env-file .env signal-market
```

### Option 3: Manual Node.js Server

```bash
# On your server
git clone <repo>
cd alien
npm install
npm run build

# Set up systemd service
sudo nano /etc/systemd/system/signal-market.service
```

```ini
[Unit]
Description=Signal Market Mini App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/alien
Environment=NODE_ENV=production
EnvironmentFile=/path/to/alien/.env
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable signal-market
sudo systemctl start signal-market
```

## Database Migrations (Production)

### Initial Migration

```bash
# Set DATABASE_URL to production Postgres
export DATABASE_URL=postgresql://...

# Run migrations
npm run db:migrate
```

### Adding New Migrations

```bash
# 1. Modify lib/db/schema.ts
# 2. Generate migration
npm run db:generate

# 3. Review generated SQL in drizzle/XXXX_*.sql
# 4. Apply to production
DATABASE_URL=postgresql://... npm run db:migrate
```

## Webhook Configuration

### How Webhooks Work

**Important:** World/MiniKit does NOT send automatic webhooks. The flow is:

1. User completes payment in World App
2. Frontend receives `transaction_id` from MiniKit
3. **Frontend** calls `POST /api/webhooks/payment` with `transaction_id`
4. **Backend** polls Developer Portal API to verify transaction
5. Backend updates stake status

### Testing Webhooks Locally

```bash
# 1. Start server
npm run dev

# 2. Create stake
curl -X POST http://localhost:3000/api/stakes/create-invoice \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{"prediction_id":1,"side":"for","amount":"5.0","currency":"WLD"}'

# Returns: { "stake": { "id": 1, "reference": "abc123..." } }

# 3. Simulate webhook (normally called by frontend after MiniKit.pay)
curl -X POST http://localhost:3000/api/webhooks/payment \
  -H "Content-Type: application/json" \
  -d '{"transaction_id":"test-tx-id","reference":"abc123..."}'

# 4. Check stake status
curl http://localhost:3000/api/stakes/1/status
```

### Production Webhook Monitoring

Add logging to track webhook activity:

```typescript
// In app/api/webhooks/payment/route.ts
import { logInfo, logError } from "@/lib/logger";

logInfo("Webhook received", { transaction_id, reference });
```

Monitor logs:
```bash
# Vercel
vercel logs --follow

# Docker
docker logs -f <container-id>

# Systemd
journalctl -u signal-market -f
```

## Testing in World App

### 1. Expose Local Server (for development)

```bash
# Install ngrok
brew install ngrok  # or download from ngrok.com

# Expose port 3000
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

### 2. Update Developer Portal

1. Go to [developer.worldcoin.org](https://developer.worldcoin.org)
2. Select your app
3. Settings → Mini App URL
4. Set to ngrok URL: `https://abc123.ngrok.io`
5. Save

### 3. Open in World App

**Method 1: Deeplink**
```
https://worldcoin.org/mini-app?app_id=YOUR_APP_ID
```

Send this link to your phone or paste in browser on phone with World App installed.

**Method 2: QR Code**

Generate QR code for the deeplink and scan with World App.

**Method 3: Developer Portal**

From Developer Portal → Test → "Open in World App" button.

### 4. Test Complete Flow

1. ✅ Sign in with World ID (wallet auth)
2. ✅ Create a prediction
3. ✅ Stake on a prediction (triggers MiniKit Pay)
4. ✅ Verify stake appears as "confirmed" after payment
5. ✅ Check leaderboard updates

## Production Sanity Checklist

### Security

- [ ] All secrets in environment variables (not committed to git)
- [ ] `NONCE_SECRET` is 32+ cryptographically random characters
- [ ] `RECIPIENT_ADDRESS` is whitelisted in Developer Portal
- [ ] CORS configured for `https://world.org` origin
- [ ] No secrets logged to console (use `lib/logger.ts`)

### Configuration

- [ ] `APP_ID` matches production app (not staging)
- [ ] `DEV_PORTAL_API_KEY` has correct permissions
- [ ] `ADMIN_ALIEN_SUBJECTS` set to authorized admin wallets
- [ ] Mini App URL in portal matches deployed URL
- [ ] Database URL points to production Postgres (not SQLite)

### Database

- [ ] All migrations applied: `npm run db:migrate`
- [ ] Database connection pooling configured for Postgres
- [ ] Foreign keys enabled
- [ ] Backups configured (if using managed DB)

### Testing

- [ ] Health endpoint returns "healthy": `curl /api/health`
- [ ] Auth flow works (wallet auth → session)
- [ ] Create prediction works
- [ ] Stake creation works
- [ ] Payment webhook updates stake status
- [ ] Settlement works (admin can settle predictions)
- [ ] Leaderboard displays correctly

### Performance

- [ ] Next.js built for production: `npm run build`
- [ ] Static assets cached (Next.js handles this)
- [ ] Database indexes on frequently queried columns (already in schema)
- [ ] No N+1 queries in prediction list (uses single query + aggregation)

### Monitoring

- [ ] Health checks configured (every 5 min): `GET /api/health`
- [ ] Error logging to stdout (captured by platform)
- [ ] Webhook activity logged (no sensitive data)
- [ ] Database connection pool metrics (if using Postgres)

### World App Integration

- [ ] Mini App URL set correctly
- [ ] Payment recipient whitelisted
- [ ] Tested in actual World App (not just browser)
- [ ] MiniKit.install() called on app load
- [ ] Payment flow tested end-to-end

## Troubleshooting

### "Database is locked" Error

**Cause:** SQLite doesn't handle concurrent requests well.

**Solution:** Use Postgres in production.

```bash
# Set DATABASE_URL to Postgres
DATABASE_URL=postgresql://... npm run db:migrate
```

### "Unauthorized" on All API Calls

**Causes:**
1. Session cookie not set
2. `NONCE_SECRET` mismatch between .env and running server
3. CORS blocking cookies

**Solutions:**
```bash
# 1. Check health endpoint
curl http://localhost:3000/api/health

# 2. Verify NONCE_SECRET in .env matches running server
echo $NONCE_SECRET

# 3. Check CORS headers
curl -I http://localhost:3000/api/me
```

### MiniKit.commandsAsync.pay Fails

**Causes:**
1. Not running in World App (must be in webview)
2. `RECIPIENT_ADDRESS` not whitelisted
3. Amount < 0.1 (minimum)

**Solutions:**
1. Test in actual World App (not browser)
2. Whitelist address in Developer Portal
3. Increase amount to at least 0.1 WLD

### Settlement Fails with "Failed to fetch price"

**Causes:**
1. CoinGecko rate limit exceeded
2. Invalid asset symbol
3. Network error

**Solutions:**
```bash
# 1. Check CoinGecko API manually
curl "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"

# 2. Verify symbol is mapped in lib/price-oracle.ts
# 3. Wait 1 minute and retry (rate limit resets)
```

### "Payment confirmation timeout"

**Cause:** Transaction not mined within 60 seconds.

**Solutions:**
1. Increase polling timeout in frontend
2. Check World Chain block explorer for transaction
3. Verify Developer Portal API returns transaction status

## Environment Variable Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | Database connection string | `sqlite.db` or `postgresql://...` |
| `NONCE_SECRET` | Yes | HMAC key for sessions (32+ chars) | Generate with `openssl rand -base64 32` |
| `APP_ID` | Yes | World Developer Portal app ID | `app_staging_abc123` |
| `DEV_PORTAL_API_KEY` | Yes | API key for transaction verification | From Developer Portal |
| `RECIPIENT_ADDRESS` | Yes | Wallet receiving stakes (whitelisted) | `0x742d35Cc...` |
| `ADMIN_ALIEN_SUBJECTS` | Yes | Admin wallets (comma-separated) | `0xAdmin1,0xAdmin2` |
| `NODE_ENV` | Auto | Environment (development/production) | Set by platform |

## Support

- **World Documentation:** https://docs.world.org/mini-apps
- **Developer Portal:** https://developer.worldcoin.org
- **MiniKit SDK:** https://github.com/worldcoin/minikit-js

## Quick Command Reference

```bash
# Setup
npm run setup                  # Copy .env, install, migrate

# Development
npm run dev                    # Start dev server
npm run db:studio              # Database browser

# Database
npm run db:generate            # Generate migration
npm run db:migrate             # Apply migrations
npm run db:push                # Quick push (dev only)

# Testing
npm run test:health            # Check health endpoint
./test-payment-flow.sh         # Test payment flow

# Deployment
npm run build                  # Build for production
npm run start                  # Start production server
npm run deploy:check           # Build + health check
```
