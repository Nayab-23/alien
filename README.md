# Signal Market — Human-Anchored Prediction Market

A prediction market mini app built on World ID where verified humans bet on price predictions. Powered by MiniKit Pay and anchored to immutable World ID nullifiers.

## What is This?

Signal Market is an Alien/World Mini App that lets verified humans:

- **Create predictions** about asset prices (BTC, ETH, WLD, etc.) with confidence levels
- **Stake WLD or USDC** on predictions (backing the creator or betting against them)
- **Build reputation** tied to their World ID nullifier (can't be reset by creating new accounts)
- **Earn from correct predictions** through proportional payouts from the losing side's pool

All participants must be verified humans via World ID. All payments flow through MiniKit Pay on World Chain.

## Quick Start

```bash
# 1. One-command setup
npm run setup  # Copies .env.example, installs deps, runs migrations

# 2. Configure environment
nano .env  # Fill in required values (see below)

# 3. Start dev server
npm run dev

# 4. Test health endpoint
curl http://localhost:3000/api/health
```

### Required Environment Variables

```bash
# Database
DATABASE_URL=sqlite.db  # Use sqlite.db for local dev

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

## Documentation

| Doc | Purpose |
|-----|---------|
| **[SHIP_CHECKLIST.md](SHIP_CHECKLIST.md)** | **Step-by-step demo preparation guide (START HERE for hackathons!)** |
| **[RENDER_DEPLOY.md](RENDER_DEPLOY.md)** | **Deploy to Render (recommended for easy setup)** |
| [DEPLOY.md](DEPLOY.md) | Deploy to Vercel, Docker, or manual Node.js |
| [PAYMENT_FLOW.md](PAYMENT_FLOW.md) | Complete payment system guide (stake creation, webhook, confirmation) |
| [SETTLEMENT.md](SETTLEMENT.md) | Settlement logic, reputation formula, price oracle integration |
| [FRONTEND.md](FRONTEND.md) | Frontend implementation guide (all screens, components, state management) |

## Architecture

### Tech Stack

- **Frontend**: Next.js 15 + React 19 + Tailwind CSS
- **Backend**: Next.js API Routes + Drizzle ORM
- **Database**: SQLite (dev) / PostgreSQL (production)
- **Auth**: MiniKit Wallet Auth (SIWE) + HMAC-signed sessions
- **Payments**: MiniKit Pay (WLD/USDC on World Chain)
- **Price Oracle**: CoinGecko API (extensible via PriceProvider interface)

### System Diagram

```
┌─────────────────────────────────────────────┐
│           World App (Mobile)                │
│  ┌───────────────────────────────────────┐  │
│  │   Next.js App (Mini App)              │  │
│  │   - MiniKit SDK integration           │  │
│  │   - Wallet auth (SIWE)                │  │
│  │   - Payment UI (MiniKit.pay)          │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
    ┌──────────────┐     ┌──────────────┐
    │   Backend    │     │  CoinGecko   │
    │  (Next.js    │     │  Price API   │
    │   API)       │     │              │
    └──────────────┘     └──────────────┘
           │
           ▼
    ┌──────────────┐
    │   SQLite/    │
    │  Postgres    │
    └──────────────┘
```

### Data Model

```
users
  ├─ id (primary key)
  └─ alien_subject (unique nullifier hash from World ID)

predictions
  ├─ id (primary key)
  ├─ creator_id → users.id
  ├─ asset_symbol (BTC, ETH, WLD, etc.)
  ├─ direction (up/down)
  ├─ timeframe_end (unix timestamp)
  ├─ confidence (1-99%)
  └─ status (open/settled)

stakes
  ├─ id (primary key)
  ├─ prediction_id → predictions.id
  ├─ user_id → users.id
  ├─ side (for/against)
  ├─ amount (base units: 18 decimals for WLD, 6 for USDC)
  ├─ currency (WLD/USDC)
  ├─ payment_status (initiated/confirmed/failed)
  └─ invoice_id (unique reference for payment tracking)

reputation_events
  ├─ id (primary key)
  ├─ user_id → users.id
  ├─ delta (+/- confidence based on outcome)
  └─ reason (settled_prediction/won_stake/lost_stake)
```

## How It Works

### Authentication Flow

1. User opens mini app in World App
2. Frontend calls `GET /api/nonce` to get a random nonce
3. Frontend triggers `MiniKit.commandsAsync.walletAuth({ nonce })`
4. User signs SIWE message in World App
5. Frontend sends `POST /api/auth/siwe` with signature + nonce
6. Backend verifies signature using `verifySiweMessage` from MiniKit
7. Backend extracts `alien_subject` (nullifier hash) from SIWE payload
8. Backend creates/resolves user from `alien_subject`
9. Backend sets session cookie (HMAC-signed)
10. All subsequent API calls include session cookie for authentication

### Payment Flow

1. User creates stake via `POST /api/stakes/create-invoice`
2. Backend creates stake record with status `initiated` and unique `reference`
3. Backend returns payment payload (recipient, amount, currency, reference)
4. Frontend triggers `MiniKit.commandsAsync.pay(payload)`
5. User approves payment in World App
6. MiniKit returns `transaction_id` to frontend
7. **Frontend** calls `POST /api/webhooks/payment` with `transaction_id` + `reference`
8. Backend polls Developer Portal API to verify transaction status
9. Backend updates stake to `confirmed` if transaction is successful
10. Frontend polls `GET /api/stakes/{id}/status` to check confirmation

**Important**: MiniKit does NOT send automatic webhooks. The frontend must call the webhook endpoint.

### Settlement Flow

1. Admin calls `POST /api/predictions/{id}/settle`
2. Backend fetches historical price from CoinGecko at `timeframe_end`
3. Backend determines if creator was correct:
   - If `direction = "up"` and `price_at_end > price_at_creation` → creator correct
   - If `direction = "down"` and `price_at_end < price_at_creation` → creator correct
4. Backend calculates winners (creator + "for" stakers) vs losers (creator + "against" stakers)
5. Backend calculates payouts:
   - Winners get stake back + proportional share of losing pool
   - Formula: `payout = stake + (stake / total_winning_pool) * total_losing_pool`
6. Backend creates reputation events:
   - Winners: `+confidence` points
   - Losers: `-confidence` points
7. Backend updates prediction status to `settled`

### Reputation System

Reputation is tied to `alien_subject` (World ID nullifier) and cannot be reset by creating new accounts.

**Reputation events:**
- Create prediction → settled correctly: `+confidence`
- Create prediction → settled incorrectly: `-confidence`
- Stake on winning side: `+confidence`
- Stake on losing side: `-confidence`

**Leaderboard calculation:**
- Aggregates all reputation events per user
- Calculates total score, win rate, total predictions settled
- Orders by score descending

### Payout Calculation

```
Winner payout = stake + (stake / total_winning_pool) * total_losing_pool

Example:
- 5 WLD FOR, 10 WLD AGAINST
- Creator wrong → AGAINST wins
- Winner (10 WLD) gets: 10 + (10/10) * 5 = 15 WLD
- Loser (5 WLD) loses entire stake
```

## API Endpoints

### Auth
- `GET /api/nonce` — Generate SIWE nonce
- `POST /api/auth/siwe` — Verify wallet signature + create session
- `GET /api/me` — Get authenticated user

### Predictions
- `POST /api/predictions` — Create prediction (auth required)
- `GET /api/predictions` — List predictions
- `GET /api/predictions/:id` — Single prediction detail
- `POST /api/predictions/:id/settle` — Settle prediction (admin only)

### Stakes
- `POST /api/stakes/create-invoice` — Create stake + payment invoice (auth required)
- `GET /api/stakes/:id/status` — Poll stake confirmation status
- `POST /api/webhooks/payment` — Payment confirmation webhook (called by frontend after MiniKit.pay)

### Leaderboard
- `GET /api/leaderboard` — Top users by reputation

### Health
- `GET /api/health` — Health check (database + env validation)

## Development Scripts

```bash
# Development
npm run dev                    # Start dev server
npm run db:studio              # Open Drizzle Studio (database browser)

# Database
npm run db:generate            # Generate migration from schema changes
npm run db:migrate             # Apply migrations
npm run db:push                # Quick push (dev only, skips migrations)

# Testing
npm run test:health            # Check health endpoint
./test-payment-flow.sh         # Test complete payment flow

# Deployment
npm run build                  # Build for production
npm run start                  # Start production server
npm run deploy:check           # Build + health check
npm run setup                  # Copy .env + install + migrate
```

## Testing

### Test Complete Flow Locally

See [test-payment-flow.sh](test-payment-flow.sh) or run manually:

```bash
# 1. Start server
npm run dev

# 2. Create prediction
curl -X POST http://localhost:3000/api/predictions \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{
    "asset_symbol": "BTC",
    "direction": "up",
    "timeframe_hours": 24,
    "confidence": 75
  }'

# 3. Create stake
curl -X POST http://localhost:3000/api/stakes/create-invoice \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{
    "prediction_id": 1,
    "side": "for",
    "amount": "5.0",
    "currency": "WLD"
  }'

# 4. Simulate webhook
curl -X POST http://localhost:3000/api/webhooks/payment \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "test-tx-id",
    "reference": "abc123..."
  }'

# 5. Settle prediction
curl -X POST http://localhost:3000/api/predictions/1/settle \
  -H "Cookie: session=ADMIN_SESSION"

# 6. Check leaderboard
curl http://localhost:3000/api/leaderboard
```

### Test in World App

See [DEPLOY.md](DEPLOY.md#testing-in-world-app) for detailed instructions on:
- Exposing local server with ngrok
- Updating Developer Portal with ngrok URL
- Opening mini app via deeplink or QR code
- Testing complete flow in actual World App

## Project Structure

```
alien/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── auth/siwe/            # Wallet auth verification
│   │   ├── health/               # Health check endpoint
│   │   ├── leaderboard/          # Reputation leaderboard
│   │   ├── me/                   # Current user
│   │   ├── nonce/                # SIWE nonce generation
│   │   ├── predictions/          # Prediction CRUD + settlement
│   │   ├── stakes/               # Stake creation + status
│   │   └── webhooks/payment/     # Payment confirmation
│   ├── layout.tsx                # Root layout with MiniKitProvider
│   ├── page.tsx                  # Home/Feed page
│   └── globals.css               # Tailwind utilities + components
├── components/
│   └── MiniKitProvider.tsx       # Auth context wrapping MiniKit SDK
├── lib/
│   ├── auth.ts                   # Session management + middleware
│   ├── db/
│   │   ├── index.ts              # Lazy DB initialization
│   │   └── schema.ts             # Complete database schema
│   ├── logger.ts                 # Logging utilities (sanitizes secrets)
│   ├── payments.ts               # Payment config + transaction polling
│   ├── price-oracle.ts           # PriceProvider interface + CoinGecko
│   ├── reputation.ts             # Reputation aggregation
│   ├── settlement.ts             # Settlement logic + payout calculation
│   ├── validation.ts             # Input validation
│   └── webhook.ts                # Webhook signature verification
├── drizzle/                      # Database migrations
├── .env.example                  # Example environment variables
├── drizzle.config.ts             # Drizzle Kit configuration
├── next.config.ts                # Next.js config with CORS
├── tailwind.config.ts            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies + scripts
├── README.md                     # This file
├── SHIP_CHECKLIST.md             # Demo preparation checklist
├── DEPLOY.md                     # Comprehensive deployment guide
├── FRONTEND.md                   # Frontend implementation guide
├── PAYMENT_FLOW.md               # Payment flow documentation
└── SETTLEMENT.md                 # Settlement system documentation
```

## Key Design Decisions

### Why World ID nullifier as identity anchor?

- **Immutable**: Users cannot reset reputation by creating new accounts
- **Privacy-preserving**: No PII required, just cryptographic proof of humanness
- **Sybil-resistant**: One human = one account (enforced by World ID protocol)

### Why HMAC-signed cookies instead of JWT?

- **Simpler**: No need for JWT library or token refresh logic
- **Stateless**: Session data stored in cookie, no server-side session storage
- **Secure**: HMAC with 32+ char secret prevents tampering

### Why frontend calls webhook endpoint?

- **MiniKit limitation**: World/MiniKit does NOT send automatic webhooks
- **Transaction confirmation**: Frontend receives `transaction_id` from MiniKit after payment
- **Verification flow**: Backend polls Developer Portal API to verify transaction on-chain

### Why CoinGecko for price oracle?

- **Free tier**: No API key required for basic usage
- **Historical data**: Supports fetching prices at specific timestamps
- **Extensible**: PriceProvider interface allows swapping to other oracles (Chainlink, Pyth, etc.)

### Why proportional payouts instead of fixed odds?

- **Dynamic market**: Pool sizes change as more people stake
- **Fair distribution**: Winners split losing pool based on their contribution
- **No house edge**: All funds go to winners (except gas costs)

## Frontend Implementation Status

✅ **Completed:**
- Home/Feed page with prediction list
- Auth context with MiniKit wallet auth
- Tailwind CSS styling system
- Mobile-first responsive layout

📝 **Documented (ready to implement):**
- Create prediction page
- Prediction detail page
- Stake modal with payment flow
- Leaderboard page

See [FRONTEND.md](FRONTEND.md) for complete implementation guide for remaining screens.

## Security

- ✅ SIWE signature verification (not client-side auth)
- ✅ HMAC-signed nonces and sessions
- ✅ Payment confirmation via Developer Portal API
- ✅ Idempotent webhook handling
- ✅ DB constraints (unique alien_subject, no duplicate stakes)
- ✅ Admin access control for settlement
- ✅ Input validation on all write endpoints
- ✅ Secret sanitization in logs

## Troubleshooting

### "Database is locked" error

**Cause**: SQLite doesn't handle concurrent requests well.

**Solution**: Use PostgreSQL in production.

```bash
DATABASE_URL=postgresql://... npm run db:migrate
```

### "Unauthorized" on all API calls

**Causes**:
1. Session cookie not set
2. `NONCE_SECRET` mismatch between .env and running server
3. CORS blocking cookies

**Solutions**:
```bash
# 1. Check health endpoint
curl http://localhost:3000/api/health

# 2. Verify NONCE_SECRET in .env matches running server
echo $NONCE_SECRET

# 3. Check CORS headers
curl -I http://localhost:3000/api/me
```

### MiniKit.commandsAsync.pay fails

**Causes**:
1. Not running in World App (must be in webview)
2. `RECIPIENT_ADDRESS` not whitelisted
3. Amount < 0.1 (minimum)

**Solutions**:
1. Test in actual World App (not browser)
2. Whitelist address in Developer Portal
3. Increase amount to at least 0.1 WLD

### Settlement fails

**Causes**:
1. CoinGecko rate limit exceeded
2. Invalid asset symbol
3. Network error

**Solutions**:
```bash
# 1. Check CoinGecko API manually
curl "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"

# 2. Verify symbol is mapped in lib/price-oracle.ts
# 3. Wait 1 minute and retry (rate limit resets)
```

See [DEPLOY.md](DEPLOY.md#troubleshooting) for more troubleshooting guides.

## Deployment

Quick deploy to Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel deploy --prod

# Set environment variables in Vercel dashboard
# Run migrations: DATABASE_URL=postgresql://... npm run db:migrate

# Verify deployment
curl https://your-app.vercel.app/api/health
```

See deployment guides:
- **[RENDER_DEPLOY.md](RENDER_DEPLOY.md)** - Deploy to Render (single web service with PostgreSQL)
- **[DEPLOY.md](DEPLOY.md)** - Deploy to Vercel, Docker, or manual Node.js

Both guides cover:
- **Database setup**: PostgreSQL for production
- **Environment variable configuration**: All required variables explained
- **Database migrations**: Running migrations in production
- **Webhook configuration**: Testing and monitoring payment webhooks
- **Production sanity checklist**: Verification steps
- **Troubleshooting**: Common issues and solutions

## Support

- **World Documentation**: https://docs.world.org/mini-apps
- **Developer Portal**: https://developer.worldcoin.org
- **MiniKit SDK**: https://github.com/worldcoin/minikit-js

## License

MIT

## Contact

Built for World App Mini Apps hackathon.
