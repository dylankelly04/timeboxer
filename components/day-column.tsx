"use client";

import type React from "react";

import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  startOfDay,
  isBefore,
  isSameDay,
} from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { useTasks } from "@/lib/task-context";

interface DayColumnProps {
  date: Date;
  tasks: Task[];
  onAddTask: (date: Date) => void;
  onEditTask: (task: Task) => void;
}

export function DayColumn({
  date,
  tasks,
  onAddTask,
  onEditTask,
}: DayColumnProps) {
  const { unscheduleTask, moveTaskToDate } = useTasks();

  const formatDayLabel = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "EEEE");
  };

  // Categorize tasks
  // Exclude completed tasks whose due date is today or in the past (they go to archive)
  const today = startOfDay(new Date());
  const isArchivedTask = (task: Task) => {
    if (!task.completed) return false;
    const dueDate = new Date(task.dueDate + "T00:00:00");
    const dueDateStart = startOfDay(dueDate);
    return isBefore(dueDateStart, today) || isSameDay(dueDateStart, today);
  };

  const scheduledTasks = tasks.filter((t) => t.scheduledTime && !t.completed);
  const pendingTasks = tasks.filter((t) => !t.scheduledTime && !t.completed);
  const completedTasks = tasks.filter((t) => t.completed && !isArchivedTask(t));

  const totalTime = pendingTasks.reduce((sum, t) => sum + t.timeRequired, 0);
  const hours = Math.floor(totalTime / 60);
  const mins = totalTime % 60;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const fromCalendar = e.dataTransfer.getData("fromCalendar");
    const fromDay = e.dataTransfer.getData("fromDay");

    if (taskId) {
      if (fromCalendar === "true") {
        // Coming from calendar - unschedule and move to this day
        moveTaskToDate(taskId, date);
      } else if (fromDay) {
        // Coming from another day column - move to this day
        moveTaskToDate(taskId, date);
      }
    }
  };

  return (
    <div
      className="flex-1 min-w-[200px] h-full flex flex-col border-r border-border last:border-r-0 bg-card/50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="px-3 py-3 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h3
              className={cn(
                "font-semibold text-sm",
                isToday(date) && "text-primary"
              )}
            >
              {formatDayLabel(date)}
            </h3>
            <p className="text-xs text-muted-foreground">
              {format(date, "MMM d")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-muted-foreground">
              {scheduledTasks.length +
                pendingTasks.length +
                completedTasks.length}{" "}
              task
              {scheduledTasks.length +
                pendingTasks.length +
                completedTasks.length !==
              1
                ? "s"
                : ""}
            </p>
            {totalTime > 0 && (
              <p className="text-xs text-muted-foreground">
                {hours > 0 && `${hours}h `}
                {mins > 0 && `${mins}m`}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Scheduled tasks */}
        {scheduledTasks.length > 0 && (
          <div className="space-y-2">
            <div className="px-1 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Scheduled ({scheduledTasks.length})
            </div>
            {scheduledTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEditTask}
                fromDate={date}
              />
            ))}
          </div>
        )}

        {/* Pending tasks */}
        {pendingTasks.length > 0 && (
          <div className="space-y-2">
            <div className="px-1 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Pending ({pendingTasks.length})
            </div>
            {pendingTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEditTask}
                fromDate={date}
              />
            ))}
          </div>
        )}

        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <div className="space-y-2">
            <div className="px-1 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Completed ({completedTasks.length})
            </div>
            {completedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEditTask}
                fromDate={date}
              />
            ))}
          </div>
        )}

        {scheduledTasks.length === 0 &&
          pendingTasks.length === 0 &&
          completedTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p className="text-xs">No tasks</p>
            </div>
          )}
      </div>

      <button
        className="p-3 border-t border-border flex items-center w-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={() => onAddTask(date)}
      >
        <Plus className="h-3 w-3 mr-1.5" />
        Add task
      </button>
    </div>
  );
}
