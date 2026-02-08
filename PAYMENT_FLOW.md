# Payment Flow Documentation

## Overview

The stake-with-payments system uses **World/Alien MiniKit Pay** for on-chain payments. Users stake WLD or USDC tokens on predictions, and payments are verified via the Developer Portal API.

## Architecture

```
Frontend (World App)              Backend                    Developer Portal
────────────────────              ───────                    ────────────────

1. User clicks "Stake"
   POST /api/stakes/create-invoice ──►  Generate reference UUID
                                        Create stake (status=initiated)
                                   ◄──  Return { reference, payment{} }

2. Call MiniKit.commandsAsync.pay()
   with reference, amount, recipient

   User approves in World App ────────► Transaction submitted to
                                        World Chain (gas sponsored)

   MiniKit returns:
   { transaction_id: "0x..." }

3. POST /api/webhooks/payment ──────►  Poll Developer Portal:
   { transaction_id, reference }       GET /api/v2/minikit/transaction/{tx_id}

                                        Verify:
                                        - Reference matches
                                        - Status = "mined"
                                        - Amount + recipient correct

                                        Update stake.payment_status = "confirmed"
                                   ◄──  Return { status: "ok" }

4. Poll GET /api/stakes/{id}/status
   until status === "confirmed"
```

## Environment Variables

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `APP_ID` | Your mini app ID | [Developer Portal](https://developer.worldcoin.org) → Apps |
| `DEV_PORTAL_API_KEY` | API key for verifying transactions | Developer Portal → API Keys |
| `RECIPIENT_ADDRESS` | Wallet address that receives stakes | Your wallet (must be whitelisted in Dev Portal) |
| `NONCE_SECRET` | HMAC key for session cookies | Generate 32+ random chars |
| `DATABASE_URL` | SQLite database path | `sqlite.db` (local) or Postgres URL (prod) |

### Setup in Developer Portal

1. **Create App** → Get `APP_ID`
2. **Generate API Key** → Get `DEV_PORTAL_API_KEY`
3. **Whitelist Recipient** → Settings → Payment Recipients → Add `RECIPIENT_ADDRESS`
4. **Configure Mini App URL** → Set to your deployed domain (or ngrok for local testing)

## API Endpoints

### POST /api/stakes/create-invoice

Create a pending stake and return payment details for MiniKit.

**Auth:** Required (session cookie)

**Request:**
```json
{
  "prediction_id": 1,
  "side": "for",
  "amount": "5.0",
  "currency": "WLD"
}
```

**Response (201):**
```json
{
  "stake": {
    "id": 1,
    "reference": "abc123...",
    "predictionId": 1,
    "side": "for",
    "amount": "5.0",
    "currency": "WLD"
  },
  "payment": {
    "reference": "abc123...",
    "to": "0xRecipient...",
    "tokens": [{
      "symbol": "WLD",
      "token_amount": "5000000000000000000"
    }],
    "description": "Stake 5.0 WLD for prediction #1"
  }
}
```

**Validation rules:**
- `amount` must be ≥ 0.1 (MiniKit minimum)
- `currency` must be `"WLD"` or `"USDC"`
- `side` must be `"for"` or `"against"`
- Prediction must exist and be `open`
- Prediction timeframe must not be expired
- User cannot stake same side twice on same prediction (enforced by DB constraint)

### GET /api/stakes/:id/status

Poll stake status (used by frontend after payment).

**Auth:** None

**Response:**
```json
{
  "stake": {
    "id": 1,
    "status": "initiated" | "confirmed" | "failed",
    "amount": "5000000000000000000",
    "currency": "WLD",
    "side": "for",
    "predictionId": 1,
    "createdAt": "2026-02-08T21:53:58.000Z"
  }
}
```

### POST /api/webhooks/payment

**⚠️ Important:** World/MiniKit does NOT send automatic webhooks. This endpoint is called by **your frontend** after receiving `transaction_id` from MiniKit. The backend then polls the Developer Portal to verify the transaction.

**Auth:** None (transaction verification serves as auth)

**Request:**
```json
{
  "transaction_id": "0x1234...",
  "reference": "abc123..."
}
```

**Flow:**
1. Find stake by `reference` (invoice_id)
2. If already `confirmed`, return success (idempotency)
3. Poll Developer Portal API: `GET /api/v2/minikit/transaction/{transaction_id}?app_id={APP_ID}`
4. Verify `reference` matches
5. Update stake based on transaction `status`:
   - `"mined"` → `payment_status = "confirmed"`
   - `"failed"` → `payment_status = "failed"`
   - `"pending"` → leave as `"initiated"`

**Response (200):**
```json
{
  "status": "ok",
  "stake_id": 1,
  "payment_status": "confirmed"
}
```

## Frontend Integration

### 1. Install MiniKit SDK

```bash
npm install @worldcoin/minikit-js
```

### 2. Initialize MiniKit (in app root)

```typescript
import { MiniKit } from '@worldcoin/minikit-js';

useEffect(() => {
  MiniKit.install();
}, []);
```

### 3. Stake Flow

```typescript
import { MiniKit } from '@worldcoin/minikit-js';
import type { MiniAppPaymentSuccessPayload } from '@worldcoin/minikit-js';

async function stakeToPrediction(
  predictionId: number,
  side: 'for' | 'against',
  amount: string,
  currency: 'WLD' | 'USDC'
) {
  // 1. Create invoice
  const invoiceRes = await fetch('/api/stakes/create-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prediction_id: predictionId,
      side,
      amount,
      currency,
    }),
  });

  if (!invoiceRes.ok) {
    throw new Error(await invoiceRes.text());
  }

  const { stake, payment } = await invoiceRes.json();

  // 2. Call MiniKit Pay
  const { finalPayload } = await MiniKit.commandsAsync.pay({
    reference: payment.reference,
    to: payment.to,
    tokens: payment.tokens,
    description: payment.description,
  });

  if (finalPayload.status === 'error') {
    throw new Error(finalPayload.error_code);
  }

  const payload = finalPayload as MiniAppPaymentSuccessPayload;

  // 3. Send transaction_id to webhook
  await fetch('/api/webhooks/payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transaction_id: payload.transaction_id,
      reference: payment.reference,
    }),
  });

  // 4. Poll status until confirmed
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const statusRes = await fetch(`/api/stakes/${stake.id}/status`);
    const { stake: updatedStake } = await statusRes.json();

    if (updatedStake.status === 'confirmed') {
      return { success: true, stakeId: stake.id };
    }

    if (updatedStake.status === 'failed') {
      throw new Error('Payment failed');
    }
  }

  throw new Error('Payment confirmation timeout');
}
```

## Local Testing

Since MiniKit only works inside the World App webview, full end-to-end testing locally requires either:

### Option 1: Manual DB Simulation (Fastest)

```bash
# 1. Start server
npm run dev

# 2. Create invoice via API
curl -X POST http://localhost:3000/api/stakes/create-invoice \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{"prediction_id":1,"side":"for","amount":"5.0","currency":"WLD"}'

# 3. Manually mark as confirmed
sqlite3 sqlite.db "UPDATE stakes SET payment_status='confirmed' WHERE id=1;"

# 4. Verify stake appears in prediction
curl http://localhost:3000/api/predictions/1
```

### Option 2: Ngrok + Real World App (Full Integration)

```bash
# 1. Start local server
npm run dev

# 2. Expose via ngrok
ngrok http 3000

# 3. Update Developer Portal mini app URL to ngrok URL

# 4. Open mini app in World App via deeplink
# https://worldcoin.org/mini-app?app_id=YOUR_APP_ID

# 5. Test full flow in World App
```

### Option 3: Run Test Script

```bash
./test-payment-flow.sh
```

This simulates the full flow with DB manipulation instead of real payments.

## Security Considerations

1. **No client-side confirmation**: Stakes are ONLY marked confirmed after backend verifies via Developer Portal API
2. **Idempotency**: Webhook can be called multiple times safely (checks if already confirmed)
3. **Reference uniqueness**: Each stake has unique `invoice_id` to prevent replay attacks
4. **Amount verification**: Backend converts human amount to base units (prevents frontend manipulation)
5. **Timeframe check**: Expired predictions reject new stakes
6. **Duplicate prevention**: DB constraint prevents user from staking same side twice

## Transaction Polling Details

The Developer Portal API returns:

```json
{
  "status": "pending" | "mined" | "failed",
  "transaction_hash": "0x...",
  "reference": "abc123...",
  "to": "0xRecipient...",
  "tokens": [{
    "symbol": "WLD",
    "token_amount": "5000000000000000000"
  }]
}
```

Polling typically takes 5-30 seconds for a transaction to reach `"mined"` status on World Chain.

## Token Decimals

- **WLD**: 18 decimals
- **USDC**: 6 decimals

Example conversions:
- `"5.0" WLD` → `"5000000000000000000"` (base units)
- `"10.5" USDC` → `"10500000"` (base units)

The `toBaseUnits()` helper in `lib/payments.ts` handles this automatically.

## Production Checklist

- [ ] Set real `RECIPIENT_ADDRESS` in production env
- [ ] Whitelist recipient address in Developer Portal
- [ ] Use production `APP_ID` (not `app_staging_`)
- [ ] Set mini app URL to production domain
- [ ] Rotate `NONCE_SECRET` to 32+ char random value
- [ ] Use Postgres instead of SQLite (set `DATABASE_URL`)
- [ ] Set up monitoring/alerts for failed payments
- [ ] Add retry logic for Developer Portal API calls (currently no retry)
- [ ] Consider adding webhook signature verification if Developer Portal adds support
