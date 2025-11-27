"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { format, setHours, setMinutes, isToday, addDays, startOfDay } from "date-fns"
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTasks } from "@/lib/task-context"
import { useSession } from "next-auth/react"
import type { Task } from "@/lib/types"

const HOUR_HEIGHT = 60
const START_HOUR = 6
const END_HOUR = 22

type CalendarMode = "1-day" | "3-day"

interface OutlookEvent {
  id: string
  subject: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  body?: { content: string }
}

export function CalendarView() {
  const { tasks, scheduleTask, unscheduleTask } = useTasks()
  const { data: session } = useSession()
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("1-day")
  const [dayOffset, setDayOffset] = useState(0)
  const [dragOverSlot, setDragOverSlot] = useState<{ date: Date; hour: number } | null>(null)
  const [outlookEvents, setOutlookEvents] = useState<OutlookEvent[]>([])
  const [isLoadingOutlookEvents, setIsLoadingOutlookEvents] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Get user's timezone
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const today = startOfDay(new Date())
  const startDay = addDays(today, dayOffset)
  const visibleDays = calendarMode === "1-day" ? [startDay] : [startDay, addDays(startDay, 1), addDays(startDay, 2)]

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  // Fetch Outlook events function
  const fetchOutlookEvents = async () => {
    if (!session?.user) {
      setOutlookEvents([])
      return
    }

    setIsLoadingOutlookEvents(true)
    try {
      // Convert dates to user's timezone for the query
      const startDate = startOfDay(visibleDays[0])
      const endDate = addDays(startOfDay(visibleDays[visibleDays.length - 1]), 1) // End of last visible day

      // Format dates in user's timezone for Outlook API
      const startDateTime = formatInTimeZone(startDate, userTimeZone, "yyyy-MM-dd'T'00:00:00")
      const endDateTime = formatInTimeZone(endDate, userTimeZone, "yyyy-MM-dd'T'00:00:00")

      const response = await fetch(
        `/api/outlook/events?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}&timeZone=${encodeURIComponent(userTimeZone)}`
      )

      if (response.ok) {
        const data = await response.json()
        setOutlookEvents(data.events || [])
      } else if (response.status === 400) {
        // Outlook not connected - that's fine
        setOutlookEvents([])
      }
    } catch (error) {
      console.error("Error fetching Outlook events:", error)
      setOutlookEvents([])
    } finally {
      setIsLoadingOutlookEvents(false)
    }
  }

  // Get scheduled tasks hash to detect when calendar changes
  const scheduledTasksHash = tasks
    .filter((t) => t.scheduledTime)
    .map((t) => `${t.id}:${t.scheduledTime}`)
    .sort()
    .join(",")

  // Fetch Outlook events when visible days change (initial load or navigation)
  useEffect(() => {
    fetchOutlookEvents()
    // Use dayOffset and calendarMode instead of visibleDays to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayOffset, calendarMode, session?.user?.id])

  // Refresh Outlook events when scheduled tasks change (when something is added/updated/deleted on calendar)
  // This only triggers when scheduled tasks actually change, not on every task update
  useEffect(() => {
    if (session?.user && scheduledTasksHash) {
      // Only refresh if we have scheduled tasks (to avoid unnecessary fetches on initial load)
      fetchOutlookEvents()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledTasksHash, session?.user?.id])

  const goToPreviousDays = () => setDayOffset((prev) => prev - (calendarMode === "1-day" ? 1 : 3))
  const goToNextDays = () => setDayOffset((prev) => prev + (calendarMode === "1-day" ? 1 : 3))
  const goToToday = () => setDayOffset(0)

  const getScheduledTasksForDate = (date: Date) => {
    return tasks.filter((task) => {
      if (!task.scheduledTime) return false
      const taskDate = new Date(task.scheduledTime)
      return format(taskDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    })
  }

  const getOutlookEventsForDate = (date: Date) => {
    return outlookEvents.filter((event) => {
      // Convert event time from its timezone to user's timezone for comparison
      const eventTimeZone = event.start.timeZone || userTimeZone
      const eventDate = toZonedTime(new Date(event.start.dateTime), eventTimeZone)
      return format(eventDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    })
  }

  const getOutlookEventPosition = (event: OutlookEvent) => {
    // Convert event time from its timezone to user's timezone
    const eventTimeZone = event.start.timeZone || userTimeZone
    const startDate = toZonedTime(new Date(event.start.dateTime), eventTimeZone)
    const endDate = toZonedTime(new Date(event.end.dateTime), eventTimeZone)
    const hour = startDate.getHours()
    const minutes = startDate.getMinutes()
    const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60) // duration in minutes
    const top = (hour - START_HOUR + minutes / 60) * HOUR_HEIGHT
    const height = (duration / 60) * HOUR_HEIGHT
    return { top, height }
  }

  const handleDragOver = (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverSlot({ date, hour })
  }

  const handleDrop = (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData("taskId")
    if (taskId) {
      const scheduledTime = setMinutes(setHours(date, hour), 0).toISOString()
      scheduleTask(taskId, scheduledTime)
    }
    setDragOverSlot(null)
  }

  const handleDragLeave = () => {
    setDragOverSlot(null)
  }

  const getTaskPosition = (task: Task) => {
    if (!task.scheduledTime) return null
    const taskDate = new Date(task.scheduledTime)
    const hour = taskDate.getHours()
    const minutes = taskDate.getMinutes()
    const top = (hour - START_HOUR + minutes / 60) * HOUR_HEIGHT
    const height = (task.timeRequired / 60) * HOUR_HEIGHT
    return { top, height }
  }

  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData("taskId", task.id)
    e.dataTransfer.setData("fromCalendar", "true")
    e.dataTransfer.effectAllowed = "move"
  }

  const now = new Date()

  return (
    <div className="w-1/2 flex flex-col bg-card">
      {/* Header with toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-semibold">Calendar</h2>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 px-3 text-xs", calendarMode === "1-day" && "bg-background shadow-sm")}
            onClick={() => setCalendarMode("1-day")}
          >
            1 Day
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 px-3 text-xs", calendarMode === "3-day" && "bg-background shadow-sm")}
            onClick={() => setCalendarMode("3-day")}
          >
            3 Days
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={goToPreviousDays}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {calendarMode === "1-day"
              ? format(visibleDays[0], "EEEE, MMM d")
              : `${format(visibleDays[0], "MMM d")} - ${format(visibleDays[2], "MMM d")}`}
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

      {/* Day headers for multi-day view */}
      {calendarMode === "3-day" && (
        <div className="flex border-b border-border">
          <div className="w-14 flex-shrink-0" />
          {visibleDays.map((date) => (
            <div
              key={date.toISOString()}
              className="flex-1 px-2 py-2 text-center border-l border-border first:border-l-0"
            >
              <p className={cn("text-xs font-medium", isToday(date) && "text-primary")}>
                {isToday(date) ? "Today" : format(date, "EEE")}
              </p>
              <p className="text-xs text-muted-foreground">{format(date, "MMM d")}</p>
            </div>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto" ref={containerRef}>
        <div className="flex" style={{ height: hours.length * HOUR_HEIGHT }}>
          {/* Time column */}
          <div className="w-14 flex-shrink-0 relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-border"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
              >
                <span className="text-xs text-muted-foreground pr-2 -mt-2 block text-right">
                  {format(setHours(new Date(), hour), "h a")}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {visibleDays.map((date, dayIndex) => {
            const scheduledTasks = getScheduledTasksForDate(date)
            const currentTimeTop =
              isToday(date) && now.getHours() >= START_HOUR && now.getHours() < END_HOUR
                ? (now.getHours() - START_HOUR + now.getMinutes() / 60) * HOUR_HEIGHT
                : null

            return (
              <div key={date.toISOString()} className={cn("flex-1 relative", dayIndex > 0 && "border-l border-border")}>
                {/* Hour grid lines */}
                {hours.map((hour) => {
                  const isOver = dragOverSlot?.date.getTime() === date.getTime() && dragOverSlot?.hour === hour
                  return (
                    <div
                      key={hour}
                      className={cn("absolute left-0 right-0 border-t border-border", isOver && "bg-primary/10")}
                      style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                      onDragOver={(e) => handleDragOver(e, date, hour)}
                      onDrop={(e) => handleDrop(e, date, hour)}
                      onDragLeave={handleDragLeave}
                    />
                  )
                })}

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
                  const pos = getOutlookEventPosition(event)
                  if (!pos) return null

                  // Convert event times to user's timezone for display
                  const eventTimeZone = event.start.timeZone || userTimeZone
                  const startDate = toZonedTime(new Date(event.start.dateTime), eventTimeZone)
                  const endDate = toZonedTime(new Date(event.end.dateTime), eventTimeZone)

                  return (
                    <div
                      key={event.id}
                      className="absolute left-1 right-1 rounded px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 overflow-hidden"
                      style={{
                        top: pos.top,
                        height: Math.max(pos.height, 20),
                        zIndex: 5,
                      }}
                      title={`${event.subject}\n${format(startDate, "h:mm a")} - ${format(endDate, "h:mm a")}`}
                    >
                      <div className="font-medium truncate">{event.subject}</div>
                      <div className="text-[10px] opacity-75">
                        {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
                      </div>
                    </div>
                  )
                })}

                {/* Scheduled tasks */}
                {scheduledTasks.map((task) => {
                  const pos = getTaskPosition(task)
                  if (!pos) return null
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleTaskDragStart(e, task)}
                      className="absolute left-1 right-1 bg-primary text-primary-foreground rounded-md p-2 cursor-grab active:cursor-grabbing hover:bg-primary/90 transition-colors shadow-sm group z-10"
                      style={{ top: pos.top + 2, height: Math.max(pos.height - 4, 24) }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{task.title}</p>
                          {pos.height > 40 && (
                            <p className="text-xs opacity-80 truncate">
                              {task.timeRequired >= 60
                                ? `${Math.floor(task.timeRequired / 60)}h${task.timeRequired % 60 > 0 ? ` ${task.timeRequired % 60}m` : ""}`
                                : `${task.timeRequired}m`}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 -mr-1 -mt-1 hover:bg-primary-foreground/20 text-primary-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                            unscheduleTask(task.id)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <div className="p-3 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">Drag tasks to schedule / Drag back to unschedule</p>
      </div>
    </div>
  )
}
