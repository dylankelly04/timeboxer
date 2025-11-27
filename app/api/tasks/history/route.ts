import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskHistory } from "@/drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

// GET /api/tasks/history - Get task history for contribution graph
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const history = await db
      .select()
      .from(taskHistory)
      .where(
        and(
          eq(taskHistory.userId, session.user.id),
          eq(taskHistory.completed, true)
        )
      )
      .orderBy(asc(taskHistory.date));

    // Convert to the format expected by ContributionGraph
    const formattedHistory = history.map((history) => ({
      date: history.date,
      completed: history.completed,
    }));

    return NextResponse.json(formattedHistory);
  } catch (error) {
    console.error("Error fetching task history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
