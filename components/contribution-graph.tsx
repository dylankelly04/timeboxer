"use client";

import { useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ContributionGraphProps {
  tasks: Array<{
    date: string;
    completed: boolean;
  }>;
  days?: number; // Number of days to show (default: 365)
}

export function ContributionGraph({
  tasks,
  days = 365,
}: ContributionGraphProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // Count completed tasks per day
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    dateRange.forEach((date) => {
      counts[date] = 0;
    });
    tasks.forEach((task) => {
      if (task.completed && counts[task.date] !== undefined) {
        counts[task.date]++;
      }
    });
    return counts;
  }, [tasks, dateRange]);

  // Get max count for normalization
  const maxCount = useMemo(() => {
    return Math.max(...Object.values(taskCounts), 1);
  }, [taskCounts]);

  // Get intensity level (0-4) for color
  const getIntensity = (count: number): number => {
    if (count === 0) return 0;
    const ratio = count / maxCount;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
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
            {[0, 1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={cn(
                  "w-2.5 h-2.5 rounded-[2px] border border-border/50",
                  level === 0 && "bg-muted/50",
                  level === 1 && "bg-green-300 dark:bg-green-950",
                  level === 2 && "bg-green-500 dark:bg-green-800",
                  level === 3 && "bg-green-600 dark:bg-green-600",
                  level === 4 && "bg-green-700 dark:bg-green-500"
                )}
              />
            ))}
          </div>
          <span className="text-xs">More</span>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex gap-1 overflow-x-auto pb-3 max-w-full scroll-smooth"
        style={{ scrollbarWidth: "thin" }}
      >
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((date, dayIndex) => {
              const count = taskCounts[date] || 0;
              const intensity = getIntensity(count);
              const dateObj = new Date(date);
              const isToday =
                dateObj.toDateString() === new Date().toDateString();

              return (
                <div
                  key={`${weekIndex}-${dayIndex}-${date}`}
                  className={cn(
                    "w-2.5 h-2.5 rounded-[2px] transition-all duration-200 cursor-pointer border border-transparent",
                    "hover:scale-125 hover:z-10 hover:shadow-md",
                    intensity === 0 && "bg-muted/30 border-border/30",
                    intensity === 1 &&
                      "bg-green-300 dark:bg-green-950 border-green-400/30 dark:border-green-800/30",
                    intensity === 2 &&
                      "bg-green-500 dark:bg-green-800 border-green-600/30 dark:border-green-700/30",
                    intensity === 3 &&
                      "bg-green-600 dark:bg-green-600 border-green-700/30 dark:border-green-500/30",
                    intensity === 4 &&
                      "bg-green-700 dark:bg-green-500 border-green-800/30 dark:border-green-400/30",
                    isToday && "ring-1 ring-primary ring-offset-0 shadow-sm"
                  )}
                  title={`${format(dateObj, "MMM dd, yyyy")}: ${count} task${
                    count !== 1 ? "s" : ""
                  } completed`}
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
    </div>
  );
}
