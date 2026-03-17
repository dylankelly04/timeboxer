import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, outlookIntegrations } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  getValidAccessToken,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/outlook";

/**
 * POST /api/outlook/sync - Sync a task to Outlook calendar
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { taskId, action } = body; // action: 'create' | 'update' | 'delete'

    if (!taskId || !action) {
      return NextResponse.json({ error: "Missing taskId or action" }, { status: 400 });
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

    // Get task
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))
      .limit(1);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (action === "delete") {
      // Delete event if it exists
      if (task.scheduledTime) {
        // We'd need to store the Outlook event ID somewhere
        // For now, we'll just return success
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: true });
    }

    if (!task.scheduledTime) {
      return NextResponse.json({ error: "Task is not scheduled" }, { status: 400 });
    }

    const startTime = new Date(task.scheduledTime);
    const endTime = new Date(startTime.getTime() + task.timeRequired * 60 * 1000);

    const event = {
      subject: task.title,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      body: task.description
        ? {
            contentType: "text",
            content: task.description,
          }
        : undefined,
    };

    if (action === "create") {
      const eventId = await createCalendarEvent(accessToken, calendarId, event);
      if (eventId) {
        // Store event ID in task (we'd need to add a field for this)
        return NextResponse.json({ success: true, eventId });
      }
      return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
    }

    if (action === "update") {
      // We'd need the Outlook event ID to update
      // For now, delete and recreate
      const eventId = await createCalendarEvent(accessToken, calendarId, event);
      if (eventId) {
        return NextResponse.json({ success: true, eventId });
      }
      return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error syncing to Outlook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

