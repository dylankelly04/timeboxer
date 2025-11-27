"use client"

import type React from "react"

import { useState } from "react"
import { format } from "date-fns"
import { GripVertical, Clock, Calendar, Trash2, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"
import { useTasks } from "@/lib/task-context"

interface TaskCardProps {
  task: Task
  onEdit: (task: Task) => void
  isDragging?: boolean
  fromDate?: Date
}

export function TaskCard({ task, onEdit, isDragging, fromDate }: TaskCardProps) {
  const { updateTask, deleteTask } = useTasks()
  const [showActions, setShowActions] = useState(false)

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const isOverdue = new Date(task.dueDate) < new Date() && !task.completed
  const isScheduled = !!task.scheduledTime

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("taskId", task.id)
    if (fromDate) {
      e.dataTransfer.setData("fromDay", fromDate.toISOString())
    }
    e.dataTransfer.effectAllowed = "move"
  }

  return (
    <Card
      className={cn(
        "group relative p-3 transition-all duration-200 cursor-grab active:cursor-grabbing",
        "hover:shadow-md hover:border-primary/30",
        isDragging && "opacity-50 shadow-lg rotate-2",
        task.completed && "opacity-60",
        isScheduled && "border-l-4 border-l-accent",
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      draggable
      onDragStart={handleDragStart}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 text-muted-foreground/50 cursor-grab">
          <GripVertical className="h-4 w-4" />
        </div>

        <Checkbox
          checked={task.completed}
          onCheckedChange={(checked) => updateTask(task.id, { completed: checked as boolean })}
          className="mt-0.5"
        />

        <div className="flex-1 min-w-0">
          <h4
            className={cn(
              "font-medium text-sm leading-tight truncate",
              task.completed && "line-through text-muted-foreground",
            )}
          >
            {task.title}
          </h4>

          {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}

          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(task.timeRequired)}
            </span>
            <span className={cn("flex items-center gap-1", isOverdue && "text-destructive")}>
              <Calendar className="h-3 w-3" />
              {format(new Date(task.dueDate + "T00:00:00"), "MMM d")}
            </span>
          </div>
        </div>

        <div className={cn("flex items-center gap-1 transition-opacity", showActions ? "opacity-100" : "opacity-0")}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(task)}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => deleteTask(task.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
