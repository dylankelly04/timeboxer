"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Header } from "./header";
import { TaskListView } from "./task-list-view";
import { CalendarView } from "./calendar-view";
import { TaskForm } from "./task-form";
import { TaskProvider } from "@/lib/task-context";
import { ThemeProvider } from "./theme-provider";
import { SessionProvider } from "./session-provider";
import type { Task } from "@/lib/types";

function TaskPlannerContent() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);

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

      <div className="flex-1 flex min-h-0">
        <TaskListView onAddTask={handleAddTask} onEditTask={handleEditTask} />
        <CalendarView onAddTask={(date, scheduledTime, duration) => {
          // Create a task object with the scheduled time and duration pre-filled
          const taskDate = format(date, "yyyy-MM-dd")
          setEditingTask({
            id: "",
            title: "",
            description: "",
            startDate: taskDate,
            dueDate: taskDate,
            timeRequired: duration || 30,
            completed: false,
            scheduledTime: scheduledTime || undefined,
          })
          setIsFormOpen(true)
        }} />
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
