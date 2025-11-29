"use client";

import { useState } from "react";
import type React from "react";
import { format } from "date-fns";
import { Clock, Calendar, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { useTasks } from "@/lib/task-context";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  isDragging?: boolean;
  fromDate?: Date;
}

export function TaskCard({
  task,
  onEdit,
  isDragging,
  fromDate,
}: TaskCardProps) {
  const { updateTask, deleteTask } = useTasks();
  const [showActions, setShowActions] = useState(false);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const isScheduled = !!task.scheduledTime;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open edit if clicking on delete button
    const target = e.target as HTMLElement;
    if (target.closest('button[type="button"]')) {
      return;
    }
    onEdit(task);
  };

  const handleDoubleClick = async (e: React.MouseEvent) => {
    // Don't toggle if clicking on delete button
    const target = e.target as HTMLElement;
    if (target.closest('button[type="button"]')) {
      return;
    }
    e.stopPropagation();
    try {
      await updateTask(task.id, { completed: !task.completed });
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    // Don't start drag if clicking on buttons
    const target = e.target as HTMLElement;
    if (target.closest('button[type="button"]')) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("taskId", task.id);
    // Store task duration for drag-over highlight (default 30m once scheduled)
    const hasScheduledTimes =
      task.scheduledTimes && task.scheduledTimes.length > 0;
    const duration = hasScheduledTimes ? 30 : task.timeRequired || 30;
    e.dataTransfer.setData("taskDuration", duration.toString());
    if (fromDate) {
      e.dataTransfer.setData("fromDay", fromDate.toISOString());
    }
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <Card
      className={cn(
        "group relative p-3 transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:border-primary/30",
        isDragging && "opacity-50 shadow-lg rotate-2",
        task.completed && "opacity-60",
        isScheduled && "border-l-4 border-l-accent"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={handleCardClick}
      onDoubleClick={handleDoubleClick}
      draggable
      onDragStart={handleDragStart}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <h4
            className={cn(
              "font-medium text-sm leading-tight truncate",
              task.completed && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </h4>

          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground whitespace-nowrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(task.timeRequired)}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Calendar className="h-3 w-3" />
              {format(new Date(task.dueDate + "T00:00:00"), "MMM d")}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-1 transition-opacity",
            showActions ? "opacity-100" : "opacity-0"
          )}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await updateTask(task.id, { completed: !task.completed });
              } catch (error) {
                console.error("Failed to update task:", error);
              }
            }}
            title={task.completed ? "Mark as incomplete" : "Mark as complete"}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              deleteTask(task.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
