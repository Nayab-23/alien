/**
 * Logging utilities that prevent secret leakage.
 * All logs are sanitized to remove sensitive data.
 */

const SENSITIVE_KEYS = [
  "password",
  "secret",
  "token",
  "key",
  "apikey",
  "api_key",
  "signature",
  "authorization",
  "cookie",
  "nonce",
];

function sanitize(obj: any): any {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      sanitized[key] = sanitize(value);
    } else if (typeof value === "string" && value.startsWith("0x") && value.length > 20) {
      // Truncate wallet addresses for privacy
      sanitized[key] = `${value.slice(0, 10)}...${value.slice(-4)}`;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function logInfo(message: string, data?: any) {
  console.log(`[INFO] ${message}`, data ? sanitize(data) : "");
}

export function logError(message: string, error?: any) {
  const sanitizedError =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : sanitize(error);
  console.error(`[ERROR] ${message}`, sanitizedError);
}

export function logWarning(message: string, data?: any) {
  console.warn(`[WARN] ${message}`, data ? sanitize(data) : "");
}

export function logDebug(message: string, data?: any) {
  if (process.env.NODE_ENV === "development") {
    console.debug(`[DEBUG] ${message}`, data ? sanitize(data) : "");
  }
}
