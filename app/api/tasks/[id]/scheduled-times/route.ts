import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, taskScheduledTimes } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

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

    // Create new scheduled time slot
    const [scheduledTime] = await db
      .insert(taskScheduledTimes)
      .values({
        taskId,
        startTime,
        duration: parseInt(duration.toString()),
      })
      .returning();

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


