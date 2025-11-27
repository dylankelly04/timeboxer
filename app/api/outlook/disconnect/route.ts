import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { outlookIntegrations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/outlook/disconnect - Disconnect Outlook integration
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db
      .delete(outlookIntegrations)
      .where(eq(outlookIntegrations.userId, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error disconnecting Outlook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

