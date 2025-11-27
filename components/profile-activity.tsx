"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { ContributionGraph } from "./contribution-graph";

export function ProfileActivity() {
  const { data: session } = useSession();
  const [taskHistory, setTaskHistory] = useState<
    Array<{ date: string; minutesWorked: number }>
  >([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setIsLoadingHistory(true);
      fetch("/api/tasks/history")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTaskHistory(data);
          } else {
            console.error("API returned non-array for task history:", data);
            setTaskHistory([]);
          }
        })
        .catch((error) => {
          console.error("Error fetching task history:", error);
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    } else {
      setTaskHistory([]);
    }
  }, [session]);

  if (!session?.user) {
    return null;
  }

  return (
    <div className="flex-1">
      {isLoadingHistory ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ContributionGraph tasks={taskHistory} days={365} />
      )}
    </div>
  );
}

