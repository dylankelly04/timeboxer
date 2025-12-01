"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { format, addDays, startOfDay, isBefore, isSameDay } from "date-fns"
import { List, CalendarDays, Plus, ChevronLeft, ChevronRight, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskCard } from "./task-card"
import { DayColumn } from "./day-column"
import { ReminderForm } from "./reminder-form"
import { useTasks } from "@/lib/task-context"
import type { Task, Reminder } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"

type ViewMode = "all" | "by-day"

interface TaskListViewProps {
  onAddTask: (date?: Date) => void
  onEditTask: (task: Task) => void
  width?: number | null
}

export function TaskListView({ onAddTask, onEditTask, width }: TaskListViewProps) {
  const { tasks, moveTaskToDate } = useTasks()
  const { data: session } = useSession()
  const [viewMode, setViewMode] = useState<ViewMode>("by-day")
  const [dayOffset, setDayOffset] = useState(0)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [isReminderFormOpen, setIsReminderFormOpen] = useState(false)

  // Fetch reminders
  const fetchReminders = useCallback(async () => {
    if (!session?.user) {
      setReminders([])
      return
    }

    try {
      const response = await fetch("/api/reminders")
      if (response.ok) {
        const data = await response.json()
        setReminders(data)
      }
    } catch (error) {
      console.error("Error fetching reminders:", error)
    }
  }, [session?.user])

  useEffect(() => {
    fetchReminders()
  }, [fetchReminders])

  // Listen for reminder updates
  useEffect(() => {
    const handleReminderUpdate = () => {
      fetchReminders()
    }

    window.addEventListener("reminderUpdated", handleReminderUpdate)
    return () => {
      window.removeEventListener("reminderUpdated", handleReminderUpdate)
    }
  }, [fetchReminders])

  // Get reminders for a specific date
  const getRemindersForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    return reminders.filter((reminder) => {
      return reminder.startDate <= dateStr && reminder.endDate >= dateStr
    })
  }

  const handleEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder)
    setIsReminderFormOpen(true)
  }

  // For "by-day" view: 3 days starting from today + offset
  const today = startOfDay(new Date())
  const startDay = addDays(today, dayOffset)
  const days = [startDay, addDays(startDay, 1), addDays(startDay, 2)]

  const getTasksForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    return tasks.filter((task) => task.startDate === dateStr)
  }

  // Get rollover tasks for a specific date
  // Rollover tasks are incomplete tasks from previous days that should appear on the current/future day
  const getRolloverTasksForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    const dateStart = startOfDay(date)

    // Only show rollovers for today or future dates
    if (isBefore(dateStart, today)) {
      return []
    }

    // For today, get all incomplete tasks from previous days
    // For future days, don't show rollovers (they'll appear on their original date or today)
    if (!isSameDay(dateStart, today)) {
      return []
    }

    return tasks.filter((task) => {
      // Must be incomplete
      if (task.completed) return false

      // Must be from a previous day (startDate before today)
      const taskStartDate = new Date(task.startDate + "T00:00:00")
      const taskStartDateStart = startOfDay(taskStartDate)

      return isBefore(taskStartDateStart, today)
    })
  }

  // For "all" view: categorize tasks
  // Exclude completed tasks whose due date is today or in the past (they go to archive)
  const isArchivedTask = (task: Task) => {
    if (!task.completed) return false
    const dueDate = new Date(task.dueDate + "T00:00:00")
    const dueDateStart = startOfDay(dueDate)
    return isBefore(dueDateStart, today) || isSameDay(dueDateStart, today)
  }

  // Get all rollover tasks (incomplete tasks from previous days) for "all" view
  const rolloverTasks = tasks.filter((task) => {
    if (task.completed) return false
    const taskStartDate = new Date(task.startDate + "T00:00:00")
    const taskStartDateStart = startOfDay(taskStartDate)
    return isBefore(taskStartDateStart, today)
  })

  const hasScheduledTime = (t: Task) => t.scheduledTime || (t.scheduledTimes && t.scheduledTimes.length > 0)
  // Exclude rollover tasks from scheduled/pending (they'll be shown separately)
  const isRolloverTask = (t: Task) => {
    const taskStartDate = new Date(t.startDate + "T00:00:00")
    const taskStartDateStart = startOfDay(taskStartDate)
    return isBefore(taskStartDateStart, today)
  }
  const scheduledTasks = tasks.filter((t) => hasScheduledTime(t) && !t.completed && !isRolloverTask(t))
  const pendingTasks = tasks.filter((t) => !hasScheduledTime(t) && !t.completed && !isRolloverTask(t))
  const completedTasks = tasks.filter((t) => t.completed && !isArchivedTask(t))

  const goToPreviousDays = () => setDayOffset((prev) => prev - 3)
  const goToNextDays = () => setDayOffset((prev) => prev + 3)
  const goToToday = () => setDayOffset(0)

  return (
    <div
      className="flex flex-col bg-muted/30 shrink-0"
      style={{ width: width !== null && width !== undefined ? `${width}px` : "50%" }}
    >
      {/* Header with toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <h2 className="font-semibold">Tasks</h2>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 px-3 text-xs", viewMode === "all" && "bg-background shadow-sm")}
            onClick={() => setViewMode("all")}
          >
            <List className="h-3.5 w-3.5 mr-1.5" />
            All Tasks
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 px-3 text-xs", viewMode === "by-day" && "bg-background shadow-sm")}
            onClick={() => setViewMode("by-day")}
          >
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
            By Day
          </Button>
        </div>
      </div>

      {viewMode === "by-day" && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={goToPreviousDays}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {format(days[0], "MMM d")} - {format(days[2], "MMM d")}
            </span>
            {dayOffset !== 0 && (
              <Button variant="outline" size="sm" className="h-6 text-xs px-2 bg-transparent" onClick={goToToday}>
                Today
              </Button>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={goToNextDays}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Content */}
      {viewMode === "all" ? (
        <AllTasksView
          scheduledTasks={scheduledTasks}
          pendingTasks={pendingTasks}
          completedTasks={completedTasks}
          rolloverTasks={rolloverTasks}
          reminders={reminders}
          onAddTask={() => onAddTask()}
          onEditTask={onEditTask}
          onEditReminder={handleEditReminder}
        />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {days.map((date) => (
            <DayColumn
              key={date.toISOString()}
              date={date}
              tasks={getTasksForDate(date)}
              rolloverTasks={getRolloverTasksForDate(date)}
              reminders={getRemindersForDate(date)}
              onAddTask={onAddTask}
              onEditTask={onEditTask}
              onEditReminder={handleEditReminder}
            />
          ))}
        </div>
      )}

      <ReminderForm
        open={isReminderFormOpen}
        onOpenChange={(open) => {
          setIsReminderFormOpen(open)
          if (!open) setEditingReminder(null)
        }}
        editingReminder={editingReminder}
        onSuccess={fetchReminders}
      />
    </div>
  )
}

interface AllTasksViewProps {
  scheduledTasks: Task[]
  pendingTasks: Task[]
  completedTasks: Task[]
  rolloverTasks: Task[]
  reminders: Reminder[]
  onAddTask: () => void
  onEditTask: (task: Task) => void
  onEditReminder: (reminder: Reminder) => void
}

function AllTasksView({ scheduledTasks, pendingTasks, completedTasks, rolloverTasks, reminders, onAddTask, onEditTask, onEditReminder }: AllTasksViewProps) {
  const { unscheduleTask } = useTasks()

  // Get today's reminders for the "All Tasks" view
  const todayStr = format(new Date(), "yyyy-MM-dd")
  const todaysReminders = reminders.filter((r) => r.startDate <= todayStr && r.endDate >= todayStr)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData("taskId")
    const fromCalendar = e.dataTransfer.getData("fromCalendar")
    if (taskId && fromCalendar === "true") {
      unscheduleTask(taskId)
    }
  }

  const TaskSection = ({ title, tasks, emptyMessage, isRollover = false }: { title: string; tasks: Task[]; emptyMessage: string; isRollover?: boolean }) => {
    if (tasks.length === 0) return null

    return (
      <div className="space-y-2">
        <div className={cn(
          "px-2 py-1 text-xs font-semibold uppercase tracking-wide",
          isRollover ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        )}>
          {title} ({tasks.length})
        </div>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onEdit={onEditTask} isRollover={isRollover} />
        ))}
      </div>
    )
  }

  const totalTasks = scheduledTasks.length + pendingTasks.length + completedTasks.length + rolloverTasks.length

  const handleBackgroundDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore double-clicks that originate from buttons or other interactive elements
    const target = e.target as HTMLElement
    if (target.closest("button")) {
      return
    }
    onAddTask()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" onDragOver={handleDragOver} onDrop={handleDrop}>
      <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border bg-card/50">
        {totalTasks} task{totalTasks !== 1 ? "s" : ""}
      </div>
      <div
        className="flex-1 overflow-y-auto p-3 space-y-4"
        onDoubleClick={handleBackgroundDoubleClick}
      >
        <TaskSection title="Rollover" tasks={rolloverTasks} emptyMessage="No rollover tasks" isRollover />
        <TaskSection title="Scheduled" tasks={scheduledTasks} emptyMessage="No scheduled tasks" />
        <TaskSection title="Pending" tasks={pendingTasks} emptyMessage="No pending tasks" />
        <TaskSection title="Completed" tasks={completedTasks} emptyMessage="No completed tasks" />

        {totalTasks === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">No tasks</p>
            <p className="text-xs mt-1">Add a new task to get started</p>
          </div>
        )}
      </div>

      {/* Today's Reminders */}
      {todaysReminders.length > 0 && (
        <div className="px-3 py-2 border-t border-border space-y-1">
          {todaysReminders.map((reminder) => (
            <div
              key={reminder.id}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-red-500/20 text-red-600 dark:text-red-400 text-xs cursor-pointer hover:bg-red-500/30 transition-colors"
              onClick={() => onEditReminder(reminder)}
              title={`${reminder.startDate} - ${reminder.endDate}`}
            >
              <Bell className="h-3 w-3 shrink-0" />
              <span className="truncate">{reminder.text}</span>
            </div>
          ))}
        </div>
      )}

      <button
        className="p-3 border-t border-border bg-card w-full flex items-center text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={onAddTask}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add task
      </button>
    </div>
  )
}
