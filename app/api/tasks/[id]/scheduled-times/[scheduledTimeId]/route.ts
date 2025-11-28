import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  tasks,
  taskScheduledTimes,
  outlookIntegrations,
} from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  getValidAccessToken,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/outlook";

// Helper function to sync scheduled time to Outlook
async function syncScheduledTimeToOutlook(
  userId: string,
  taskId: string,
  scheduledTimeId: string,
  action: "create" | "update" | "delete",
  task: { title: string; description: string | null },
  scheduledTime: {
    startTime: string;
    duration: number;
    outlookEventId?: string | null;
  }
) {
  try {
    // Get Outlook integration
    const [integration] = await db
      .select()
      .from(outlookIntegrations)
      .where(eq(outlookIntegrations.userId, userId))
      .limit(1);

    if (!integration || !integration.syncEnabled || !integration.calendarId) {
      return; // Outlook not connected or sync disabled
    }

    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return;
    }

    const startTime = new Date(scheduledTime.startTime);
    const endTime = new Date(
      startTime.getTime() + scheduledTime.duration * 60 * 1000
    );

    if (action === "delete") {
      // Delete the Outlook event if we have the event ID
      if (scheduledTime.outlookEventId) {
        const deleted = await deleteCalendarEvent(
          accessToken,
          integration.calendarId,
          scheduledTime.outlookEventId
        );
        if (!deleted) {
          console.error(
            "Failed to delete Outlook event:",
            scheduledTime.outlookEventId
          );
        } else {
          console.log(
            "Successfully deleted Outlook event:",
            scheduledTime.outlookEventId
          );
        }
      } else {
        console.log(
          "No Outlook event ID to delete for scheduled time:",
          scheduledTimeId
        );
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
      await updateCalendarEvent(
        accessToken,
        integration.calendarId,
        scheduledTime.outlookEventId,
        event
      );
    } else {
      // Create new event and store the event ID
      const eventId = await createCalendarEvent(
        accessToken,
        integration.calendarId,
        event
      );
      if (eventId) {
        // Update the scheduled time with the Outlook event ID
        await db
          .update(taskScheduledTimes)
          .set({ outlookEventId: eventId })
          .where(eq(taskScheduledTimes.id, scheduledTimeId));
      }
    }
  } catch (error) {
    // Silently fail - Outlook sync is optional
    console.error("Error syncing to Outlook:", error);
  }
}

// PUT /api/tasks/[id]/scheduled-times/[scheduledTimeId] - Update a scheduled time slot
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scheduledTimeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId, scheduledTimeId } = await params;
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

    // Get the scheduled time before updating (for sync)
    const [oldScheduledTime] = await db
      .select()
      .from(taskScheduledTimes)
      .where(
        and(
          eq(taskScheduledTimes.id, scheduledTimeId),
          eq(taskScheduledTimes.taskId, taskId)
        )
      )
      .limit(1);

    if (!oldScheduledTime) {
      return NextResponse.json(
        { error: "Scheduled time not found" },
        { status: 404 }
      );
    }

    // Update the scheduled time slot
    await db
      .update(taskScheduledTimes)
      .set({
        startTime,
        duration: parseInt(duration.toString()),
      })
      .where(
        and(
          eq(taskScheduledTimes.id, scheduledTimeId),
          eq(taskScheduledTimes.taskId, taskId)
        )
      );

    // Update task's timeRequired to sum of all scheduled durations
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

    // Sync to Outlook (fire and forget)
    syncScheduledTimeToOutlook(
      session.user.id,
      taskId,
      scheduledTimeId,
      "update",
      task,
      {
        startTime,
        duration: parseInt(duration.toString()),
        outlookEventId: oldScheduledTime.outlookEventId,
      }
    ).catch((error) => {
      // Silently fail - Outlook sync is optional
      console.error("Failed to sync scheduled time to Outlook:", error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating scheduled time:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id]/scheduled-times/[scheduledTimeId] - Delete a scheduled time slot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scheduledTimeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId, scheduledTimeId } = await params;

    // Verify task exists and belongs to user
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))
      .limit(1);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get all scheduled times before deleting (to check if this is the last one)
    const allScheduledTimesBeforeDelete = await db
      .select()
      .from(taskScheduledTimes)
      .where(eq(taskScheduledTimes.taskId, taskId));

    const isLastScheduledTime = allScheduledTimesBeforeDelete.length === 1;

    // Get the scheduled time before deleting (for sync)
    const [scheduledTimeToDelete] = await db
      .select()
      .from(taskScheduledTimes)
      .where(
        and(
          eq(taskScheduledTimes.id, scheduledTimeId),
          eq(taskScheduledTimes.taskId, taskId)
        )
      )
      .limit(1);

    if (!scheduledTimeToDelete) {
      return NextResponse.json(
        { error: "Scheduled time not found" },
        { status: 404 }
      );
    }

    // Delete the scheduled time slot
    await db
      .delete(taskScheduledTimes)
      .where(
        and(
          eq(taskScheduledTimes.id, scheduledTimeId),
          eq(taskScheduledTimes.taskId, taskId)
        )
      );

    // Update task's timeRequired:
    // - If this was the last scheduled time, don't change timeRequired (keep original value)
    // - If there are remaining scheduled times, sum their durations
    if (!isLastScheduledTime) {
      const remainingScheduledTimes = await db
        .select()
        .from(taskScheduledTimes)
        .where(eq(taskScheduledTimes.taskId, taskId));

      const totalScheduledDuration = remainingScheduledTimes.reduce(
        (sum, st) => sum + st.duration,
        0
      );

      await db
        .update(tasks)
        .set({ timeRequired: totalScheduledDuration })
        .where(eq(tasks.id, taskId));
    }
    // If it was the last scheduled time, timeRequired stays as the original value (no update needed)

    // Sync deletion to Outlook (fire and forget)
    if (scheduledTimeToDelete.outlookEventId) {
      // Only sync if we have an Outlook event ID
      syncScheduledTimeToOutlook(
        session.user.id,
        taskId,
        scheduledTimeId,
        "delete",
        task,
        {
          startTime: scheduledTimeToDelete.startTime,
          duration: scheduledTimeToDelete.duration,
          outlookEventId: scheduledTimeToDelete.outlookEventId,
        }
      ).catch((error) => {
        // Log error but don't fail the deletion
        console.error(
          "Failed to sync scheduled time deletion to Outlook:",
          error
        );
      });
    } else {
      console.log(
        "Skipping Outlook sync - no event ID stored for scheduled time:",
        scheduledTimeId
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting scheduled time:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
