export interface ScheduledTime {
  id: string
  taskId: string
  startTime: string // ISO datetime string
  duration: number // Duration in minutes
}

export interface Task {
  id: string
  title: string
  description: string
  startDate: string // ISO date string
  dueDate: string // ISO date string
  timeRequired: number // in minutes
  scheduledTime?: string // ISO datetime string for calendar placement (deprecated, use scheduledTimes)
  scheduledTimes?: ScheduledTime[] // Array of scheduled time slots
  completed: boolean
}

export interface CalendarEvent {
  taskId: string
  startTime: string
  endTime: string
}
