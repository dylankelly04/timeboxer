import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, taskScheduledTimes } from "@/drizzle/schema";
import { eq, desc, inArray } from "drizzle-orm";

// GET /api/tasks - Get all tasks for the current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, session.user.id))
      .orderBy(desc(tasks.createdAt));

    // Get all scheduled times for all tasks
    const taskIds = userTasks.map((t) => t.id);
    const allScheduledTimes = taskIds.length > 0
      ? await db
          .select()
          .from(taskScheduledTimes)
          .where(inArray(taskScheduledTimes.taskId, taskIds))
      : [];

    // Group scheduled times by taskId
    const scheduledTimesByTask: Record<string, typeof allScheduledTimes> = {};
    allScheduledTimes.forEach((st) => {
      if (!scheduledTimesByTask[st.taskId]) {
        scheduledTimesByTask[st.taskId] = [];
      }
      scheduledTimesByTask[st.taskId].push(st);
    });

    // Convert to the Task type format
    const formattedTasks = userTasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      startDate: task.startDate,
      dueDate: task.dueDate,
      timeRequired: task.timeRequired,
      scheduledTime: task.scheduledTime || undefined,
      scheduledTimes: (scheduledTimesByTask[task.id] || []).map((st) => ({
        id: st.id,
        taskId: st.taskId,
        startTime: st.startTime,
        duration: st.duration,
      })),
      completed: task.completed,
    }));

    return NextResponse.json(formattedTasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      startDate,
      dueDate,
      timeRequired,
      scheduledTime,
    } = body;

    if (!title || !startDate || !dueDate || timeRequired === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const [task] = await db
      .insert(tasks)
      .values({
        userId: session.user.id,
        title,
        description: description || "",
        startDate,
        dueDate,
        timeRequired: parseInt(timeRequired.toString()),
        scheduledTime: scheduledTime || null,
        completed: false,
      })
      .returning();

    if (!task) {
      console.error("Task creation returned no result");
      return NextResponse.json(
        { error: "Failed to create task" },
        { status: 500 }
      );
    }

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

    return NextResponse.json(formattedTask, { status: 201 });
  } catch (error: any) {
    console.error("Error creating task:", error);
    console.error("Error details:", error?.message, error?.stack);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
