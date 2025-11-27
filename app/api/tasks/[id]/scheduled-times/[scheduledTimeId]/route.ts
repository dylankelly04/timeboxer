import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, taskScheduledTimes } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

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

    // Delete the scheduled time slot
    await db
      .delete(taskScheduledTimes)
      .where(
        and(
          eq(taskScheduledTimes.id, scheduledTimeId),
          eq(taskScheduledTimes.taskId, taskId)
        )
      );

    // Update task's timeRequired to sum of remaining scheduled durations
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting scheduled time:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

