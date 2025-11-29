"use client";

import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  format,
  setHours,
  setMinutes,
  isToday,
  addDays,
  startOfDay,
} from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { X, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useTasks } from "@/lib/task-context";
import { useSession } from "next-auth/react";
import { RecurringEventForm } from "@/components/recurring-event-form";
import type { Task } from "@/lib/types";

const HOUR_HEIGHT = 60;
// Slight extra vertical padding so you can scroll past the first/last hour labels
const GRID_VERTICAL_PADDING = HOUR_HEIGHT / 2;
const START_HOUR = 0;
const END_HOUR = 24;

type CalendarMode = "1-day" | "3-day";

interface OutlookEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  body?: { content: string };
}

interface RecurringEvent {
  id: string;
  title: string;
  description?: string | null;
  timeOfDay: string; // HH:mm format
  duration: number; // in minutes
  enabled: boolean;
}

interface CalendarViewProps {
  onAddTask?: (date: Date, scheduledTime?: string, duration?: number) => void;
}

export function CalendarView({ onAddTask }: CalendarViewProps = {}) {
  const { tasks, scheduleTask, unscheduleTask, updateTask, refreshTasks } =
    useTasks();
  const { data: session } = useSession();
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("1-day");
  const [dayOffset, setDayOffset] = useState(0);
  const [dragOverSlot, setDragOverSlot] = useState<{
    date: Date;
    hour: number;
    minutes: number;
    duration: number;
    top: number;
  } | null>(null);
  const [outlookEvents, setOutlookEvents] = useState<OutlookEvent[]>([]);
  const [isLoadingOutlookEvents, setIsLoadingOutlookEvents] = useState(false);
  const [recurringEvents, setRecurringEvents] = useState<RecurringEvent[]>([]);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [createEventStart, setCreateEventStart] = useState<{
    date: Date;
    hour: number;
    minutes: number;
    top: number;
  } | null>(null);
  const [createEventEnd, setCreateEventEnd] = useState<{
    date: Date;
    hour: number;
    minutes: number;
    top: number;
  } | null>(null);
  const [resizingTask, setResizingTask] = useState<{
    taskId: string;
    scheduledTimeId: string;
    startTime: string;
    duration: number;
    resizeEdge: "top" | "bottom";
    initialY: number;
    scheduledDate: Date;
  } | null>(null);
  const [editingRecurringEvent, setEditingRecurringEvent] =
    useState<RecurringEvent | null>(null);
  const [isRecurringEventFormOpen, setIsRecurringEventFormOpen] =
    useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get user's timezone
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const today = startOfDay(new Date());
  const startDay = addDays(today, dayOffset);
  const visibleDays =
    calendarMode === "1-day"
      ? [startDay]
      : [startDay, addDays(startDay, 1), addDays(startDay, 2)];

  // Hours used for slots (e.g., 0–23 for a 24-hour day)
  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, i) => START_HOUR + i
  );
  // Hours used just for labels (include END_HOUR so we show "12 AM" again at bottom)
  const labelHours = [...hours, END_HOUR];

  // Fetch recurring events
  const fetchRecurringEvents = useCallback(async () => {
    if (!session?.user) {
      setRecurringEvents([]);
      return;
    }

    try {
      const response = await fetch("/api/recurring-events");
      if (response.ok) {
        const data = await response.json();
        setRecurringEvents(data.filter((e: RecurringEvent) => e.enabled));
      }
    } catch (error) {
      console.error("Error fetching recurring events:", error);
      setRecurringEvents([]);
    }
  }, [session?.user]);

  // Fetch Outlook events function
  const fetchOutlookEvents = async () => {
    if (!session?.user) {
      setOutlookEvents([]);
      return;
    }

    setIsLoadingOutlookEvents(true);
    try {
      // Convert dates to user's timezone for the query
      const startDate = startOfDay(visibleDays[0]);
      const endDate = addDays(
        startOfDay(visibleDays[visibleDays.length - 1]),
        1
      ); // End of last visible day

      // Format dates in user's timezone for Outlook API
      const startDateTime = formatInTimeZone(
        startDate,
        userTimeZone,
        "yyyy-MM-dd'T'00:00:00"
      );
      const endDateTime = formatInTimeZone(
        endDate,
        userTimeZone,
        "yyyy-MM-dd'T'00:00:00"
      );

      const response = await fetch(
        `/api/outlook/events?startDateTime=${encodeURIComponent(
          startDateTime
        )}&endDateTime=${encodeURIComponent(
          endDateTime
        )}&timeZone=${encodeURIComponent(userTimeZone)}`
      );

      if (response.ok) {
        const data = await response.json();
        setOutlookEvents(data.events || []);
      } else if (response.status === 400) {
        // Outlook not connected - that's fine
        setOutlookEvents([]);
      }
    } catch (error) {
      console.error("Error fetching Outlook events:", error);
      setOutlookEvents([]);
    } finally {
      setIsLoadingOutlookEvents(false);
    }
  };

  // Get scheduled tasks hash to detect when calendar changes
  const scheduledTasksHash = tasks
    .filter((t) => t.scheduledTime)
    .map((t) => `${t.id}:${t.scheduledTime}`)
    .sort()
    .join(",");

  // Fetch recurring events on mount and when session changes
  useEffect(() => {
    if (session?.user) {
      fetchRecurringEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Listen for recurring event updates
  useEffect(() => {
    const handleRecurringEventUpdate = () => {
      fetchRecurringEvents();
    };
    window.addEventListener(
      "recurringEventUpdated",
      handleRecurringEventUpdate
    );
    return () => {
      window.removeEventListener(
        "recurringEventUpdated",
        handleRecurringEventUpdate
      );
    };
  }, [fetchRecurringEvents]);

  // Fetch Outlook events when visible days change (initial load or navigation)
  useEffect(() => {
    fetchOutlookEvents();
    // Use dayOffset and calendarMode instead of visibleDays to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayOffset, calendarMode, session?.user?.id]);

  // Refresh Outlook events when scheduled tasks change (when something is added/updated/deleted on calendar)
  // This only triggers when scheduled tasks actually change, not on every task update
  useEffect(() => {
    if (session?.user && scheduledTasksHash) {
      // Only refresh if we have scheduled tasks (to avoid unnecessary fetches on initial load)
      fetchOutlookEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledTasksHash, session?.user?.id]);

  const goToPreviousDays = () =>
    setDayOffset((prev) => prev - (calendarMode === "1-day" ? 1 : 3));
  const goToNextDays = () =>
    setDayOffset((prev) => prev + (calendarMode === "1-day" ? 1 : 3));
  const goToToday = () => setDayOffset(0);

  const getRecurringEventsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const scheduledTasksForDate = getScheduledTasksForDate(date);

    return recurringEvents
      .map((event) => {
        const [hours, minutes] = event.timeOfDay.split(":").map(Number);
        const startTime = new Date(date);
        startTime.setHours(hours, minutes, 0, 0);
        const endTime = new Date(
          startTime.getTime() + event.duration * 60 * 1000
        );

        // Check if any scheduled task overlaps with this recurring event
        const hasOverlappingTask = scheduledTasksForDate.some(
          ({ scheduledTime }) => {
            const taskStart = new Date(scheduledTime.startTime);
            const taskEnd = new Date(
              taskStart.getTime() + scheduledTime.duration * 60 * 1000
            );

            // Check if tasks overlap (within 5 minutes tolerance)
            return (
              taskStart.getTime() <= endTime.getTime() + 5 * 60 * 1000 &&
              taskEnd.getTime() >= startTime.getTime() - 5 * 60 * 1000
            );
          }
        );

        // Only return if no overlapping task
        if (hasOverlappingTask) return null;

        return {
          event,
          startTime: startTime.toISOString(),
        };
      })
      .filter(
        (item): item is { event: RecurringEvent; startTime: string } =>
          item !== null
      );
  };

  const getScheduledTasksForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const result: Array<{
      task: Task;
      scheduledTime: { id: string; startTime: string; duration: number };
    }> = [];

    tasks.forEach((task) => {
      // Check scheduledTimes array (new system)
      if (task.scheduledTimes && task.scheduledTimes.length > 0) {
        task.scheduledTimes.forEach((st) => {
          const stDate = new Date(st.startTime);
          if (format(stDate, "yyyy-MM-dd") === dateStr) {
            result.push({ task, scheduledTime: st });
          }
        });
      }
      // Fallback to old scheduledTime field for backward compatibility
      else if (task.scheduledTime) {
        const taskDate = new Date(task.scheduledTime);
        if (format(taskDate, "yyyy-MM-dd") === dateStr) {
          result.push({
            task,
            scheduledTime: {
              id: `legacy-${task.id}`,
              startTime: task.scheduledTime,
              duration: task.timeRequired,
            },
          });
        }
      }
    });

    return result;
  };

  const getOutlookEventsForDate = (date: Date) => {
    const scheduledTasksForDate = getScheduledTasksForDate(date);

    return outlookEvents.filter((event) => {
      // Convert event time from its timezone to user's timezone for comparison
      const eventTimeZone = event.start.timeZone || userTimeZone;
      const eventDate = toZonedTime(
        new Date(event.start.dateTime),
        eventTimeZone
      );
      const eventEndDate = toZonedTime(
        new Date(event.end.dateTime),
        eventTimeZone
      );

      // Check if event is on this date
      if (format(eventDate, "yyyy-MM-dd") !== format(date, "yyyy-MM-dd")) {
        return false;
      }

      // Check if this Outlook event matches any of our scheduled tasks
      // (to avoid showing duplicates when we sync tasks to Outlook)
      const eventDuration =
        (eventEndDate.getTime() - eventDate.getTime()) / (1000 * 60); // duration in minutes

      const matchesTask = scheduledTasksForDate.some(
        ({ task, scheduledTime }) => {
          // Compare title/subject
          if (event.subject !== task.title) return false;

          // Compare start time (within 1 minute tolerance)
          const taskStart = new Date(scheduledTime.startTime);
          const timeDiff = Math.abs(eventDate.getTime() - taskStart.getTime());
          if (timeDiff > 60 * 1000) return false; // More than 1 minute difference

          // Compare duration (within 1 minute tolerance)
          const durationDiff = Math.abs(eventDuration - scheduledTime.duration);
          if (durationDiff > 1) return false; // More than 1 minute difference

          return true;
        }
      );

      // Only include events that don't match any scheduled task
      return !matchesTask;
    });
  };

  const getOutlookEventPosition = (event: OutlookEvent) => {
    // Convert event time from its timezone to user's timezone
    const eventTimeZone = event.start.timeZone || userTimeZone;
    const startDate = toZonedTime(
      new Date(event.start.dateTime),
      eventTimeZone
    );
    const endDate = toZonedTime(new Date(event.end.dateTime), eventTimeZone);
    const hour = startDate.getHours();
    const minutes = startDate.getMinutes();
    const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60); // duration in minutes
    const top = (hour - START_HOUR + minutes / 60) * HOUR_HEIGHT;
    const height = (duration / 60) * HOUR_HEIGHT;
    return { top, height };
  };

  const handleDragOver = (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // Get the task duration from drag data (set during dragStart)
    const taskDurationStr = e.dataTransfer.getData("taskDuration");
    const taskId = e.dataTransfer.getData("taskId");

    let taskDuration = taskDurationStr ? parseInt(taskDurationStr, 10) : NaN;

    // Fallback: if duration wasn't provided or couldn't be parsed, derive it from the task
    if ((!taskDurationStr || Number.isNaN(taskDuration)) && taskId) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        taskDuration = task.timeRequired || 30;
      }
    }

    // Final safety fallback
    if (!taskDuration || taskDuration <= 0) {
      taskDuration = 30;
    }

    // Calculate exact drop position to show accurate highlight
    const hourSlot = e.currentTarget as HTMLElement;
    const offsetY = e.nativeEvent.offsetY;
    const slotTop = (hour - START_HOUR) * HOUR_HEIGHT;
    const totalY = slotTop + offsetY;

    // Convert Y position to exact hour (with decimals)
    const exactHour = Math.max(
      START_HOUR,
      Math.min(END_HOUR, totalY / HOUR_HEIGHT + START_HOUR)
    );
    const hourFloor = Math.floor(exactHour);
    // Round to nearest 30 minutes (0 or 30)
    const minutes = Math.round(((exactHour - hourFloor) * 60) / 30) * 30;

    // Calculate the top position for the highlight
    const highlightTop = (hourFloor - START_HOUR + minutes / 60) * HOUR_HEIGHT;

    setDragOverSlot({
      date,
      hour: hourFloor,
      minutes,
      duration: taskDuration,
      top: highlightTop,
    });
  };

  const handleDrop = async (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const scheduledTimeId = e.dataTransfer.getData("scheduledTimeId"); // For editing existing scheduled times
    if (taskId) {
      const task = tasks.find((t) => t.id === taskId);

      // Calculate exact drop position to support half-hour increments
      // The drop happens on the hour slot div, which is absolutely positioned
      const hourSlot = e.currentTarget as HTMLElement;

      // Get the position within the hour slot (0 to HOUR_HEIGHT)
      const offsetY = e.nativeEvent.offsetY;

      // Calculate the total Y position: hour slot's top position + offset within slot
      const slotTop = (hour - START_HOUR) * HOUR_HEIGHT;
      const totalY = slotTop + offsetY;

      // Convert Y position to exact hour (with decimals)
      const exactHour = Math.max(
        START_HOUR,
        Math.min(END_HOUR, totalY / HOUR_HEIGHT + START_HOUR)
      );
      const hourFloor = Math.floor(exactHour);
      // Round to nearest 30 minutes (0 or 30)
      const minutes = Math.round(((exactHour - hourFloor) * 60) / 30) * 30;

      const startTime = setMinutes(
        setHours(date, hourFloor),
        minutes
      ).toISOString();

      if (scheduledTimeId && scheduledTimeId !== "undefined") {
        // Update existing scheduled time slot (moving it)
        const scheduledTime = task?.scheduledTimes?.find(
          (st) => st.id === scheduledTimeId
        );
        if (scheduledTime) {
          try {
            const response = await fetch(
              `/api/tasks/${taskId}/scheduled-times/${scheduledTimeId}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  startTime,
                  duration: scheduledTime.duration, // Keep same duration when moving
                }),
              }
            );

            if (response.ok) {
              await refreshTasks();
            }
          } catch (error) {
            console.error("Error updating scheduled time:", error);
          }
        }
      } else {
        // Create new scheduled time slot
        const hasScheduledTimes =
          task?.scheduledTimes && task.scheduledTimes.length > 0;
        const duration = hasScheduledTimes ? 30 : task?.timeRequired || 30;

        try {
          const response = await fetch(`/api/tasks/${taskId}/scheduled-times`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startTime, duration }),
          });

          if (response.ok) {
            await refreshTasks();
          }
        } catch (error) {
          console.error("Error adding scheduled time:", error);
        }
      }
    }
    setDragOverSlot(null);
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleMouseDown = (e: React.MouseEvent, date: Date, hour: number) => {
    // Only start creating if clicking on empty space (not on a task or event)
    // Check if the click target is the hour slot itself or a child element that's not a task/event
    const target = e.target as HTMLElement;
    const isTaskOrEvent =
      target.closest('[draggable="true"]') ||
      target.closest(".bg-blue-100") ||
      target.closest(".bg-primary");

    if (
      !isTaskOrEvent &&
      (target.classList.contains("hour-slot") || target.closest(".hour-slot"))
    ) {
      e.preventDefault();
      e.stopPropagation();

      // Find the day column container (parent with class containing "flex-1 relative")
      const dayColumn = target.closest(
        '[class*="flex-1 relative"]'
      ) as HTMLElement;
      if (!dayColumn) return;

      const rect = dayColumn.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const exactHour = y / HOUR_HEIGHT + START_HOUR;
      const hourFloor = Math.floor(exactHour);
      // Round to nearest 30 minutes
      const minutes = Math.round(((exactHour - hourFloor) * 60) / 30) * 30;
      const top = (hourFloor - START_HOUR + minutes / 60) * HOUR_HEIGHT;

      setIsCreatingEvent(true);
      setCreateEventStart({ date, hour: hourFloor, minutes, top });
      setCreateEventEnd({ date, hour: hourFloor, minutes, top });
    }
  };

  const handleMouseMove = (e: React.MouseEvent, date: Date) => {
    // Handle resize
    if (resizingTask) {
      const dayColumn = e.currentTarget as HTMLElement;
      const rect = dayColumn.getBoundingClientRect();
      const y = e.clientY - rect.top;

      // Use the scheduled date (the date the task is on)
      const scheduledDate = resizingTask.scheduledDate;

      // Calculate the exact hour and minutes from the mouse position
      const exactHour = Math.max(
        START_HOUR,
        Math.min(END_HOUR, y / HOUR_HEIGHT + START_HOUR)
      );
      const hourFloor = Math.floor(exactHour);
      // Round to nearest 30 minutes
      const minutes = Math.round(((exactHour - hourFloor) * 60) / 30) * 30;
      const newTime = setMinutes(setHours(scheduledDate, hourFloor), minutes);

      if (resizingTask.resizeEdge === "top") {
        // Resizing from top - calculate new start time from mouse position
        const originalStart = new Date(resizingTask.startTime);
        const originalEnd = new Date(
          originalStart.getTime() + resizingTask.duration * 60 * 1000
        );

        // New start time is the mouse position (rounded to 30 minutes)
        const newStartTime = newTime;
        // New duration is the difference between new start and original end
        const newDuration = Math.max(
          30,
          Math.round(
            (originalEnd.getTime() - newStartTime.getTime()) / (1000 * 60) / 30
          ) * 30
        );

        // Ensure start time doesn't go past end time
        if (newStartTime < originalEnd && newDuration >= 30) {
          setResizingTask({
            ...resizingTask,
            startTime: newStartTime.toISOString(),
            duration: newDuration,
          });
        }
      } else {
        // Resizing from bottom - calculate new end time from mouse position
        const originalStart = new Date(resizingTask.startTime);
        const newEndTime = newTime;

        // New duration is the difference between original start and new end
        const newDuration = Math.max(
          30,
          Math.round(
            (newEndTime.getTime() - originalStart.getTime()) / (1000 * 60) / 30
          ) * 30
        );

        // Ensure end time is after start time
        if (newEndTime > originalStart && newDuration >= 30) {
          setResizingTask({
            ...resizingTask,
            duration: newDuration,
          });
        }
      }
      return;
    }

    // Handle event creation
    if (!isCreatingEvent || !createEventStart) return;

    // Get the exact position within the day column (the currentTarget is the day column div)
    const dayColumn = e.currentTarget as HTMLElement;
    const rect = dayColumn.getBoundingClientRect();
    const y = e.clientY - rect.top;
    // Calculate exact hour with minutes, rounded to nearest 30 minutes
    const exactHour = Math.max(
      START_HOUR,
      Math.min(END_HOUR, y / HOUR_HEIGHT + START_HOUR)
    );
    const hourFloor = Math.floor(exactHour);
    // Round to nearest 30 minutes
    const minutes = Math.round(((exactHour - hourFloor) * 60) / 30) * 30;
    const top = (hourFloor - START_HOUR + minutes / 60) * HOUR_HEIGHT;

    setCreateEventEnd({ date, hour: hourFloor, minutes, top });
  };

  const handleMouseUp = async () => {
    // Handle resize end
    if (resizingTask) {
      const { taskId, scheduledTimeId, startTime, duration } = resizingTask;
      try {
        const response = await fetch(
          `/api/tasks/${taskId}/scheduled-times/${scheduledTimeId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startTime, duration }),
          }
        );
        if (response.ok) {
          await refreshTasks();
        }
      } catch (error) {
        console.error("Error updating scheduled time:", error);
      }
      setResizingTask(null);
      return;
    }

    // Handle event creation
    if (!isCreatingEvent || !createEventStart || !createEventEnd) {
      setIsCreatingEvent(false);
      setCreateEventStart(null);
      setCreateEventEnd(null);
      return;
    }

    // Calculate the scheduled time from the start position (with exact minutes)
    const startDate = setMinutes(
      setHours(createEventStart.date, createEventStart.hour),
      createEventStart.minutes
    );
    const scheduledTime = startDate.toISOString();

    // Calculate exact duration in minutes (allows for half-hours, etc.)
    const startTotalMinutes =
      createEventStart.hour * 60 + createEventStart.minutes;
    const endTotalMinutes = createEventEnd.hour * 60 + createEventEnd.minutes;
    let duration = Math.max(15, endTotalMinutes - startTotalMinutes); // Minimum 15 minutes
    // Round to nearest 15 minutes for cleaner durations
    duration = Math.round(duration / 15) * 15;

    // Open task form with pre-filled scheduled time and duration
    if (onAddTask) {
      onAddTask(createEventStart.date, scheduledTime, duration);
    }

    setIsCreatingEvent(false);
    setCreateEventStart(null);
    setCreateEventEnd(null);
  };

  const getTaskPosition = (startTime: string, duration: number) => {
    const taskDate = new Date(startTime);
    const hour = taskDate.getHours();
    const minutes = taskDate.getMinutes();
    const top = (hour - START_HOUR + minutes / 60) * HOUR_HEIGHT;
    const height = (duration / 60) * HOUR_HEIGHT;
    return { top, height };
  };

  const now = new Date();

  return (
    <div className="w-1/2 flex flex-col bg-card">
      {/* Header with toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-semibold">Calendar</h2>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-3 text-xs",
              calendarMode === "1-day" && "bg-background shadow-sm"
            )}
            onClick={() => setCalendarMode("1-day")}
          >
            1 Day
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-3 text-xs",
              calendarMode === "3-day" && "bg-background shadow-sm"
            )}
            onClick={() => setCalendarMode("3-day")}
          >
            3 Days
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={goToPreviousDays}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {calendarMode === "1-day"
              ? format(visibleDays[0], "EEEE, MMM d")
              : `${format(visibleDays[0], "MMM d")} - ${format(
                  visibleDays[2],
                  "MMM d"
                )}`}
          </span>
          {dayOffset !== 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2 bg-transparent"
              onClick={goToToday}
            >
              Today
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={goToNextDays}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day headers for multi-day view */}
      {calendarMode === "3-day" && (
        <div className="flex border-b border-border">
          <div className="w-14 shrink-0" />
          {visibleDays.map((date) => (
            <div
              key={date.toISOString()}
              className="flex-1 px-2 py-2 text-center border-l border-border first:border-l-0"
            >
              <p
                className={cn(
                  "text-xs font-medium",
                  isToday(date) && "text-primary"
                )}
              >
                {isToday(date) ? "Today" : format(date, "EEE")}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(date, "MMM d")}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto" ref={containerRef}>
        {/* Wrapper adds extra scrollable space above and below the grid */}
        <div
          className="flex flex-col"
          style={{
            minHeight: hours.length * HOUR_HEIGHT + GRID_VERTICAL_PADDING * 2,
          }}
        >
          {/* Top spacer */}
          <div style={{ height: GRID_VERTICAL_PADDING }} />

          <div className="flex" style={{ height: hours.length * HOUR_HEIGHT }}>
            {/* Time column */}
            <div className="w-14 shrink-0 relative">
              {labelHours.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-border"
                  style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                >
                  <span className="text-xs text-muted-foreground pr-2 -mt-2 block text-right">
                    {format(setHours(new Date(), hour % 24), "h a")}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {visibleDays.map((date, dayIndex) => {
              const scheduledTasks = getScheduledTasksForDate(date);
              const currentTimeTop =
                isToday(date) &&
                now.getHours() >= START_HOUR &&
                now.getHours() < END_HOUR
                  ? (now.getHours() - START_HOUR + now.getMinutes() / 60) *
                    HOUR_HEIGHT
                  : null;

              return (
                <div
                  key={date.toISOString()}
                  className={cn(
                    "flex-1 relative",
                    dayIndex > 0 && "border-l border-border"
                  )}
                  onMouseMove={(e) => {
                    if (isCreatingEvent || resizingTask) {
                      handleMouseMove(e, date);
                    }
                  }}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => {
                    if (resizingTask) {
                      handleMouseUp();
                    }
                  }}
                >
                  {/* Hour grid lines */}
                  {hours.map((hour) => {
                    return (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 border-t border-border hour-slot cursor-pointer"
                        style={{
                          top: (hour - START_HOUR) * HOUR_HEIGHT,
                          height: HOUR_HEIGHT,
                        }}
                        onDragOver={(e) => handleDragOver(e, date, hour)}
                        onDrop={(e) => handleDrop(e, date, hour)}
                        onDragLeave={handleDragLeave}
                        onMouseDown={(e) => {
                          // Only start creating if not dragging a task
                          if (e.button === 0 && !e.defaultPrevented) {
                            handleMouseDown(e, date, hour);
                          }
                        }}
                      />
                    );
                  })}
                  {/* Bottom boundary line so the final 12 AM label has a full-width bar */}
                  <div
                    className="absolute left-0 right-0 border-t border-border"
                    style={{ top: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}
                  />

                  {/* Drag-over highlight showing exact task size */}
                  {dragOverSlot &&
                    dragOverSlot.date.getTime() === date.getTime() && (
                      <div
                        className="absolute left-1 right-1 rounded bg-primary/20 border-2 border-primary border-dashed pointer-events-none z-30"
                        style={{
                          top: dragOverSlot.top,
                          height: (dragOverSlot.duration / 60) * HOUR_HEIGHT,
                        }}
                      >
                        <div className="p-1 text-xs text-primary font-medium">
                          {dragOverSlot.duration < 60
                            ? `${dragOverSlot.duration}m`
                            : `${Math.floor(dragOverSlot.duration / 60)}h ${
                                dragOverSlot.duration % 60
                              }m`}
                        </div>
                      </div>
                    )}

                  {/* Visual indicator for creating event */}
                  {isCreatingEvent &&
                    createEventStart &&
                    createEventEnd &&
                    createEventStart.date.getTime() === date.getTime() && (
                      <div
                        className="absolute left-1 right-1 rounded bg-primary/20 border-2 border-primary border-dashed pointer-events-none z-30"
                        style={{
                          top: Math.min(
                            createEventStart.top,
                            createEventEnd.top
                          ),
                          height: Math.max(
                            Math.abs(createEventEnd.top - createEventStart.top),
                            HOUR_HEIGHT / 2
                          ),
                        }}
                      >
                        <div className="p-1 text-xs text-primary font-medium">
                          New event
                        </div>
                      </div>
                    )}

                  {/* Current time indicator */}
                  {currentTimeTop !== null && (
                    <div
                      className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
                      style={{ top: currentTimeTop }}
                    >
                      <div className="w-2 h-2 rounded-full bg-destructive -ml-1" />
                      <div className="flex-1 h-0.5 bg-destructive" />
                    </div>
                  )}

                  {/* Outlook events */}
                  {getOutlookEventsForDate(date).map((event) => {
                    const pos = getOutlookEventPosition(event);
                    if (!pos) return null;

                    // Convert event times to user's timezone for display
                    const eventTimeZone = event.start.timeZone || userTimeZone;
                    const startDate = toZonedTime(
                      new Date(event.start.dateTime),
                      eventTimeZone
                    );
                    const endDate = toZonedTime(
                      new Date(event.end.dateTime),
                      eventTimeZone
                    );

                    return (
                      <ContextMenu key={event.id}>
                        <ContextMenuTrigger asChild>
                          <div
                            className="absolute left-1 right-1 rounded px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 overflow-hidden"
                            style={{
                              top: pos.top,
                              height: Math.max(pos.height, 20),
                              zIndex: 5,
                            }}
                            title={`${event.subject}\n${format(
                              startDate,
                              "h:mm a"
                            )} - ${format(endDate, "h:mm a")}`}
                          >
                            <div className="font-medium truncate">
                              {event.subject}
                            </div>
                            <div className="text-[10px] opacity-75">
                              {format(startDate, "h:mm a")} -{" "}
                              {format(endDate, "h:mm a")}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={async () => {
                              try {
                                const response = await fetch(
                                  `/api/outlook/events/${event.id}`,
                                  { method: "DELETE" }
                                );
                                if (response.ok) {
                                  await fetchOutlookEvents();
                                } else {
                                  const errorData = await response
                                    .json()
                                    .catch(() => ({}));
                                  alert(
                                    `Failed to delete: ${
                                      errorData.error || "Unknown error"
                                    }`
                                  );
                                }
                              } catch (error) {
                                console.error(
                                  "Error deleting Outlook event:",
                                  error
                                );
                                alert(
                                  "Failed to delete event. Please try again."
                                );
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}

                  {/* Recurring events (orange, translucent, visual placeholder only) */}
                  {getRecurringEventsForDate(date).map(
                    ({ event, startTime }) => {
                      const pos = getTaskPosition(startTime, event.duration);
                      if (!pos) return null;

                      return (
                        <ContextMenu
                          key={`recurring-${event.id}-${date.toISOString()}`}
                        >
                          <ContextMenuTrigger asChild>
                            <div
                              className="absolute left-1 right-1 bg-orange-500/30 dark:bg-orange-600/30 text-orange-900 dark:text-orange-100 rounded-md p-2 shadow-sm"
                              style={{
                                top: pos.top + 2,
                                height: Math.max(pos.height - 4, 24),
                                zIndex: 1, // Lower z-index so tasks appear on top
                              }}
                              title={`${event.title} (Recurring placeholder)\n${event.timeOfDay} - ${event.duration} min`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium truncate opacity-70">
                                    {event.title}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem
                              onClick={() => {
                                setEditingRecurringEvent(event);
                                setIsRecurringEventFormOpen(true);
                              }}
                            >
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Edit
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onClick={async () => {
                                try {
                                  const response = await fetch(
                                    `/api/recurring-events/${event.id}`,
                                    { method: "DELETE" }
                                  );
                                  if (response.ok) {
                                    await fetchRecurringEvents();
                                  } else {
                                    const errorData = await response
                                      .json()
                                      .catch(() => ({}));
                                    alert(
                                      `Failed to delete: ${
                                        errorData.error || "Unknown error"
                                      }`
                                    );
                                  }
                                } catch (error) {
                                  console.error(
                                    "Error deleting recurring event:",
                                    error
                                  );
                                  alert(
                                    "Failed to delete event. Please try again."
                                  );
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    }
                  )}

                  {/* Scheduled tasks */}
                  {scheduledTasks.map(({ task, scheduledTime }) => {
                    // Use resizing state if this task is being resized
                    const isResizing =
                      resizingTask?.scheduledTimeId === scheduledTime.id;
                    const displayStartTime = isResizing
                      ? resizingTask.startTime
                      : scheduledTime.startTime;
                    const displayDuration = isResizing
                      ? resizingTask.duration
                      : scheduledTime.duration;
                    const pos = getTaskPosition(
                      displayStartTime,
                      displayDuration
                    );
                    if (!pos) return null;

                    return (
                      <ContextMenu key={`${task.id}-${scheduledTime.id}`}>
                        <ContextMenuTrigger asChild>
                          <div
                            draggable={!isResizing}
                            onDragStart={(e) => {
                              // Don't start drag if clicking on resize handle
                              const target = e.target as HTMLElement;
                              if (target.classList.contains("resize-handle")) {
                                e.preventDefault();
                                return;
                              }
                              e.dataTransfer.setData("taskId", task.id);
                              // Provide duration so drag-over highlight matches this slot's length
                              e.dataTransfer.setData(
                                "taskDuration",
                                displayDuration.toString()
                              );
                              e.dataTransfer.setData(
                                "scheduledTimeId",
                                scheduledTime.id
                              );
                              e.dataTransfer.setData("fromCalendar", "true");
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            className="absolute left-1 right-1 bg-primary text-primary-foreground rounded-md p-2 cursor-grab active:cursor-grabbing hover:bg-primary/90 transition-colors shadow-sm group z-10"
                            style={{
                              top: pos.top + 2,
                              height: Math.max(pos.height - 4, 24),
                              zIndex: 10,
                            }}
                          >
                            {/* Top resize handle */}
                            <div
                              className="absolute left-0 right-0 top-0 h-2 cursor-ns-resize resize-handle z-20"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const scheduledDate = new Date(
                                  scheduledTime.startTime
                                );
                                setResizingTask({
                                  taskId: task.id,
                                  scheduledTimeId: scheduledTime.id,
                                  startTime: scheduledTime.startTime,
                                  duration: scheduledTime.duration,
                                  resizeEdge: "top",
                                  initialY: 0, // Not used anymore, but kept for type compatibility
                                  scheduledDate: scheduledDate,
                                });
                              }}
                            />

                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">
                                  {task.title}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-70 group-hover:opacity-100 -mr-1 -mt-1 hover:bg-primary-foreground/20 text-primary-foreground shrink-0"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  // Delete this specific scheduled time slot
                                  try {
                                    const response = await fetch(
                                      `/api/tasks/${task.id}/scheduled-times/${scheduledTime.id}`,
                                      { method: "DELETE" }
                                    );
                                    if (response.ok) {
                                      // Force a refresh to ensure UI updates
                                      await refreshTasks();
                                      // Also trigger Outlook events refresh if needed
                                      if (session?.user) {
                                        // Small delay to ensure database is updated
                                        setTimeout(() => {
                                          refreshTasks();
                                        }, 100);
                                      }
                                    } else {
                                      const errorData = await response
                                        .json()
                                        .catch(() => ({}));
                                      console.error(
                                        "Error deleting scheduled time:",
                                        response.status,
                                        errorData
                                      );
                                      alert(
                                        `Failed to delete: ${
                                          errorData.error || "Unknown error"
                                        }`
                                      );
                                    }
                                  } catch (error) {
                                    console.error(
                                      "Error deleting scheduled time:",
                                      error
                                    );
                                    alert(
                                      "Failed to delete scheduled time. Please try again."
                                    );
                                  }
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>

                            {/* Bottom resize handle */}
                            <div
                              className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize resize-handle z-20"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const scheduledDate = new Date(
                                  scheduledTime.startTime
                                );
                                setResizingTask({
                                  taskId: task.id,
                                  scheduledTimeId: scheduledTime.id,
                                  startTime: scheduledTime.startTime,
                                  duration: scheduledTime.duration,
                                  resizeEdge: "bottom",
                                  initialY: 0, // Not used anymore, but kept for type compatibility
                                  scheduledDate: scheduledDate,
                                });
                              }}
                            />
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => {
                              if (onAddTask) {
                                const startDate = new Date(
                                  scheduledTime.startTime
                                );
                                onAddTask(
                                  startDate,
                                  scheduledTime.startTime,
                                  scheduledTime.duration
                                );
                              }
                            }}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit Task
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onClick={async () => {
                              try {
                                const response = await fetch(
                                  `/api/tasks/${task.id}/scheduled-times/${scheduledTime.id}`,
                                  { method: "DELETE" }
                                );
                                if (response.ok) {
                                  await refreshTasks();
                                } else {
                                  const errorData = await response
                                    .json()
                                    .catch(() => ({}));
                                  alert(
                                    `Failed to delete: ${
                                      errorData.error || "Unknown error"
                                    }`
                                  );
                                }
                              } catch (error) {
                                console.error(
                                  "Error deleting scheduled time:",
                                  error
                                );
                                alert("Failed to delete. Please try again.");
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Bottom spacer */}
          <div style={{ height: GRID_VERTICAL_PADDING }} />
        </div>
      </div>

      <div className="p-3 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          Drag tasks to schedule / Drag back to unschedule
        </p>
      </div>

      <RecurringEventForm
        open={isRecurringEventFormOpen}
        onOpenChange={(open) => {
          setIsRecurringEventFormOpen(open);
          if (!open) {
            setEditingRecurringEvent(null);
          }
        }}
        editingEvent={
          editingRecurringEvent
            ? {
                ...editingRecurringEvent,
                description: editingRecurringEvent.description ?? undefined,
              }
            : undefined
        }
        onSuccess={() => {
          fetchRecurringEvents();
          setEditingRecurringEvent(null);
          setIsRecurringEventFormOpen(false);
        }}
      />
    </div>
  );
}
