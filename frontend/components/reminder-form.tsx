"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignUpDialog } from "@/components/signup-dialog";
import type { Reminder } from "@/lib/types";

interface ReminderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingReminder?: Reminder | null;
  defaultStartDate?: string;
  defaultEndDate?: string;
  onSuccess?: () => void;
}

export function ReminderForm({
  open,
  onOpenChange,
  editingReminder,
  defaultStartDate,
  defaultEndDate,
  onSuccess,
}: ReminderFormProps) {
  const { data: session } = useSession();
  const [text, setText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  const isEditing = !!editingReminder?.id;

  useEffect(() => {
    if (open) {
      if (editingReminder) {
        setText(editingReminder.text);
        setStartDate(editingReminder.startDate);
        setEndDate(editingReminder.endDate);
      } else {
        setText("");
        setStartDate(defaultStartDate || format(new Date(), "yyyy-MM-dd"));
        setEndDate(defaultEndDate || format(new Date(), "yyyy-MM-dd"));
      }
    }
  }, [open, editingReminder, defaultStartDate, defaultEndDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user) {
      setShowSignUp(true);
      return;
    }

    if (!text.trim()) return;

    setIsSubmitting(true);

    try {
      const url = isEditing
        ? `/api/reminders/${editingReminder.id}`
        : "/api/reminders";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          startDate,
          endDate,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save reminder");
      }

      onOpenChange(false);
      onSuccess?.();

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent("reminderUpdated"));
    } catch (error) {
      console.error("Error saving reminder:", error);
      alert("Failed to save reminder. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingReminder?.id) return;

    if (!confirm("Are you sure you want to delete this reminder?")) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/reminders/${editingReminder.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete reminder");
      }

      onOpenChange(false);
      onSuccess?.();

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent("reminderUpdated"));
    } catch (error) {
      console.error("Error deleting reminder:", error);
      alert("Failed to delete reminder. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value;
    setStartDate(newStartDate);
    // If end date is before start date, update it
    if (endDate && new Date(endDate) < new Date(newStartDate)) {
      setEndDate(newStartDate);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Reminder" : "Create Reminder"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update your reminder details"
                : "Add a reminder that will appear on the selected days"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="text">Reminder Text</Label>
              <Input
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter reminder text..."
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={handleStartDateChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  required
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              {isEditing ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                >
                  Delete
                </Button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !text.trim()}>
                  {isSubmitting
                    ? "Saving..."
                    : isEditing
                    ? "Update"
                    : "Create"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <SignUpDialog open={showSignUp} onOpenChange={setShowSignUp} />
    </>
  );
}

