export interface Task {
  id: string
  title: string
  description: string
  startDate: string // ISO date string
  dueDate: string // ISO date string
  timeRequired: number // in minutes
  scheduledTime?: string // ISO datetime string for calendar placement
  completed: boolean
}

export interface CalendarEvent {
  taskId: string
  startTime: string
  endTime: string
}
