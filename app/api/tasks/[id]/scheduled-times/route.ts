import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, taskScheduledTimes, outlookIntegrations } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getValidAccessToken, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/outlook";

// Helper function to sync scheduled time to Outlook
async function syncScheduledTimeToOutlook(
  userId: string,
  taskId: string,
  scheduledTimeId: string,
  action: "create" | "update" | "delete",
  task: { title: string; description: string | null },
  scheduledTime: { startTime: string; duration: number; outlookEventId?: string | null }
) {
  try {
    // Get Outlook integration
    const [integration] = await db
      .select()
      .from(outlookIntegrations)
      .where(eq(outlookIntegrations.userId, userId))
      .limit(1);

    if (!integration || !integration.syncEnabled || !integration.calendarId) {
      console.log("Outlook sync skipped - integration not found or disabled:", {
        hasIntegration: !!integration,
        syncEnabled: integration?.syncEnabled,
        hasCalendarId: !!integration?.calendarId,
      });
      return; // Outlook not connected or sync disabled
    }

    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      console.error("Outlook sync skipped - failed to get access token");
      return;
    }

    const startTime = new Date(scheduledTime.startTime);
    const endTime = new Date(startTime.getTime() + scheduledTime.duration * 60 * 1000);

    if (action === "delete") {
      // Delete the Outlook event if we have the event ID
      if (scheduledTime.outlookEventId) {
        await deleteCalendarEvent(accessToken, integration.calendarId, scheduledTime.outlookEventId);
      }
      return;
    }

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

    if (action === "update" && scheduledTime.outlookEventId) {
      // Update existing event
      await updateCalendarEvent(accessToken, integration.calendarId, scheduledTime.outlookEventId, event);
    } else {
      // Create new event and store the event ID
      console.log("Creating Outlook event for scheduled time:", scheduledTimeId);
      const eventId = await createCalendarEvent(accessToken, integration.calendarId, event);
      if (eventId) {
        console.log("Outlook event created successfully:", eventId);
        // Update the scheduled time with the Outlook event ID
        await db
          .update(taskScheduledTimes)
          .set({ outlookEventId: eventId })
          .where(eq(taskScheduledTimes.id, scheduledTimeId));
        console.log("Stored Outlook event ID in scheduled time:", scheduledTimeId);
      } else {
        console.error("Failed to create Outlook event - createCalendarEvent returned null");
      }
    }
  } catch (error) {
    // Log error details for debugging
    console.error("Error syncing to Outlook:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
    throw error; // Re-throw to be caught by caller
  }
}

// POST /api/tasks/[id]/scheduled-times - Add a new scheduled time slot
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId } = await params;

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const { startTime, duration } = body;

    if (!startTime || duration === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: startTime, duration" },
        { status: 400 }
      );
    }

    // Verify task exists and belongs to user
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))
      .limit(1);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check if this is the first scheduled time slot (before creating the new one)
    const existingScheduledTimes = await db
      .select()
      .from(taskScheduledTimes)
      .where(eq(taskScheduledTimes.taskId, taskId));

    const isFirstScheduledTime = existingScheduledTimes.length === 0;

    // Create new scheduled time slot
    const [scheduledTime] = await db
      .insert(taskScheduledTimes)
      .values({
        taskId,
        startTime,
        duration: parseInt(duration.toString()),
      })
      .returning();

    // Update task's timeRequired:
    // - If first scheduled time, keep the original timeRequired (don't change it)
    // - If additional scheduled times, sum all scheduled durations (including the new one)
    if (!isFirstScheduledTime) {
      const allScheduledTimes = await db
        .select()
        .from(taskScheduledTimes)
        .where(eq(taskScheduledTimes.taskId, taskId));

      const totalScheduledDuration = allScheduledTimes.reduce(
        (sum, st) => sum + st.duration,
        0
      );

      await db
        .update(tasks)
        .set({ timeRequired: totalScheduledDuration })
        .where(eq(tasks.id, taskId));
    }
    // If first scheduled time, timeRequired stays as the original allocated time (no update needed)

    // Sync to Outlook immediately (fire and forget, but with better logging)
    syncScheduledTimeToOutlook(session.user.id, taskId, scheduledTime.id, "create", task, {
      startTime: scheduledTime.startTime,
      duration: scheduledTime.duration,
    })
      .then(() => {
        console.log("Successfully synced scheduled time to Outlook:", scheduledTime.id);
      })
      .catch((error) => {
        // Log error but don't fail the request
        console.error("Failed to sync scheduled time to Outlook:", error);
        console.error("Error details:", error?.message, error?.stack);
      });

    return NextResponse.json(scheduledTime, { status: 201 });
  } catch (error) {
    console.error("Error adding scheduled time:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/tasks/[id]/scheduled-times - Get all scheduled times for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId } = await params;

    // Verify task exists and belongs to user
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))
      .limit(1);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get all scheduled times for this task
    const scheduledTimes = await db
      .select()
      .from(taskScheduledTimes)
      .where(eq(taskScheduledTimes.taskId, taskId));

    return NextResponse.json(scheduledTimes);
  } catch (error) {
    console.error("Error fetching scheduled times:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


