import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recurringEvents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

// GET /api/recurring-events - Get all recurring events for the current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRecurringEvents = await db
      .select()
      .from(recurringEvents)
      .where(eq(recurringEvents.userId, session.user.id))
      .orderBy(recurringEvents.timeOfDay);

    return NextResponse.json(userRecurringEvents);
  } catch (error) {
    console.error("Error fetching recurring events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/recurring-events - Create a new recurring event
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, timeOfDay, duration } = body;

    if (!title || !timeOfDay || duration === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate time format (HH:mm)
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(timeOfDay)) {
      return NextResponse.json(
        { error: "Invalid time format. Use HH:mm" },
        { status: 400 }
      );
    }

    const [recurringEvent] = await db
      .insert(recurringEvents)
      .values({
        userId: session.user.id,
        title,
        description: description || null,
        timeOfDay,
        duration: parseInt(duration.toString()),
        enabled: true,
      })
      .returning();

    if (!recurringEvent) {
      return NextResponse.json(
        { error: "Failed to create recurring event" },
        { status: 500 }
      );
    }

    return NextResponse.json(recurringEvent, { status: 201 });
  } catch (error: any) {
    console.error("Error creating recurring event:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

