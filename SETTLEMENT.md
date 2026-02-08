# Settlement & Reputation System

## Overview

Predictions are settled when their `timeframe_end` passes. Settlement fetches the actual price from CoinGecko, determines winners/losers, calculates payouts, and updates reputation scores.

## Data Changes During Settlement

When a prediction is settled, the following database changes occur:

### `predictions` table

| Field | Before | After |
|-------|--------|-------|
| `status` | `"open"` | `"settled"` |
| `settlement_price` | `null` | `"2060.7349645674162"` (USD price) |
| `settlement_timestamp` | `null` | Unix timestamp (seconds) |

### `reputation_events` table

New rows are inserted for:
1. **Creator** — One event with `outcome` = `"win"` or `"loss"` and `delta_score` = `±confidence`
2. **Each staker** — One event per user with `outcome` and `delta_score` based on their bet

Example after settling prediction #1 (confidence=75, creator wrong):
```
user_id | prediction_id | outcome | delta_score
--------|---------------|---------|------------
1       | 1             | loss    | -75         (creator)
1       | 1             | loss    | -75         (staker, bet FOR)
3       | 1             | win     | 75          (staker, bet AGAINST)
```

### `stakes` table

**No changes** — stakes remain as-is for historical record. Only `status="confirmed"` stakes are counted.

## Reputation Formula

### For Predictions (Creators)

```
delta_score = ±confidence

If (direction = "up" AND price went up) OR (direction = "down" AND price went down):
  outcome = "win"
  delta_score = +confidence
Else:
  outcome = "loss"
  delta_score = -confidence
```

### For Stakes (Backers)

```
delta_score = ±confidence (same as prediction confidence)

If user staked on winning side (FOR when creator correct, AGAINST when creator wrong):
  outcome = "win"
  delta_score = +confidence
Else:
  outcome = "loss"
  delta_score = -confidence
```

### Aggregate Reputation Score

```
reputation_score = SUM(delta_score) across all reputation_events for a user

win_rate = (wins / settled_predictions) * 100

Example:
- User makes 3 predictions: 80% confidence (correct), 90% confidence (wrong), 70% confidence (correct)
- Reputation score = +80 - 90 + 70 = +60
- Win rate = 2/3 = 66.7%
```

## Price Oracle

### PriceProvider Interface

```typescript
interface PriceProvider {
  getPriceAt(symbol: string, timestamp: Date): Promise<number | null>;
  getCurrentPrice(symbol: string): Promise<number | null>;
}
```

### CoinGecko Implementation

**API:** `https://api.coingecko.com/api/v3`

**Rate limit:** 10-50 calls/minute (free tier)

**Supported assets:**
- BTC → `bitcoin`
- ETH → `ethereum`
- WLD → `worldcoin-wld`
- USDC → `usd-coin`
- SOL → `solana`
- MATIC → `matic-network`

**Historical price endpoint:**
```
GET /coins/{id}/history?date=DD-MM-YYYY
Returns: { market_data: { current_price: { usd: 2060.73 } } }
```

**Note:** CoinGecko's historical data is daily snapshots at ~00:00 UTC. For precise intraday settlement, consider upgrading to CoinGecko Pro or integrating a different oracle (e.g., Chainlink, Pyth).

## Payout Calculation

### Winner Payout Formula

```
total_winning_pool = SUM(stakes with winning side, same currency)
total_losing_pool = SUM(stakes with losing side, same currency)

For each winner:
  payout = stake_amount + (stake_amount / total_winning_pool) * total_losing_pool
```

### Example

**Prediction:** ETH up, confidence 75%
**Stakes:**
- User A: 5 WLD FOR (betting creator correct)
- User B: 10 WLD AGAINST (betting creator wrong)

**Settlement:** ETH price went down → creator wrong → AGAINST side wins

**Calculation:**
- Total winning pool (AGAINST): 10 WLD
- Total losing pool (FOR): 5 WLD
- User B payout: 10 + (10/10) * 5 = 15 WLD

**Result:**
- User B gets 15 WLD (their 10 + 5 from loser)
- User A loses 5 WLD (goes to winner)

### Multi-Currency Pools

Pools are segregated by currency. WLD stakes don't mix with USDC stakes.

```
Prediction has:
- 5 WLD FOR
- 10 WLD AGAINST
- 3 USDC FOR
- 7 USDC AGAINST

If AGAINST wins:
- WLD winners get 15 WLD total (proportional to their WLD stakes)
- USDC winners get 10 USDC total (proportional to their USDC stakes)
```

## Admin Settlement Endpoint

### POST /api/predictions/:id/settle

Manually settle a prediction (for hackathon MVP — avoids building scheduler).

**Auth:** Requires admin access

**Admin check:**
```env
ADMIN_ALIEN_SUBJECTS=0xAdminWallet1,0xAdminWallet2
```

Only `alien_subject` addresses in this comma-separated list can settle predictions.

**Request:**
```bash
curl -X POST http://localhost:3000/api/predictions/1/settle \
  -H "Cookie: session=ADMIN_SESSION_COOKIE"
```

**Response (200):**
```json
{
  "status": "settled",
  "result": {
    "predictionId": 1,
    "settlementPrice": "2060.7349645674162",
    "outcome": "creator_correct" | "creator_wrong",
    "winnersCount": 1,
    "losersCount": 1,
    "creatorReputationDelta": 75,
    "winners": [{
      "userId": 3,
      "alienSubject": "0x...",
      "side": "against",
      "stakeAmount": "10",
      "currency": "WLD",
      "payout": "15",
      "reputationDelta": 75
    }],
    "losers": [{
      "userId": 1,
      "alienSubject": "0x...",
      "side": "for",
      "stakeAmount": "5",
      "currency": "WLD",
      "reputationDelta": -75
    }]
  }
}
```

**Errors:**
- `403` — Not an admin
- `400` — Prediction already settled or invalid ID
- `500` — Price oracle failure or database error

## What the UI Should Display After Settlement

### Prediction Detail Page

```
╔════════════════════════════════════════════════════════╗
║  ETH will go UP by Feb 1, 2026                          ║
║  Confidence: 75%                           [SETTLED]     ║
╠════════════════════════════════════════════════════════╣
║  Settlement Price: $2,060.73 (Feb 8, 2026 22:00 UTC)   ║
║  Outcome: Creator was WRONG (price went down)          ║
╠════════════════════════════════════════════════════════╣
║  Total Staked:                                          ║
║    FOR:     5 WLD  (1 backer)                          ║
║    AGAINST: 10 WLD (1 backer)                          ║
║                                                         ║
║  Winners (AGAINST side):                                ║
║    0xuser2... — Staked 10 WLD → Payout 15 WLD ✓        ║
║                  Reputation: +75                        ║
║                                                         ║
║  Losers (FOR side):                                     ║
║    0xtest1... — Staked 5 WLD → Lost 5 WLD ✗            ║
║                  Reputation: -75                        ║
╚════════════════════════════════════════════════════════╝
```

### Creator Profile

```
╔════════════════════════════════════════╗
║  0xtest1234...                          ║
║  Reputation Score: -75                  ║
║  Win Rate: 0% (0 wins, 1 loss)         ║
║  Total Predictions: 1 (1 settled)      ║
╠════════════════════════════════════════╣
║  Recent Predictions:                    ║
║    ✗ ETH up (Feb 8) — Settled: WRONG   ║
╚════════════════════════════════════════╝
```

### Leaderboard

```
╔════════════════════════════════════════════════════════════╗
║  Rank | User          | Score | Win Rate | Settled        ║
╠════════════════════════════════════════════════════════════╣
║   1   | 0xuser2...    | +75   | 100%     | 1 win, 0 loss ║
║   2   | 0xtest1...    | -75   | 0%       | 0 win, 1 loss ║
╚════════════════════════════════════════════════════════════╝
```

### Notification/Toast After Settlement

```
🎉 Prediction Settled!

ETH prediction by 0xtest1... has been settled.
Settlement Price: $2,060.73

[View Results]
```

## Production Considerations

### Automated Settlement

For production, replace the manual admin endpoint with automated settlement:

**Option 1: Cron Job**
```bash
# Every hour, check for predictions past timeframe_end
*/5 * * * * curl -X POST http://localhost:3000/api/cron/settle-expired
```

**Option 2: Background Worker**
```typescript
setInterval(async () => {
  const expired = await getExpiredPredictions();
  for (const pred of expired) {
    await settlePrediction(pred.id);
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

### Price Oracle Reliability

**Fallback strategy:**
1. Try CoinGecko
2. If fails, try backup oracle (e.g., CoinMarketCap, Binance API)
3. If all fail, mark prediction as `status="cancelled"` and refund stakes

**Implement in production:**
```typescript
async function getPriceWithFallback(symbol: string, timestamp: Date) {
  const providers = [
    new CoinGeckoProvider(),
    new CoinMarketCapProvider(),
    new BinanceProvider(),
  ];

  for (const provider of providers) {
    try {
      const price = await provider.getPriceAt(symbol, timestamp);
      if (price !== null) return price;
    } catch (err) {
      console.warn(`Provider ${provider.constructor.name} failed:`, err);
    }
  }

  throw new Error("All price providers failed");
}
```

### Payout Implementation

**Current:** Payout is calculated but not automatically transferred.

**For production:**

If automated payouts are desired, implement via MiniKit `sendTransaction`:

```typescript
import { MiniKit } from '@worldcoin/minikit-js';

async function payoutWinner(
  recipientAddress: string,
  amount: string,
  currency: 'WLD' | 'USDC'
) {
  // This requires MiniKit to be running in World App context
  // Backend cannot directly send transactions — needs user approval

  // Alternative: Use a custodial wallet on backend
  // Or: Implement claim mechanism where winners manually claim
}
```

**Recommended approach for hackathon:**
- Display calculated payouts in UI
- Show "Claim Payout" button for winners
- Winners call `MiniKit.commandsAsync.sendTransaction()` to transfer from pool contract
- Or: Manual admin payouts post-hackathon

### Gas Costs

Settlement triggers database writes but no on-chain transactions (price fetch is off-chain). Gas costs are zero for settlement itself.

Payouts (if automated) would incur gas, but World App sponsors gas for users.

## Testing Settlement Locally

```bash
# 1. Create prediction (future timeframe)
curl -X POST http://localhost:3000/api/predictions \
  -H "Cookie: session=..." \
  -d '{"asset_symbol":"ETH","direction":"up","timeframe_end":FUTURE,"confidence":80}'

# 2. Create stakes
curl -X POST http://localhost:3000/api/stakes/create-invoice \
  -H "Cookie: session=..." \
  -d '{"prediction_id":1,"side":"for","amount":"5.0","currency":"WLD"}'

# 3. Confirm stakes (simulate payment)
sqlite3 sqlite.db "UPDATE stakes SET payment_status='confirmed';"

# 4. Backdate prediction to test settlement
sqlite3 sqlite.db "UPDATE predictions SET timeframe_end=strftime('%s','now','-1 day') WHERE id=1;"

# 5. Settle as admin
curl -X POST http://localhost:3000/api/predictions/1/settle \
  -H "Cookie: session=ADMIN_SESSION"

# 6. Check results
curl http://localhost:3000/api/predictions/1
curl http://localhost:3000/api/leaderboard
```

## Settlement Algorithm Pseudocode

```python
def settle_prediction(prediction_id):
  # 1. Fetch prediction
  prediction = db.get(prediction_id)
  if prediction.status != "open":
    raise Error("Already settled")

  # 2. Get price at timeframe_end
  settlement_price = oracle.get_price_at(
    prediction.asset_symbol,
    prediction.timeframe_end
  )

  # 3. Get creation price for comparison
  creation_price = oracle.get_price_at(
    prediction.asset_symbol,
    prediction.created_at
  )

  # 4. Determine outcome
  price_went_up = settlement_price > creation_price
  creator_correct = (
    (prediction.direction == "up" and price_went_up) or
    (prediction.direction == "down" and not price_went_up)
  )

  # 5. Get confirmed stakes
  stakes = db.get_stakes(prediction_id, status="confirmed")

  # 6. Separate winners/losers
  winning_side = "for" if creator_correct else "against"
  winners = [s for s in stakes if s.side == winning_side]
  losers = [s for s in stakes if s.side != winning_side]

  # 7. Calculate payouts (per currency)
  for currency in ["WLD", "USDC"]:
    winning_pool = sum([s.amount for s in winners if s.currency == currency])
    losing_pool = sum([s.amount for s in losers if s.currency == currency])

    for winner in [w for w in winners if w.currency == currency]:
      winner.payout = winner.amount + (winner.amount / winning_pool) * losing_pool

  # 8. Update database
  prediction.status = "settled"
  prediction.settlement_price = settlement_price
  prediction.settlement_timestamp = now()

  # 9. Create reputation events
  create_reputation_event(
    user_id=prediction.creator_id,
    outcome="win" if creator_correct else "loss",
    delta_score=prediction.confidence if creator_correct else -prediction.confidence
  )

  for winner in winners:
    create_reputation_event(
      user_id=winner.user_id,
      outcome="win",
      delta_score=prediction.confidence
    )

  for loser in losers:
    create_reputation_event(
      user_id=loser.user_id,
      outcome="loss",
      delta_score=-prediction.confidence
    )

  return {
    winners: winners,
    losers: losers,
    outcome: "creator_correct" if creator_correct else "creator_wrong"
  }
```
