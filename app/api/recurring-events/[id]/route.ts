import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recurringEvents } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

// PUT /api/recurring-events/[id] - Update a recurring event
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
    const { title, description, timeOfDay, duration, enabled } = body;

    // Verify event exists and belongs to user
    const [existingEvent] = await db
      .select()
      .from(recurringEvents)
      .where(
        and(
          eq(recurringEvents.id, id),
          eq(recurringEvents.userId, session.user.id)
        )
      )
      .limit(1);

    if (!existingEvent) {
      return NextResponse.json(
        { error: "Recurring event not found" },
        { status: 404 }
      );
    }

    // Validate time format if provided
    if (timeOfDay && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(timeOfDay)) {
      return NextResponse.json(
        { error: "Invalid time format. Use HH:mm" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (timeOfDay !== undefined) updateData.timeOfDay = timeOfDay;
    if (duration !== undefined) updateData.duration = parseInt(duration.toString());
    if (enabled !== undefined) updateData.enabled = enabled;

    await db
      .update(recurringEvents)
      .set(updateData)
      .where(
        and(
          eq(recurringEvents.id, id),
          eq(recurringEvents.userId, session.user.id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating recurring event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/recurring-events/[id] - Delete a recurring event
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

    // Verify event exists and belongs to user
    const [existingEvent] = await db
      .select()
      .from(recurringEvents)
      .where(
        and(
          eq(recurringEvents.id, id),
          eq(recurringEvents.userId, session.user.id)
        )
      )
      .limit(1);

    if (!existingEvent) {
      return NextResponse.json(
        { error: "Recurring event not found" },
        { status: 404 }
      );
    }

    await db
      .delete(recurringEvents)
      .where(
        and(
          eq(recurringEvents.id, id),
          eq(recurringEvents.userId, session.user.id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting recurring event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

