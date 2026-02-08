import { db } from "@/lib/db";

export async function GET() {
  try {
    // Check database connection
    db.select().from(require("@/lib/db/schema").users).limit(1).all();

    // Check required env vars
    const requiredEnv = [
      "NONCE_SECRET",
      "APP_ID",
      "DEV_PORTAL_API_KEY",
      "RECIPIENT_ADDRESS",
    ];

    const missing = requiredEnv.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      return Response.json(
        {
          status: "unhealthy",
          error: `Missing env vars: ${missing.join(", ")}`,
        },
        { status: 500 }
      );
    }

    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      database: "connected",
    });
  } catch (err) {
    return Response.json(
      {
        status: "unhealthy",
        error: "Database connection failed",
      },
      { status: 500 }
    );
  }
}
