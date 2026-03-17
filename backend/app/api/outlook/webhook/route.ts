import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outlookIntegrations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/outlook/webhook - Receive webhook notifications from Microsoft Graph
 *
 * This endpoint receives notifications when calendar events are created, updated, or deleted.
 * Microsoft Graph will send a validation request first, then actual notifications.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle subscription validation (Microsoft Graph sends this first)
    if (body.validationToken) {
      // Return the validation token to confirm the subscription
      return new NextResponse(body.validationToken, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Handle actual notifications
    if (body.value && Array.isArray(body.value)) {
      for (const notification of body.value) {
        const resource = notification.resource;
        const changeType = notification.changeType; // 'created', 'updated', or 'deleted'
        const clientState = notification.clientState;

        // Decode client state to get calendarId
        let calendarId: string | null = null;
        try {
          calendarId = Buffer.from(clientState, "base64").toString();
        } catch {
          console.error("Failed to decode client state");
          continue;
        }

        // Find the integration by calendarId
        const [integration] = await db
          .select()
          .from(outlookIntegrations)
          .where(eq(outlookIntegrations.calendarId, calendarId))
          .limit(1);

        if (!integration) {
          console.error("Integration not found for calendar:", calendarId);
          continue;
        }

        // Update lastSyncAt to indicate we received a notification
        await db
          .update(outlookIntegrations)
          .set({
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(outlookIntegrations.id, integration.id));

        // You could emit a server-sent event or WebSocket message here
        // to notify the client to refresh their calendar view
      }
    }

    // Return 202 Accepted to acknowledge receipt
    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    // Still return 202 to prevent Microsoft from retrying
    return NextResponse.json({ error: "Processing failed" }, { status: 202 });
  }
}

/**
 * GET /api/outlook/webhook - Handle GET requests (for validation)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const validationToken = searchParams.get("validationToken");

  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

