# Render Deployment Guide

Complete guide for deploying Signal Market to Render.

## Important: Next.js Architecture

**You only need ONE web service, not separate frontend/backend.**

Next.js is a full-stack framework that handles:
- **Frontend**: React components, pages, static assets
- **Backend**: API routes in `app/api/*`

Both run in the same Node.js process and are deployed together.

## Prerequisites

1. Render account ([render.com](https://render.com))
2. GitHub repository pushed ([https://github.com/Nayab-23/alien](https://github.com/Nayab-23/alien))
3. World Developer Portal account with APP_ID and API key

## Deployment Options

### Option 1: Blueprint (Automated - Recommended)

This uses the `render.yaml` file for automated setup.

#### Step 1: Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "PostgreSQL"
3. Settings:
   - **Name**: `signal-market-db`
   - **Database**: `signal_market`
   - **User**: `signal_market_user` (auto-generated)
   - **Region**: Oregon (or closest to you)
   - **Plan**: Free
4. Click "Create Database"
5. Wait 2-3 minutes for provisioning
6. Copy the **Internal Database URL** (format: `postgresql://user:pass@hostname/dbname`)

#### Step 2: Deploy from Blueprint

1. Click "New +" → "Blueprint"
2. Connect your GitHub repository: `https://github.com/Nayab-23/alien`
3. Render will detect `render.yaml` automatically
4. Click "Apply"
5. Render will create the web service

#### Step 3: Configure Environment Variables

After blueprint creates the service:

1. Go to your web service → "Environment"
2. Add the following variables (Blueprint sets placeholders, you need real values):

```bash
DATABASE_URL=postgresql://...           # Paste Internal Database URL from Step 1
NONCE_SECRET=                          # Generate: openssl rand -base64 32
APP_ID=app_staging_YOUR_APP_ID         # From developer.worldcoin.org
DEV_PORTAL_API_KEY=YOUR_API_KEY        # From Developer Portal
RECIPIENT_ADDRESS=0xYourWalletAddress  # Must be whitelisted in Dev Portal
ADMIN_ALIEN_SUBJECTS=0xAdmin1,0xAdmin2 # Admin wallet addresses
```

3. Click "Save Changes"
4. Render will automatically redeploy

#### Step 4: Run Migrations

After first deploy completes:

1. Go to web service → "Shell" tab
2. Run migrations:
```bash
npm run db:migrate
```

3. Verify database:
```bash
# Check tables exist
echo "SELECT name FROM sqlite_master WHERE type='table';" | psql $DATABASE_URL
```

#### Step 5: Update Developer Portal

1. Copy your Render URL (e.g., `https://signal-market.onrender.com`)
2. Go to [developer.worldcoin.org](https://developer.worldcoin.org)
3. Select your app
4. Settings → Mini App URL
5. Paste Render URL
6. Save

#### Step 6: Test Deployment

```bash
# Health check
curl https://signal-market.onrender.com/api/health

# Expected response:
# {"status":"healthy","timestamp":"...","version":"1.0.0","database":"connected"}
```

---

### Option 2: Manual Setup (If Blueprint Fails)

#### Step 1: Create PostgreSQL Database

Same as Option 1, Step 1.

#### Step 2: Create Web Service Manually

1. Click "New +" → "Web Service"
2. Connect repository: `https://github.com/Nayab-23/alien`
3. Configure:
   - **Name**: `signal-market`
   - **Region**: Oregon
   - **Branch**: `main`
   - **Root Directory**: (leave blank - root of repo)
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Plan**: Free

4. Click "Create Web Service"

#### Step 3: Add Environment Variables

Go to "Environment" tab and add:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...           # From database you created
NONCE_SECRET=                          # Generate: openssl rand -base64 32
APP_ID=app_staging_YOUR_APP_ID
DEV_PORTAL_API_KEY=YOUR_API_KEY
RECIPIENT_ADDRESS=0xYourWalletAddress
ADMIN_ALIEN_SUBJECTS=0xAdmin1,0xAdmin2
```

#### Step 4: Run Migrations

After first deploy:
1. Go to "Shell" tab
2. Run: `npm run db:migrate`

#### Step 5: Update Developer Portal & Test

Same as Option 1, Steps 5-6.

---

## Understanding Render's Next.js Deployment

### What Gets Deployed

```
Your Render Web Service runs:
┌─────────────────────────────────────────┐
│     signal-market.onrender.com          │
│                                         │
│  Next.js Server (Port 3000)             │
│  ├── Frontend (React app)               │
│  │   ├── /                 (Home page)  │
│  │   ├── /create           (Create)     │
│  │   └── /predictions/[id] (Detail)     │
│  │                                       │
│  └── Backend (API routes)               │
│      ├── /api/health                    │
│      ├── /api/auth/siwe                 │
│      ├── /api/predictions               │
│      └── /api/stakes/...                │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│   PostgreSQL Database (Render)          │
│   signal-market-db.internal             │
└─────────────────────────────────────────┘
```

### Key Points

- **Single service**: One web service runs both frontend and API
- **No static site needed**: Next.js handles static assets automatically
- **Server-side rendering**: Pages are rendered on the server
- **API routes**: `/api/*` routes are handled by same Node.js process

### Build Process

```bash
# What happens during Render build:
npm install              # Install dependencies
npm run build           # Next.js builds frontend + API
npm run start           # Starts production server on port 3000
```

### File Structure on Render

```
/opt/render/project/src/    # Your code
├── .next/                  # Built Next.js app
├── app/                    # Your source code
├── lib/                    # Backend utilities
├── components/             # React components
├── package.json
└── ...
```

---

## Troubleshooting

### "Build failed: MODULE_NOT_FOUND"

**Cause**: Dependencies not installed correctly.

**Solution**:
1. Go to "Environment" tab
2. Add: `NPM_CONFIG_PRODUCTION=false`
3. Redeploy

### "Database connection failed"

**Cause**: Wrong DATABASE_URL or database not created.

**Solution**:
```bash
# 1. Check DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:pass@hostname/dbname

# 2. Test connection from Shell
psql $DATABASE_URL -c "SELECT 1;"

# 3. Run migrations
npm run db:migrate
```

### "Health check failing"

**Cause**: Missing environment variables or database not migrated.

**Solution**:
```bash
# Check logs
# Render Dashboard → Logs tab

# Common issues:
# - Missing NONCE_SECRET
# - Missing APP_ID
# - DATABASE_URL not set
# - Migrations not run
```

### "Port already in use"

**Cause**: Next.js tries to use a different port than Render expects.

**Solution**: Render automatically sets `PORT` env var. Next.js uses it by default. No action needed.

### "Cold start delay"

**Cause**: Free tier Render services sleep after 15 minutes of inactivity.

**Solution**:
- First request after sleep takes 30-60 seconds
- Upgrade to paid plan for 24/7 uptime
- Or: Set up external ping service (UptimeRobot, etc.) to ping health endpoint every 10 minutes

---

## Migration Commands Reference

```bash
# From Render Shell tab:

# Run migrations
npm run db:migrate

# Check migration status
ls drizzle/*.sql

# Test database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# View all tables
psql $DATABASE_URL -c "\dt"

# Reset database (DANGER: deletes all data)
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:migrate
```

---

## Environment Variables Explained

| Variable | Example | Where to Get |
|----------|---------|--------------|
| `DATABASE_URL` | `postgresql://user:pass@host/db` | Copy from Render PostgreSQL "Internal Database URL" |
| `NONCE_SECRET` | `base64-encoded-32-chars` | Generate: `openssl rand -base64 32` |
| `APP_ID` | `app_staging_abc123` | World Developer Portal → Your App → App ID |
| `DEV_PORTAL_API_KEY` | `sk_live_...` | Developer Portal → API Keys → Generate New Key |
| `RECIPIENT_ADDRESS` | `0x742d35Cc6634C0532925a3b844Bc454e4438f44e` | Your wallet address (must whitelist in Dev Portal) |
| `ADMIN_ALIEN_SUBJECTS` | `0xAdmin1,0xAdmin2` | Admin wallet addresses (comma-separated) |

---

## Post-Deployment Checklist

- [ ] Health endpoint returns healthy: `curl https://YOUR_URL.onrender.com/api/health`
- [ ] Database connection confirmed (check health response)
- [ ] All environment variables set (no "Missing env vars" error)
- [ ] Migrations run successfully (`npm run db:migrate` in Shell)
- [ ] Developer Portal Mini App URL updated to Render URL
- [ ] Test deeplink in World App: `https://worldcoin.org/mini-app?app_id=YOUR_APP_ID`
- [ ] Can sign in with World ID
- [ ] Can create prediction
- [ ] Can view leaderboard
- [ ] No 500 errors in Render logs

---

## Updating Your Deployment

When you push new code to GitHub:

1. Render auto-deploys from `main` branch (if auto-deploy enabled)
2. Or manually trigger: Dashboard → "Manual Deploy" → "Deploy latest commit"

To run new migrations after deployment:
```bash
# Go to Shell tab
npm run db:migrate
```

---

## Monitoring & Logs

### View Logs
1. Dashboard → Your service → "Logs" tab
2. Real-time logs of all requests and errors

### Health Checks
Render automatically pings `/api/health` every few minutes. If it fails, service is restarted.

### Metrics
Dashboard → "Metrics" tab shows:
- CPU usage
- Memory usage
- Request count
- Response times

---

## Cost Estimate

**Free Tier (Current Setup)**:
- Web Service: Free (sleeps after 15 min inactivity)
- PostgreSQL: Free (limited to 1GB storage)
- Bandwidth: 100GB/month free

**Paid Tier (Recommended for Production)**:
- Web Service: $7/month (always on, more resources)
- PostgreSQL: $7/month (10GB storage, better performance)

---

## Alternative: Deploy Just Backend to Render, Frontend to Vercel

If you want to separate them:

**Backend on Render**:
1. Create web service
2. Build command: `npm install && npm run build`
3. Start command: `npm run start`
4. Only expose API routes

**Frontend on Vercel**:
1. Same repo
2. Vercel auto-detects Next.js
3. Set `API_URL` env var pointing to Render backend

**NOT RECOMMENDED**: Next.js is designed to run as a unified app. Splitting adds complexity with no benefit.

---

## Support

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **This Project Docs**: See [DEPLOY.md](DEPLOY.md) for general deployment info

---

## Quick Commands

```bash
# Generate NONCE_SECRET
openssl rand -base64 32

# Test health endpoint
curl https://YOUR_URL.onrender.com/api/health

# Check logs
# (from Render Dashboard → Logs tab)

# Run migrations (from Shell tab)
npm run db:migrate

# Test database connection (from Shell tab)
psql $DATABASE_URL -c "SELECT 1;"
```
