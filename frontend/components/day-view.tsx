"use client"

import { useRef, useState } from "react"
import { addDays, subDays, format, startOfDay } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DayColumn } from "./day-column"
import { useTasks } from "@/lib/task-context"
import type { Task } from "@/lib/types"

interface DayViewProps {
  onAddTask: (date: Date) => void
  onEditTask: (task: Task) => void
}

export function DayView({ onAddTask, onEditTask }: DayViewProps) {
  const { tasks } = useTasks()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [centerDate, setCenterDate] = useState(new Date())

  // Generate 7 days centered around centerDate
  const days = Array.from({ length: 7 }, (_, i) => addDays(subDays(centerDate, 3), i))

  const getTasksForDate = (date: Date) => {
    const dateStr = format(startOfDay(date), "yyyy-MM-dd")
    return tasks.filter((task) => task.startDate === dateStr)
  }

  const scrollLeft = () => {
    setCenterDate((prev) => subDays(prev, 3))
  }

  const scrollRight = () => {
    setCenterDate((prev) => addDays(prev, 3))
  }

  const goToToday = () => {
    setCenterDate(new Date())
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-muted/30">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={scrollLeft}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={scrollRight}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          {format(days[0], "MMM d")} - {format(days[days.length - 1], "MMM d, yyyy")}
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 flex overflow-x-auto hide-scrollbar">
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
    </div>
  )
}
