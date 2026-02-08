// ─── Price Oracle Interface ─────────────────────────────────────────────────

export interface PriceProvider {
  /**
   * Get the price of an asset at a specific timestamp.
   * Returns price in USD.
   */
  getPriceAt(symbol: string, timestamp: Date): Promise<number | null>;

  /**
   * Get the current price of an asset.
   */
  getCurrentPrice(symbol: string): Promise<number | null>;
}

// ─── CoinGecko Provider ─────────────────────────────────────────────────────

/**
 * CoinGecko Free API implementation.
 * Rate limit: 10-50 calls/min (public API).
 * Supports: BTC, ETH, WLD, and 10,000+ other assets.
 */
export class CoinGeckoProvider implements PriceProvider {
  private baseUrl = "https://api.coingecko.com/api/v3";

  // Map common symbols to CoinGecko IDs
  private symbolToId: Record<string, string> = {
    BTC: "bitcoin",
    ETH: "ethereum",
    WLD: "worldcoin-wld",
    USDC: "usd-coin",
    USDT: "tether",
    SOL: "solana",
    MATIC: "matic-network",
  };

  async getPriceAt(symbol: string, timestamp: Date): Promise<number | null> {
    const coinId = this.symbolToId[symbol.toUpperCase()];
    if (!coinId) {
      console.error(`Unknown symbol: ${symbol}`);
      return null;
    }

    // CoinGecko requires dates in DD-MM-YYYY format
    const date = this.formatDate(timestamp);

    try {
      // Use /coins/{id}/history endpoint for historical data
      const url = `${this.baseUrl}/coins/${coinId}/history?date=${date}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.error(
          `CoinGecko API error: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const data = await response.json();

      // Price is nested in market_data.current_price.usd
      const price = data.market_data?.current_price?.usd;

      if (typeof price !== "number") {
        console.error(`No price data for ${symbol} on ${date}`);
        return null;
      }

      return price;
    } catch (err) {
      console.error(`Failed to fetch price for ${symbol} at ${date}:`, err);
      return null;
    }
  }

  async getCurrentPrice(symbol: string): Promise<number | null> {
    const coinId = this.symbolToId[symbol.toUpperCase()];
    if (!coinId) {
      console.error(`Unknown symbol: ${symbol}`);
      return null;
    }

    try {
      const url = `${this.baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.error(
          `CoinGecko API error: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const data = await response.json();
      const price = data[coinId]?.usd;

      if (typeof price !== "number") {
        console.error(`No price data for ${symbol}`);
        return null;
      }

      return price;
    } catch (err) {
      console.error(`Failed to fetch current price for ${symbol}:`, err);
      return null;
    }
  }

  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createPriceProvider(): PriceProvider {
  // Could add support for other providers via env var
  return new CoinGeckoProvider();
}
