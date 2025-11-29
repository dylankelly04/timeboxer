"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { Header } from "./header";
import { TaskListView } from "./task-list-view";
import { CalendarView } from "./calendar-view";
import { TaskForm } from "./task-form";
import { TaskProvider } from "@/lib/task-context";
import { ThemeProvider } from "./theme-provider";
import { SessionProvider } from "./session-provider";
import type { Task } from "@/lib/types";

const MIN_PANEL_WIDTH = 280; // Minimum width in pixels
const STORAGE_KEY = "timeboxer-panel-width";

function TaskPlannerContent() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);
  const [taskListWidth, setTaskListWidth] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load saved width from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const width = parseInt(saved, 10);
      if (!isNaN(width)) {
        setTaskListWidth(width);
      }
    }
  }, []);

  // Save width to localStorage when it changes
  useEffect(() => {
    if (taskListWidth !== null) {
      localStorage.setItem(STORAGE_KEY, taskListWidth.toString());
    }
  }, [taskListWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const newWidth = e.clientX - containerRect.left;

      // Clamp between min width and (container width - min width for calendar)
      const clampedWidth = Math.max(
        MIN_PANEL_WIDTH,
        Math.min(newWidth, containerWidth - MIN_PANEL_WIDTH)
      );

      setTaskListWidth(clampedWidth);
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleAddTask = (date?: Date) => {
    setEditingTask(null);
    setNewTaskDate(date ?? null);
    setIsFormOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTaskDate(null);
    setIsFormOpen(true);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />

      <div className="flex-1 flex min-h-0" ref={containerRef}>
        <TaskListView
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          width={taskListWidth}
        />

        {/* Resize handle */}
        <div
          className="w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors shrink-0 relative group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary/10" />
        </div>

        <CalendarView
          width={taskListWidth !== null ? `calc(100% - ${taskListWidth}px - 4px)` : undefined}
          onAddTask={(date, scheduledTime, duration) => {
            // Create a task object with the scheduled time and duration pre-filled
            const taskDate = format(date, "yyyy-MM-dd");
            setEditingTask({
              id: "",
              title: "",
              description: "",
              startDate: taskDate,
              dueDate: taskDate,
              timeRequired: duration || 30,
              completed: false,
              scheduledTime: scheduledTime || undefined,
            });
            setIsFormOpen(true);
          }}
        />
      </div>

      <TaskForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        editingTask={
          editingTask ??
          (newTaskDate
            ? {
                id: "",
                title: "",
                description: "",
                startDate: format(newTaskDate, "yyyy-MM-dd"),
                dueDate: format(newTaskDate, "yyyy-MM-dd"),
                timeRequired: 30,
                completed: false,
              }
            : null)
        }
      />
    </div>
  );
}

export function TaskPlanner() {
  return (
    <SessionProvider>
      <ThemeProvider>
        <TaskProvider>
          <TaskPlannerContent />
        </TaskProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
