"use client"

import type React from "react"

import { format, isToday, isTomorrow, isYesterday } from "date-fns"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskCard } from "./task-card"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"
import { useTasks } from "@/lib/task-context"

interface DayColumnProps {
  date: Date
  tasks: Task[]
  onAddTask: (date: Date) => void
  onEditTask: (task: Task) => void
}

export function DayColumn({ date, tasks, onAddTask, onEditTask }: DayColumnProps) {
  const { unscheduleTask, moveTaskToDate } = useTasks()

  const formatDayLabel = (date: Date) => {
    if (isToday(date)) return "Today"
    if (isTomorrow(date)) return "Tomorrow"
    if (isYesterday(date)) return "Yesterday"
    return format(date, "EEEE")
  }

  const unscheduledTasks = tasks.filter((t) => !t.scheduledTime)
  const totalTime = unscheduledTasks.reduce((sum, t) => sum + t.timeRequired, 0)
  const hours = Math.floor(totalTime / 60)
  const mins = totalTime % 60

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData("taskId")
    const fromCalendar = e.dataTransfer.getData("fromCalendar")
    const fromDay = e.dataTransfer.getData("fromDay")

    if (taskId) {
      if (fromCalendar === "true") {
        // Coming from calendar - unschedule and move to this day
        moveTaskToDate(taskId, date)
      } else if (fromDay) {
        // Coming from another day column - move to this day
        moveTaskToDate(taskId, date)
      }
    }
  }

  return (
    <div
      className="flex-1 min-w-[200px] h-full flex flex-col border-r border-border last:border-r-0 bg-card/50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="px-3 py-3 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className={cn("font-semibold text-sm", isToday(date) && "text-primary")}>{formatDayLabel(date)}</h3>
            <p className="text-xs text-muted-foreground">{format(date, "MMM d")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-muted-foreground">
              {unscheduledTasks.length} task{unscheduledTasks.length !== 1 ? "s" : ""}
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

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {unscheduledTasks.map((task) => (
          <TaskCard key={task.id} task={task} onEdit={onEditTask} fromDate={date} />
        ))}

        {unscheduledTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p className="text-xs">No tasks</p>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground text-xs"
          onClick={() => onAddTask(date)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add task
        </Button>
      </div>
    </div>
  )
}
