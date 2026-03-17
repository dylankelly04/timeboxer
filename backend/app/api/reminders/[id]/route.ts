import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reminders } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

// GET /api/reminders/[id] - Get a specific reminder
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [reminder] = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.userId, session.user.id)));

    if (!reminder) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }

    return NextResponse.json(reminder);
  } catch (error) {
    console.error("Error fetching reminder:", error);
    return NextResponse.json(
      { error: "Failed to fetch reminder" },
      { status: 500 }
    );
  }
}

// PATCH /api/reminders/[id] - Update a reminder
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const [existing] = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.userId, session.user.id)));

    if (!existing) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(reminders)
      .set({
        text: body.text ?? existing.text,
        startDate: body.startDate ?? existing.startDate,
        endDate: body.endDate ?? existing.endDate,
      })
      .where(eq(reminders.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating reminder:", error);
    return NextResponse.json(
      { error: "Failed to update reminder" },
      { status: 500 }
    );
  }
}

// DELETE /api/reminders/[id] - Delete a reminder
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.userId, session.user.id)));

    if (!existing) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }

    await db.delete(reminders).where(eq(reminders.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reminder:", error);
    return NextResponse.json(
      { error: "Failed to delete reminder" },
      { status: 500 }
    );
  }
}

