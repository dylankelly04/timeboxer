"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileIntegrationsProps {
  onSignOut?: () => void;
}

export function ProfileIntegrations({ onSignOut }: ProfileIntegrationsProps) {
  const { data: session } = useSession();
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [isLoadingOutlook, setIsLoadingOutlook] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  useEffect(() => {
    if (session?.user) {
      setIsCheckingStatus(true);
      // Check Outlook connection status
      fetch("/api/outlook/status")
        .then((res) => res.json())
        .then((data) => {
          setOutlookConnected(data.connected || false);
        })
        .catch((error) => {
          console.error("Error fetching Outlook status:", error);
        })
        .finally(() => {
          setIsCheckingStatus(false);
        });
    } else {
      setOutlookConnected(false);
      setIsCheckingStatus(false);
    }
  }, [session]);

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
    } else {
      await signOut({ redirect: false });
    }
  };

  if (!session?.user) {
    return null;
  }

  // Don't render buttons until status is checked to avoid flash
  if (isCheckingStatus) {
    return (
      <div className="flex flex-row gap-2 max-w-xs">
        <div className="flex-1 h-8 bg-muted/50 rounded-md animate-pulse" />
        <div className="flex-1 h-8 bg-muted/50 rounded-md animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-row gap-2 max-w-xs">
      <Button
        variant="outline"
        size="sm"
        className="flex-1 gap-2 justify-start"
        onClick={async () => {
          if (outlookConnected) {
            // Disconnect
            setIsLoadingOutlook(true);
            try {
              const response = await fetch("/api/outlook/disconnect", {
                method: "POST",
              });
              if (response.ok) {
                setOutlookConnected(false);
              }
            } catch (error) {
              console.error("Error disconnecting Outlook:", error);
            } finally {
              setIsLoadingOutlook(false);
            }
          } else {
            // Connect
            setIsLoadingOutlook(true);
            try {
              const response = await fetch("/api/auth/outlook");
              const data = await response.json();
              if (data.authUrl) {
                window.location.href = data.authUrl;
              } else {
                setIsLoadingOutlook(false);
              }
            } catch (error) {
              console.error("Error connecting Outlook:", error);
              setIsLoadingOutlook(false);
            }
          }
        }}
        disabled={isLoadingOutlook}
      >
        {isLoadingOutlook ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CalendarIcon className="h-3.5 w-3.5" />
        )}
        {outlookConnected ? "Disconnect Outlook" : "Connect Outlook Calendar"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSignOut}
        className="flex-1 gap-2 justify-start"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign Out
      </Button>
    </div>
  );
}
