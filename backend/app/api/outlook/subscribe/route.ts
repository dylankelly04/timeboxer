import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { outlookIntegrations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { getValidAccessToken, createCalendarSubscription } from "@/lib/outlook";

/**
 * POST /api/outlook/subscribe - Create a webhook subscription for calendar events
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Outlook integration
    const [integration] = await db
      .select()
      .from(outlookIntegrations)
      .where(eq(outlookIntegrations.userId, session.user.id))
      .limit(1);

    if (!integration || !integration.syncEnabled) {
      return NextResponse.json({ error: "Outlook not connected or sync disabled" }, { status: 400 });
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(session.user.id);
    if (!accessToken) {
      return NextResponse.json({ error: "Failed to get access token" }, { status: 500 });
    }

    const calendarId = integration.calendarId;
    if (!calendarId) {
      return NextResponse.json({ error: "Calendar ID not found" }, { status: 500 });
    }

    // Create webhook URL
    const webhookUrl = `${process.env.NEXTAUTH_URL || process.env.VERCEL_URL || "http://localhost:3000"}/api/outlook/webhook`;

    // Create subscription
    const subscription = await createCalendarSubscription(
      accessToken,
      calendarId,
      webhookUrl,
      4320 // 3 days (max for calendar subscriptions)
    );

    if (!subscription) {
      return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
    }

    // Store subscription info in database
    await db
      .update(outlookIntegrations)
      .set({
        subscriptionId: subscription.id,
        subscriptionExpiresAt: new Date(subscription.expirationDateTime),
        updatedAt: new Date(),
      })
      .where(eq(outlookIntegrations.userId, session.user.id));

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      expiresAt: subscription.expirationDateTime,
    });
  } catch (error: any) {
    console.error("Error creating subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

