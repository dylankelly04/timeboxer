import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getValidAccessToken, deleteCalendarEvent } from "@/lib/outlook";
import { db } from "@/lib/db";
import { outlookIntegrations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

// DELETE /api/outlook/events/[eventId] - Delete an Outlook calendar event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;

    // Get user's Outlook integration
    const [integration] = await db
      .select()
      .from(outlookIntegrations)
      .where(eq(outlookIntegrations.userId, session.user.id))
      .limit(1);

    if (!integration) {
      return NextResponse.json(
        { error: "Outlook not connected" },
        { status: 400 }
      );
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(session.user.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Failed to get access token" },
        { status: 500 }
      );
    }

    // Delete the event
    const calendarId = integration.calendarId || "calendar";
    const success = await deleteCalendarEvent(
      accessToken,
      calendarId,
      eventId
    );

    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting Outlook event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

