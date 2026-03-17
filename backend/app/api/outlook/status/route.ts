import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { outlookIntegrations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/outlook/status - Get Outlook integration status
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [integration] = await db
      .select()
      .from(outlookIntegrations)
      .where(eq(outlookIntegrations.userId, session.user.id))
      .limit(1);

    if (!integration) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      syncEnabled: integration.syncEnabled,
      lastSyncAt: integration.lastSyncAt,
    });
  } catch (error: any) {
    console.error("Error getting Outlook status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

