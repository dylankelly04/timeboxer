"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import type { Task } from "./types";
import { SignUpDialog } from "@/components/signup-dialog";

// Context for triggering sign-up dialog
const SignUpContext = createContext<{
  triggerSignUp: () => void;
} | null>(null);

export function useSignUp() {
  const context = useContext(SignUpContext);
  if (!context) {
    throw new Error("useSignUp must be used within SignUpProvider");
  }
  return context;
}

interface TaskContextType {
  tasks: Task[];
  isLoading: boolean;
  addTask: (task: Omit<Task, "id">) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  scheduleTask: (taskId: string, scheduledTime: string) => Promise<void>;
  unscheduleTask: (taskId: string) => Promise<void>;
  moveTaskToDate: (taskId: string, newDate: Date) => Promise<void>;
  refreshTasks: () => Promise<void>;
  requireAuth: () => boolean; // Returns true if authenticated, false if needs sign up
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSignUp, setShowSignUp] = useState(false);

  const requireAuth = useCallback(() => {
    if (!session?.user) {
      setShowSignUp(true);
      return false;
    }
    return true;
  }, [session]);

  // Fetch tasks from API
  const fetchTasks = useCallback(async () => {
    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/tasks");
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Load tasks when session is available
  useEffect(() => {
    if (session?.user) {
      fetchTasks();
    } else {
      setTasks([]);
      setIsLoading(false);
    }
  }, [session, fetchTasks]);

  const addTask = useCallback(
    async (task: Omit<Task, "id">) => {
      if (!requireAuth()) {
        throw new Error("User must be logged in to create tasks");
      }

      try {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          console.error(
            "Error adding task - API response:",
            response.status,
            errorData
          );
          throw new Error(errorData.error || "Failed to create task");
        }

        const newTask = await response.json();
        setTasks((prev) => [newTask, ...prev]);

        // Sync to Outlook if task is scheduled
        if (newTask.scheduledTime) {
          try {
            await fetch("/api/outlook/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskId: newTask.id,
                action: "create",
              }),
            });
          } catch (error) {
            console.error("Failed to sync to Outlook:", error);
          }
        }

        return newTask;
      } catch (error) {
        console.error("Error adding task:", error);
        throw error;
      }
    },
    [session, requireAuth]
  );

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    if (!requireAuth()) {
      throw new Error("User must be logged in to update tasks");
    }
    try {
      // Check if task was previously scheduled to determine if this is create or update
      const existingTask = tasks.find((t) => t.id === id);
      const wasScheduled = existingTask?.scheduledTime;
      const isScheduling = updates.scheduledTime !== undefined;

      const response = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        const updatedTask = await response.json();
        setTasks((prev) =>
          prev.map((task) => (task.id === id ? updatedTask : task))
        );

        // Sync to Outlook if task is scheduled
        if (updatedTask.scheduledTime) {
          try {
            await fetch("/api/outlook/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskId: id,
                action: wasScheduled ? "update" : "create",
              }),
            });
          } catch (error) {
            // Silently fail - Outlook sync is optional
            console.error("Failed to sync to Outlook:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error updating task:", error);
      throw error;
    }
  }, [tasks, requireAuth]);

  const deleteTask = useCallback(async (id: string) => {
    if (!requireAuth()) {
      throw new Error("User must be logged in to delete tasks");
    }
    try {
      // Check if task is scheduled before deleting
      const task = tasks.find((t) => t.id === id);
      const wasScheduled = task?.scheduledTime;

      const response = await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setTasks((prev) => prev.filter((task) => task.id !== id));

        // Sync deletion to Outlook if task was scheduled
        if (wasScheduled) {
          try {
            await fetch("/api/outlook/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskId: id,
                action: "delete",
              }),
            });
          } catch (error) {
            // Silently fail - Outlook sync is optional
            console.error("Failed to sync deletion to Outlook:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      throw error;
    }
  }, [tasks, requireAuth]);

  const scheduleTask = useCallback(
    async (taskId: string, scheduledTime: string) => {
      // updateTask already handles Outlook sync, so we don't need to sync again here
      await updateTask(taskId, { scheduledTime });
    },
    [updateTask]
  );

  const unscheduleTask = useCallback(
    async (taskId: string) => {
      await updateTask(taskId, { scheduledTime: undefined });
    },
    [updateTask]
  );

  const moveTaskToDate = useCallback(
    async (taskId: string, newDate: Date) => {
      const newDateStr = format(newDate, "yyyy-MM-dd");
      await updateTask(taskId, {
        startDate: newDateStr,
        scheduledTime: undefined,
      });
    },
    [updateTask]
  );

  return (
    <TaskContext.Provider
      value={{
        tasks,
        isLoading,
        addTask,
        updateTask,
        deleteTask,
        scheduleTask,
        unscheduleTask,
        moveTaskToDate,
        refreshTasks: fetchTasks,
        requireAuth,
      }}
    >
      <SignUpContext.Provider value={{ triggerSignUp: () => setShowSignUp(true) }}>
        {children}
        <SignUpDialog
          open={showSignUp}
          onOpenChange={setShowSignUp}
          onSuccess={() => {
            setShowSignUp(false);
          }}
        />
      </SignUpContext.Provider>
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error("useTasks must be used within a TaskProvider");
  }
  return context;
}
