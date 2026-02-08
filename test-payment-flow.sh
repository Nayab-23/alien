#!/bin/bash
# Test script for stake-with-payments flow
# Run with: ./test-payment-flow.sh

set -e

echo "=== Stake-with-Payments Flow Test ==="
echo ""

# Generate session cookie
SESSION=$(node -e "
const crypto = require('crypto');
const secret = 'local-dev-secret-minimum-16-chars';
const subject = '0xtest1234567890abcdef1234567890abcdef1234';
const sig = crypto.createHmac('sha256', secret).update(subject).digest('hex');
console.log('session=' + subject + '.' + sig);
")

# Create a prediction
FUTURE=$(node -e "console.log(Math.floor(Date.now()/1000) + 86400*30)")

echo "1. Creating a prediction..."
PRED_ID=$(curl -s -X POST http://localhost:3000/api/predictions \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION" \
  -d "{\"asset_symbol\":\"ETH\",\"direction\":\"up\",\"timeframe_end\":$FUTURE,\"confidence\":80}" \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).prediction.id")

echo "   Created prediction ID: $PRED_ID"
echo ""

# Create stake invoice
echo "2. Creating stake invoice (5 WLD, side=for)..."
INVOICE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/stakes/create-invoice \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION" \
  -d "{\"prediction_id\":$PRED_ID,\"side\":\"for\",\"amount\":\"5.0\",\"currency\":\"WLD\"}")

STAKE_ID=$(echo "$INVOICE_RESPONSE" | node -pe "JSON.parse(require('fs').readFileSync(0)).stake.id")
REFERENCE=$(echo "$INVOICE_RESPONSE" | node -pe "JSON.parse(require('fs').readFileSync(0)).stake.reference")
AMOUNT_BASE_UNITS=$(echo "$INVOICE_RESPONSE" | node -pe "JSON.parse(require('fs').readFileSync(0)).payment.tokens[0].token_amount")

echo "   Stake ID: $STAKE_ID"
echo "   Reference: $REFERENCE"
echo "   Amount (base units): $AMOUNT_BASE_UNITS"
echo ""

# Check stake status (should be "initiated")
echo "3. Checking stake status (should be 'initiated')..."
STATUS=$(curl -s http://localhost:3000/api/stakes/$STAKE_ID/status \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).stake.status")
echo "   Status: $STATUS"
echo ""

# Frontend would now call MiniKit.commandsAsync.pay() here
echo "4. [Frontend] Would now call MiniKit.commandsAsync.pay() with:"
echo "   {
     reference: '$REFERENCE',
     to: '\$RECIPIENT_ADDRESS',
     tokens: [{ symbol: 'WLD', token_amount: '$AMOUNT_BASE_UNITS' }],
     description: 'Stake 5.0 WLD for prediction #$PRED_ID'
   }"
echo ""

# Simulate transaction completion (in real flow, this comes from MiniKit)
echo "5. [Simulated] User completes payment in World App..."
echo "   MiniKit returns: { transaction_id: 'real-tx-hash-123' }"
echo ""

# Frontend posts webhook with transaction_id
echo "6. [Backend] Webhook receives notification..."
echo "   POST /api/webhooks/payment"
echo "   { transaction_id: 'real-tx-hash-123', reference: '$REFERENCE' }"
echo ""
echo "   Backend polls Developer Portal API to verify transaction status."
echo "   (In this test, we'll manually mark as confirmed since we don't have real tx)"
echo ""

# Manually confirm stake (simulating successful webhook verification)
echo "7. [Test] Manually confirming stake..."
sqlite3 sqlite.db "UPDATE stakes SET payment_status='confirmed' WHERE id=$STAKE_ID;"
echo "   Stake marked as confirmed"
echo ""

# Check updated status
echo "8. Checking stake status (should be 'confirmed')..."
STATUS=$(curl -s http://localhost:3000/api/stakes/$STAKE_ID/status \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).stake.status")
echo "   Status: $STATUS"
echo ""

# Check prediction now shows the stake
echo "9. Checking prediction stake summary..."
STAKE_SUMMARY=$(curl -s http://localhost:3000/api/predictions/$PRED_ID \
  | node -pe "const d=JSON.parse(require('fs').readFileSync(0)); JSON.stringify({ count: d.prediction.stakeSummary.stakeCount, totalFor: d.prediction.stakeSummary.totalFor })")
echo "   $STAKE_SUMMARY"
echo ""

echo "=== Test Complete ==="
echo ""
echo "Summary:"
echo "- Stake created with status=initiated"
echo "- Payment reference sent to MiniKit Pay"
echo "- Webhook verified transaction (simulated)"
echo "- Stake marked confirmed"
echo "- Prediction aggregates include confirmed stake"
