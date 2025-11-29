"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ContributionGraphProps {
  tasks: Array<{
    date: string;
    minutesWorked?: number;
    completed?: boolean; // For backward compatibility
  }>;
  days?: number; // Number of days to show (default: 365)
}

export function ContributionGraph({
  tasks,
  days = 365,
}: ContributionGraphProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Generate date range (last N days)
  const dateRange = useMemo(() => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split("T")[0]);
    }
    return dates;
  }, [days]);

  // Sum minutes worked per day
  const minutesPerDay = useMemo(() => {
    const minutes: Record<string, number> = {};
    dateRange.forEach((date) => {
      minutes[date] = 0;
    });
    tasks.forEach((task) => {
      if (minutes[task.date] !== undefined) {
        // Use minutesWorked if available, otherwise fall back to completed flag
        if (task.minutesWorked !== undefined) {
          minutes[task.date] += task.minutesWorked;
        } else if (task.completed) {
          // For backward compatibility, assume 30 minutes if only completed flag is present
          minutes[task.date] += 30;
        }
      }
    });
    return minutes;
  }, [tasks, dateRange]);

  // Format hours worked for display
  const formatHoursWorked = (totalMinutes: number): string => {
    if (totalMinutes === 0) {
      return "No work";
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours === 0) {
      return `${mins} minute${mins !== 1 ? "s" : ""}`;
    } else if (mins === 0) {
      return `${hours} hour${hours !== 1 ? "s" : ""}`;
    } else {
      return `${hours} hour${hours !== 1 ? "s" : ""} ${mins} minute${
        mins !== 1 ? "s" : ""
      }`;
    }
  };

  // Get intensity level (0-6) based on hours worked
  // <2 hours (120 min): level 1 (dark green)
  // 2-4 hours (120-240 min): level 2
  // 4-6 hours (240-360 min): level 3
  // 6-8 hours (360-480 min): level 4
  // 8-10 hours (480-600 min): level 5
  // 10-12 hours (600-720 min): level 6
  // 12+ hours (720+ min): level 6 (brightest)
  const getIntensity = (minutes: number): number => {
    if (minutes === 0) return 0;
    const hours = minutes / 60;
    if (hours < 2) return 1; // <2 hours: dark green
    if (hours < 4) return 2; // 2-4 hours
    if (hours < 6) return 3; // 4-6 hours
    if (hours < 8) return 4; // 6-8 hours
    if (hours < 10) return 5; // 8-10 hours
    if (hours < 12) return 6; // 10-12 hours
    return 6; // 12+ hours: brightest
  };

  // Group dates by weeks (for display)
  const weeks = useMemo(() => {
    const weeksArray: string[][] = [];
    let currentWeek: string[] = [];

    dateRange.forEach((date, index) => {
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();

      if (dayOfWeek === 0 && currentWeek.length > 0) {
        // Start of new week (Sunday)
        weeksArray.push(currentWeek);
        currentWeek = [date];
      } else {
        currentWeek.push(date);
      }

      // Push last week
      if (index === dateRange.length - 1) {
        weeksArray.push(currentWeek);
      }
    });

    return weeksArray;
  }, [dateRange]);

  // Scroll to the right (latest days) on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft =
        scrollContainerRef.current.scrollWidth;
    }
  }, [weeks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Activity</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="text-xs">Less</span>
          <div className="flex gap-0.5">
            {[0, 1, 2, 3, 4, 5, 6].map((level) => (
              <div
                key={level}
                className={cn(
                  "w-2.5 h-2.5 rounded-[2px] border border-border/50",
                  level === 0 && "bg-muted/50",
                  level === 1 && "bg-green-700 dark:bg-green-950", // <2 hours: dark green
                  level === 2 && "bg-green-600 dark:bg-green-900", // 2-4 hours
                  level === 3 && "bg-green-500 dark:bg-green-800", // 4-6 hours
                  level === 4 && "bg-green-400 dark:bg-green-700", // 6-8 hours
                  level === 5 && "bg-green-300 dark:bg-green-600", // 8-10 hours
                  level === 6 && "bg-green-200 dark:bg-green-500" // 10-12+ hours: brightest
                )}
              />
            ))}
          </div>
          <span className="text-xs">More</span>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex gap-1 overflow-x-auto max-w-full scroll-smooth"
        style={{ scrollbarWidth: "thin" }}
      >
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((date, dayIndex) => {
              const minutes = minutesPerDay[date] || 0;
              const intensity = getIntensity(minutes);
              const dateObj = new Date(date);
              const isToday =
                dateObj.toDateString() === new Date().toDateString();

              return (
                <div
                  key={`${weekIndex}-${dayIndex}-${date}`}
                  className={cn(
                    "w-2.5 h-2.5 rounded-[2px] transition-all duration-200 cursor-pointer border border-transparent relative",
                    "hover:scale-125 hover:z-10 hover:shadow-md",
                    intensity === 0 && "bg-muted/30 border-border/30",
                    intensity === 1 &&
                      "bg-green-700 dark:bg-green-950 border-green-600/30 dark:border-green-800/30", // <2 hours
                    intensity === 2 &&
                      "bg-green-600 dark:bg-green-900 border-green-500/30 dark:border-green-700/30", // 2-4 hours
                    intensity === 3 &&
                      "bg-green-500 dark:bg-green-800 border-green-400/30 dark:border-green-600/30", // 4-6 hours
                    intensity === 4 &&
                      "bg-green-400 dark:bg-green-700 border-green-300/30 dark:border-green-500/30", // 6-8 hours
                    intensity === 5 &&
                      "bg-green-300 dark:bg-green-600 border-green-200/30 dark:border-green-400/30", // 8-10 hours
                    intensity === 6 &&
                      "bg-green-200 dark:bg-green-500 border-green-100/30 dark:border-green-300/30", // 10-12+ hours
                    // Today keeps its intensity color, but gets a neutral inner border
                    isToday &&
                      "border border-zinc-200/90 dark:border-zinc-100/80"
                  )}
                  onMouseEnter={() => setHoveredDate(date)}
                  onMouseLeave={() => setHoveredDate(null)}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
        <span className="font-medium">
          {new Date(dateRange[0]).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span className="font-medium">
          {new Date(dateRange[dateRange.length - 1]).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", year: "numeric" }
          )}
        </span>
      </div>

      {/* Hover information */}
      <div className="text-center text-sm text-muted-foreground pt-2 border-t min-h-[24px]">
        {hoveredDate ? (
          <>
            Hours worked on{" "}
            {format(new Date(hoveredDate + "T00:00:00"), "MMM dd, yyyy")}:{" "}
            {formatHoursWorked(minutesPerDay[hoveredDate] || 0)}
          </>
        ) : (
          <span className="opacity-50">
            Hover to see how much you worked on each day
          </span>
        )}
      </div>
    </div>
  );
}
