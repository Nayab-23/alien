import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function GET() {
  try {
    // Check database connection
    await db.select().from(users).limit(1);

    // Check required env vars
    const requiredEnv = [
      "DATABASE_URL",
      "ALIEN_APP_ID",
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
    console.error("Health check failed:", err);
    return Response.json(
      {
        status: "unhealthy",
        error: err instanceof Error ? err.message : "Database connection failed",
      },
      { status: 500 }
    );
  }
}
