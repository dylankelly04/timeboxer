"use client";

import { useState, useEffect, useMemo } from "react";
import { format, isBefore, isSameDay, startOfDay } from "date-fns";
import { Archive, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TaskCard } from "./task-card";
import { useTasks } from "@/lib/task-context";
import type { Task } from "@/lib/types";

interface ArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchiveDialog({ open, onOpenChange }: ArchiveDialogProps) {
  const { tasks } = useTasks();
  const [isLoading, setIsLoading] = useState(false);

  // Filter for completed tasks whose due date is today or in the past, and sort reverse chronologically (newest first)
  const archivedTasks = useMemo(() => {
    const today = startOfDay(new Date());

    return tasks
      .filter((task) => {
        // Task must be completed
        if (!task.completed) return false;

        // Task's due date must be today or in the past
        const dueDate = new Date(task.dueDate + "T00:00:00");
        const dueDateStart = startOfDay(dueDate);
        return isBefore(dueDateStart, today) || isSameDay(dueDateStart, today);
      })
      .sort((a, b) => {
        // Sort by due date (newest first - reverse chronological)
        const dateA = new Date(a.dueDate + "T00:00:00");
        const dateB = new Date(b.dueDate + "T00:00:00");
        return dateB.getTime() - dateA.getTime();
      });
  }, [tasks]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {};

    archivedTasks.forEach((task) => {
      const dateKey = task.dueDate;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(task);
    });

    return grouped;
  }, [archivedTasks]);

  const sortedDates = useMemo(() => {
    return Object.keys(tasksByDate).sort((a, b) => {
      const dateA = new Date(a + "T00:00:00");
      const dateB = new Date(b + "T00:00:00");
      return dateB.getTime() - dateA.getTime(); // Newest first (reverse chronological order)
    });
  }, [tasksByDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Archive
          </DialogTitle>
          <DialogDescription>
            View all completed tasks from today and the past
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : archivedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Archive className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm font-medium">No archived tasks</p>
              <p className="text-xs mt-1">Completed tasks from today and the past will appear here</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map((dateKey) => {
                const dateTasks = tasksByDate[dateKey];
                const date = new Date(dateKey + "T00:00:00");

                return (
                  <div key={dateKey} className="space-y-2">
                    <div className="sticky top-0 bg-background/95 backdrop-blur-sm py-2 border-b border-border z-10">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {format(date, "EEEE, MMMM d, yyyy")}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dateTasks.length} task{dateTasks.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="space-y-2 pl-2">
                      {dateTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onEdit={() => {}} // Archive is read-only
                          isArchived={true}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

