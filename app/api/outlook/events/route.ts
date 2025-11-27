import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { outlookIntegrations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { getValidAccessToken, fetchCalendarEvents } from "@/lib/outlook";

/**
 * GET /api/outlook/events - Fetch Outlook calendar events
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDateTime = searchParams.get("startDateTime");
    const endDateTime = searchParams.get("endDateTime");
    const timeZone = searchParams.get("timeZone") || "UTC";

    if (!startDateTime || !endDateTime) {
      return NextResponse.json(
        { error: "startDateTime and endDateTime are required" },
        { status: 400 }
      );
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

    // Fetch events from Outlook with timezone
    const events = await fetchCalendarEvents(accessToken, calendarId, startDateTime, endDateTime, timeZone);

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error("Error fetching Outlook events:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

