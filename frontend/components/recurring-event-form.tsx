"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "next-auth/react";

interface RecurringEvent {
  id?: string;
  title: string;
  description?: string;
  timeOfDay: string; // HH:mm format
  duration: number; // in minutes
  enabled: boolean;
}

interface RecurringEventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEvent?: RecurringEvent | null;
  onSuccess?: () => void;
}

export function RecurringEventForm({
  open,
  onOpenChange,
  editingEvent,
  onSuccess,
}: RecurringEventFormProps) {
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [duration, setDuration] = useState("30");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Normalize minutes to allowed values (00, 15, 30, 45)
  const normalizeTime = (time: string): string => {
    const [hours, minutes] = time.split(":");
    if (!hours || !minutes) return "09:00";

    const minutesNum = parseInt(minutes, 10);
    // Round to nearest 15-minute increment
    const normalizedMinutes = Math.round(minutesNum / 15) * 15;
    // Ensure it's one of the allowed values
    const allowedMinutes = normalizedMinutes % 60;
    const finalMinutes = [0, 15, 30, 45].reduce((prev, curr) =>
      Math.abs(curr - allowedMinutes) < Math.abs(prev - allowedMinutes)
        ? curr
        : prev
    );

    return `${hours.padStart(2, "0")}:${finalMinutes.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title || "");
      setDescription(editingEvent.description || "");
      setTimeOfDay(normalizeTime(editingEvent.timeOfDay || "09:00"));
      setDuration(editingEvent.duration?.toString() || "30");
    } else {
      setTitle("");
      setDescription("");
      setTimeOfDay("09:00");
      setDuration("30");
    }
  }, [editingEvent, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user?.id) {
      alert("You must be logged in to create recurring events");
      return;
    }

    setIsSubmitting(true);

    try {
      // Ensure time is normalized before submitting
      const normalizedTime = normalizeTime(timeOfDay);

      const eventData = {
        title,
        description: description || undefined,
        timeOfDay: normalizedTime,
        duration: parseInt(duration),
      };

      const url = editingEvent?.id
        ? `/api/recurring-events/${editingEvent.id}`
        : "/api/recurring-events";
      const method = editingEvent?.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save recurring event");
      }

      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      alert(
        `Failed to save recurring event: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingEvent?.id ? "Edit Recurring Event" : "New Recurring Event"}
          </DialogTitle>
          <DialogDescription>
            Create an event that repeats every day at the same time
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Morning Standup"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timeOfDay">Time *</Label>
              <div className="flex gap-2">
                <Select
                  value={timeOfDay.split(":")[0] || "09"}
                  onValueChange={(hour) => {
                    const minutes = timeOfDay.split(":")[1] || "00";
                    setTimeOfDay(`${hour.padStart(2, "0")}:${minutes}`);
                  }}
                  required
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Hour" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString().padStart(2, "0")}>
                        {i.toString().padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={timeOfDay.split(":")[1] || "00"}
                  onValueChange={(minute) => {
                    const hours = timeOfDay.split(":")[0] || "09";
                    setTimeOfDay(`${hours}:${minute}`);
                  }}
                  required
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="00">00</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="45">45</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes) *</Label>
              <Select
                value={duration}
                onValueChange={setDuration}
                required
              >
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : editingEvent?.id
                  ? "Update"
                  : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

