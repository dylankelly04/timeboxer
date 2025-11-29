import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, taskHistory, taskScheduledTimes } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

// PUT /api/tasks/[id] - Update a task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check if task belongs to user
    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (existingTask.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined)
      updateData.description = body.description;
    if (body.startDate !== undefined) updateData.startDate = body.startDate;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate;
    if (body.timeRequired !== undefined)
      updateData.timeRequired = parseInt(body.timeRequired);
    if (body.scheduledTime !== undefined)
      updateData.scheduledTime = body.scheduledTime || null;
    if (body.completed !== undefined) {
      updateData.completed = body.completed;
      if (body.completed) {
        updateData.completedAt = new Date();

        // Get all scheduled time slots for this task
        const scheduledTimes = await db
          .select()
          .from(taskScheduledTimes)
          .where(eq(taskScheduledTimes.taskId, id));

        // Delete any existing history entries for this task (we'll recreate them)
        await db.delete(taskHistory).where(eq(taskHistory.taskId, id));

        if (scheduledTimes.length > 0) {
          // Group scheduled times by date and sum minutes for each day
          const minutesByDate: Record<string, number> = {};

          for (const st of scheduledTimes) {
            // Extract date from startTime (ISO datetime string)
            const date = st.startTime.split("T")[0]; // Get YYYY-MM-DD part
            if (!minutesByDate[date]) {
              minutesByDate[date] = 0;
            }
            minutesByDate[date] += st.duration;
          }

          // Create a history entry for each day with scheduled work
          for (const [date, minutes] of Object.entries(minutesByDate)) {
            await db.insert(taskHistory).values({
              userId: session.user.id,
              taskId: id,
              date: date,
              completed: true,
              minutesWorked: minutes,
            });
          }
        } else {
          // No scheduled times - use the task's due date and total timeRequired
          // This handles tasks that were completed without being scheduled on the calendar
          await db.insert(taskHistory).values({
            userId: session.user.id,
            taskId: id,
            date: existingTask.dueDate,
            completed: true,
            minutesWorked: existingTask.timeRequired,
          });
        }
      } else {
        updateData.completedAt = null;
        // Remove all history entries for this task if uncompleted
        await db.delete(taskHistory).where(eq(taskHistory.taskId, id));
      }
    }

    const [task] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();

    // Convert to the Task type format
    const formattedTask = {
      id: task.id,
      title: task.title,
      description: task.description,
      startDate: task.startDate,
      dueDate: task.dueDate,
      timeRequired: task.timeRequired,
      scheduledTime: task.scheduledTime || undefined,
      completed: task.completed,
    };

    return NextResponse.json(formattedTask);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] - Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if task belongs to user
    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (existingTask.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete task (task history will be deleted via cascade)
    await db.delete(tasks).where(eq(tasks.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
