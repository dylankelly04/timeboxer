import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reminders } from "@/drizzle/schema";
import { eq, and, lte, gte } from "drizzle-orm";

// GET /api/reminders - Get all reminders for the current user
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let userReminders;

    if (startDate && endDate) {
      // Get reminders that overlap with the date range
      userReminders = await db
        .select()
        .from(reminders)
        .where(
          and(
            eq(reminders.userId, session.user.id),
            lte(reminders.startDate, endDate),
            gte(reminders.endDate, startDate)
          )
        );
    } else {
      userReminders = await db
        .select()
        .from(reminders)
        .where(eq(reminders.userId, session.user.id));
    }

    return NextResponse.json(userReminders);
  } catch (error) {
    console.error("Error fetching reminders:", error);
    return NextResponse.json(
      { error: "Failed to fetch reminders" },
      { status: 500 }
    );
  }
}

// POST /api/reminders - Create a new reminder
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { text, startDate, endDate } = body;

    if (!text || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Text, start date, and end date are required" },
        { status: 400 }
      );
    }

    const [newReminder] = await db
      .insert(reminders)
      .values({
        userId: session.user.id,
        text,
        startDate,
        endDate,
      })
      .returning();

    return NextResponse.json(newReminder, { status: 201 });
  } catch (error) {
    console.error("Error creating reminder:", error);
    return NextResponse.json(
      { error: "Failed to create reminder" },
      { status: 500 }
    );
  }
}

