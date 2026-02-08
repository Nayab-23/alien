# Frontend Implementation Guide

## Overview

Mobile-first React/Next.js app using MiniKit SDK for World ID auth and payments.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **SDK:** `@worldcoin/minikit-js`
- **State:** React hooks (no external store needed for MVP)

## Screen List & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | [app/page.tsx](app/page.tsx) | Home feed with prediction list + auth gate |
| `/predictions/[id]` | `app/predictions/[id]/page.tsx` | Prediction detail with stake CTA |
| `/create` | `app/create/page.tsx` | Create prediction form |
| `/leaderboard` | `app/leaderboard/page.tsx` | Top users by reputation score |

## Component Breakdown

### Core Components

| File | Purpose |
|------|---------|
| [components/MiniKitProvider.tsx](components/MiniKitProvider.tsx) | Auth context + MiniKit install |
| `components/StakeModal.tsx` | Stake flow (side/amount/payment) |
| `components/PredictionCard.tsx` | Reusable prediction card |
| `components/LoadingSpinner.tsx` | Loading state |

### Layout

| File | Purpose |
|------|---------|
| [app/layout.tsx](app/layout.tsx) | Root layout with MiniKitProvider |
| [app/globals.css](app/globals.css) | Tailwind base + utility classes |

## Auth Flow

### Sign In (World ID Wallet Auth)

```typescript
// In MiniKitProvider.tsx
async function signIn() {
  // 1. Get nonce from backend
  const { nonce } = await fetch("/api/nonce").then(r => r.json());

  // 2. Sign with MiniKit
  const { finalPayload } = await MiniKit.commandsAsync.walletAuth({ nonce });

  // 3. Verify on backend
  await fetch("/api/auth/siwe", {
    method: "POST",
    body: JSON.stringify({ payload: finalPayload, nonce }),
  });

  // 4. Update context
  setIsAuthenticated(true);
}
```

### Auth Context API

```typescript
const { isAuthenticated, user, isLoading, signIn, signOut } = useAuth();

// user = { id: number, alienSubject: string } | null
```

## Stake Flow Implementation

### 1. StakeModal Component

Create `components/StakeModal.tsx`:

```typescript
"use client";

import { useState } from "react";
import { MiniKit, type MiniAppPaymentSuccessPayload } from "@worldcoin/minikit-js";

export function StakeModal({
  predictionId,
  onClose,
  onSuccess
}: {
  predictionId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [side, setSide] = useState<"for" | "against">("for");
  const [amount, setAmount] = useState("5.0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleStake() {
    setIsLoading(true);
    setError("");

    try {
      // 1. Create invoice
      const invoiceRes = await fetch("/api/stakes/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prediction_id: predictionId,
          side,
          amount,
          currency: "WLD",
        }),
      });

      if (!invoiceRes.ok) {
        throw new Error(await invoiceRes.text());
      }

      const { stake, payment } = await invoiceRes.json();

      // 2. Call MiniKit Pay
      const { finalPayload } = await MiniKit.commandsAsync.pay(payment);

      if (finalPayload.status === "error") {
        throw new Error(finalPayload.error_code);
      }

      const payload = finalPayload as MiniAppPaymentSuccessPayload;

      // 3. Send transaction_id to webhook
      await fetch("/api/webhooks/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

        if (updatedStake.status === "confirmed") {
          onSuccess();
          return;
        }

        if (updatedStake.status === "failed") {
          throw new Error("Payment failed");
        }
      }

      throw new Error("Payment confirmation timeout");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stake failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6">
        <h2 className="text-2xl font-bold mb-4">Stake on Prediction</h2>

        {/* Side selector */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setSide("for")}
            className={`btn ${side === "for" ? "btn-primary" : "btn-secondary"}`}
          >
            FOR (creator correct)
          </button>
          <button
            onClick={() => setSide("against")}
            className={`btn ${side === "against" ? "btn-primary" : "btn-secondary"}`}
          >
            AGAINST (creator wrong)
          </button>
        </div>

        {/* Amount input */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Amount (WLD)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            step="0.1"
            min="0.1"
          />
          <p className="text-xs text-gray-500 mt-1">Minimum: 0.1 WLD</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-800 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleStake}
            disabled={isLoading}
            className="btn btn-primary flex-1"
          >
            {isLoading ? "Processing..." : "Stake"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 2. Prediction Detail Page with Stake Button

Create `app/predictions/[id]/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/MiniKitProvider";
import { StakeModal } from "@/components/StakeModal";

export default function PredictionDetail() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const [prediction, setPrediction] = useState(null);
  const [showStakeModal, setShowStakeModal] = useState(false);

  useEffect(() => {
    fetch(`/api/predictions/${id}`)
      .then(r => r.json())
      .then(data => setPrediction(data.prediction));
  }, [id]);

  if (!prediction) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b p-4">
        <button onClick={() => history.back()} className="text-primary">← Back</button>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <div className="card">
          <h1 className="text-3xl font-bold mb-2">{prediction.assetSymbol}</h1>
          <div className="flex items-center gap-2 mb-4">
            <span className={`badge ${prediction.direction === "up" ? "badge-success" : "badge-error"}`}>
              {prediction.direction === "up" ? "↑ UP" : "↓ DOWN"}
            </span>
            <span className="badge badge-warning">{prediction.status}</span>
            <span className="text-primary font-bold">{prediction.confidence}%</span>
          </div>

          {/* Stakes summary */}
          <div className="border-t border-b py-4 my-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-600 text-sm">FOR</div>
                <div className="font-bold text-green-600">
                  {(Number(prediction.stakeSummary.totalFor) / 1e18).toFixed(2)} WLD
                </div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">AGAINST</div>
                <div className="font-bold text-red-600">
                  {(Number(prediction.stakeSummary.totalAgainst) / 1e18).toFixed(2)} WLD
                </div>
              </div>
            </div>
          </div>

          {/* Stake button (only if open) */}
          {prediction.status === "open" && isAuthenticated && (
            <button
              onClick={() => setShowStakeModal(true)}
              className="btn btn-primary w-full"
            >
              Place Stake
            </button>
          )}

          {/* Stakes list */}
          {prediction.stakes.length > 0 && (
            <div className="mt-6">
              <h3 className="font-bold mb-2">Stakes</h3>
              <div className="space-y-2">
                {prediction.stakes.map((stake) => (
                  <div key={stake.id} className="flex justify-between text-sm">
                    <span>{stake.side.toUpperCase()}</span>
                    <span>{(Number(stake.amount) / 1e18).toFixed(2)} {stake.currency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {showStakeModal && (
        <StakeModal
          predictionId={Number(id)}
          onClose={() => setShowStakeModal(false)}
          onSuccess={() => {
            setShowStakeModal(false);
            // Refresh prediction
            fetch(`/api/predictions/${id}`)
              .then(r => r.json())
              .then(data => setPrediction(data.prediction));
          }}
        />
      )}
    </div>
  );
}
```

### 3. Create Prediction Form

Create `app/create/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/MiniKitProvider";

export default function CreatePrediction() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState({
    asset_symbol: "ETH",
    direction: "up",
    confidence: 75,
    days: 7,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isAuthenticated) {
    return <div className="p-4">Please sign in to create predictions.</div>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const timeframe_end = Math.floor(Date.now() / 1000) + form.days * 86400;

      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_symbol: form.asset_symbol,
          direction: form.direction,
          timeframe_end,
          confidence: form.confidence,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const { prediction } = await res.json();
      router.push(`/predictions/${prediction.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b p-4">
        <button onClick={() => router.back()} className="text-primary">← Back</button>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Create Prediction</h1>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block font-medium mb-2">Asset</label>
            <select
              value={form.asset_symbol}
              onChange={e => setForm({ ...form, asset_symbol: e.target.value })}
              className="input"
            >
              <option value="ETH">ETH</option>
              <option value="BTC">BTC</option>
              <option value="WLD">WLD</option>
            </select>
          </div>

          <div>
            <label className="block font-medium mb-2">Direction</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, direction: "up" })}
                className={`btn ${form.direction === "up" ? "btn-primary" : "btn-secondary"}`}
              >
                ↑ UP
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, direction: "down" })}
                className={`btn ${form.direction === "down" ? "btn-primary" : "btn-secondary"}`}
              >
                ↓ DOWN
              </button>
            </div>
          </div>

          <div>
            <label className="block font-medium mb-2">Timeframe</label>
            <select
              value={form.days}
              onChange={e => setForm({ ...form, days: Number(e.target.value) })}
              className="input"
            >
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          <div>
            <label className="block font-medium mb-2">Confidence: {form.confidence}%</label>
            <input
              type="range"
              min="1"
              max="100"
              value={form.confidence}
              onChange={e => setForm({ ...form, confidence: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          {error && <div className="bg-red-50 text-red-800 p-3 rounded">{error}</div>}

          <button type="submit" disabled={isLoading} className="btn btn-primary w-full">
            {isLoading ? "Creating..." : "Create Prediction"}
          </button>
        </form>
      </main>
    </div>
  );
}
```

### 4. Leaderboard

Create `app/leaderboard/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Leaderboard() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch("/api/leaderboard?limit=50")
      .then(r => r.json())
      .then(data => setUsers(data.leaderboard));
  }, []);

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b p-4">
        <Link href="/" className="text-primary">← Home</Link>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Leaderboard</h1>

        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.userId} className="card flex items-center gap-4">
              <div className="text-2xl font-bold text-gray-400 w-8">
                #{user.rank}
              </div>
              <div className="flex-1">
                <div className="font-mono text-sm text-gray-600">
                  {user.alienSubject.slice(0, 10)}...
                </div>
                <div className="text-xs text-gray-500">
                  {user.settledPredictions} settled • {user.wins}W {user.losses}L
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${user.reputationScore >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {user.reputationScore > 0 ? "+" : ""}{user.reputationScore}
                </div>
                <div className="text-xs text-gray-500">{user.winRate.toFixed(0)}% win rate</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
```

## State Management

**Approach:** React hooks (no Redux/Zustand needed for MVP)

**Global state:**
- Auth: `useAuth()` context from MiniKitProvider
- All other state: component-local with `useState` + `useEffect`

**Why no external store:**
- Simple data flow (fetch → display)
- No complex cross-component state
- MiniKit handles payment state internally

## Loading & Error States

### Loading Pattern

```typescript
if (isLoading) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
```

### Error Pattern

```typescript
{error && (
  <div className="bg-red-50 text-red-800 p-4 rounded-lg">
    {error}
  </div>
)}
```

### Payment Flow Loading

```typescript
<button disabled={isLoading} className="btn btn-primary">
  {isLoading ? (
    <>
      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      Processing...
    </>
  ) : (
    "Place Stake"
  )}
</button>
```

## Mobile Responsiveness

**Tailwind breakpoints used:**
- `sm:` (640px+) — tablet/desktop tweaks
- Default — mobile-first (320-640px)

**Key patterns:**
- `max-w-2xl mx-auto` — center content with max width
- `fixed bottom-0` — iOS-safe bottom nav
- `rounded-t-2xl sm:rounded-2xl` — modal bottom-sheet on mobile, centered on desktop
- `grid-cols-2` — side-by-side buttons/stats
- Touch targets: min 44px (`py-2 px-4` = ~44px height)

## Testing

```bash
npm run dev

# Open in browser (for local dev):
http://localhost:3000

# Open in World App (for full integration):
# 1. Expose via ngrok
ngrok http 3000

# 2. Update mini app URL in Developer Portal

# 3. Open in World App
https://worldcoin.org/mini-app?app_id=YOUR_APP_ID
```

## Build & Deploy

```bash
npm run build
npm run start

# Deploy to Vercel (recommended):
vercel deploy

# Or any Node.js host that supports Next.js
```

## File Structure Summary

```
app/
├── layout.tsx            # Root with MiniKitProvider
├── globals.css           # Tailwind + utilities
├── page.tsx              # Home feed ✓ IMPLEMENTED
├── create/
│   └── page.tsx          # Create prediction form
├── predictions/
│   └── [id]/
│       └── page.tsx      # Prediction detail + stake
└── leaderboard/
    └── page.tsx          # Top users

components/
├── MiniKitProvider.tsx   # Auth context ✓ IMPLEMENTED
├── StakeModal.tsx        # Stake flow modal
├── PredictionCard.tsx    # Reusable card (optional)
└── LoadingSpinner.tsx    # Loading component (optional)
```

## Next Steps After This Guide

1. Create the remaining page files listed above
2. Create `components/StakeModal.tsx` with the payment flow
3. Test in browser for layout/UX
4. Test in World App for MiniKit integration
5. Add error boundaries for production
6. Add analytics (optional)
