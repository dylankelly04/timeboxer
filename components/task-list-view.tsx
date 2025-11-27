"use client"

import type React from "react"

import { useState } from "react"
import { format, addDays, startOfDay } from "date-fns"
import { List, CalendarDays, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskCard } from "./task-card"
import { DayColumn } from "./day-column"
import { useTasks } from "@/lib/task-context"
import type { Task } from "@/lib/types"
import { cn } from "@/lib/utils"

type ViewMode = "all" | "by-day"

interface TaskListViewProps {
  onAddTask: (date?: Date) => void
  onEditTask: (task: Task) => void
}

export function TaskListView({ onAddTask, onEditTask }: TaskListViewProps) {
  const { tasks, moveTaskToDate } = useTasks()
  const [viewMode, setViewMode] = useState<ViewMode>("by-day")
  const [dayOffset, setDayOffset] = useState(0)

  // For "by-day" view: 3 days starting from today + offset
  const today = startOfDay(new Date())
  const startDay = addDays(today, dayOffset)
  const days = [startDay, addDays(startDay, 1), addDays(startDay, 2)]

  const getTasksForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    return tasks.filter((task) => task.startDate === dateStr && !task.scheduledTime)
  }

  // For "all" view: all unscheduled tasks
  const allUnscheduledTasks = tasks.filter((t) => !t.scheduledTime)

  const goToPreviousDays = () => setDayOffset((prev) => prev - 3)
  const goToNextDays = () => setDayOffset((prev) => prev + 3)
  const goToToday = () => setDayOffset(0)

  return (
    <div className="w-1/2 flex flex-col border-r border-border bg-muted/30">
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
        <AllTasksView tasks={allUnscheduledTasks} onAddTask={() => onAddTask()} onEditTask={onEditTask} />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {days.map((date) => (
            <DayColumn
              key={date.toISOString()}
              date={date}
              tasks={getTasksForDate(date)}
              onAddTask={onAddTask}
              onEditTask={onEditTask}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface AllTasksViewProps {
  tasks: Task[]
  onAddTask: () => void
  onEditTask: (task: Task) => void
}

function AllTasksView({ tasks, onAddTask, onEditTask }: AllTasksViewProps) {
  const { unscheduleTask, moveTaskToDate } = useTasks()

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

  const totalTime = tasks.reduce((sum, t) => sum + t.timeRequired, 0)
  const hours = Math.floor(totalTime / 60)
  const mins = totalTime % 60

  return (
    <div className="flex-1 flex flex-col overflow-hidden" onDragOver={handleDragOver} onDrop={handleDrop}>
      <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border bg-card/50">
        {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        {totalTime > 0 && (
          <span className="ml-2">
            ({hours > 0 && `${hours}h `}
            {mins > 0 && `${mins}m`})
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onEdit={onEditTask} />
        ))}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">No unscheduled tasks</p>
            <p className="text-xs mt-1">Drag tasks from calendar or add new ones</p>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-border bg-card">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={onAddTask}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add task
        </Button>
      </div>
    </div>
  )
}
