"use client";

import { useState } from "react";
import { Calendar, Moon, Sun, User, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./theme-provider";
import { ProfileDialog } from "./profile-dialog";
import { ArchiveDialog } from "./archive-dialog";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  return (
    <>
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/tbicon.png" alt="Timeboxer" className="h-6 w-6" />
            <h1 className="font-semibold text-lg">timeboxer</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 bg-transparent"
            onClick={() => setIsArchiveOpen(true)}
            title="Archive"
          >
            <Archive className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 bg-transparent"
            onClick={toggleTheme}
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 bg-transparent"
            onClick={() => setIsProfileOpen(true)}
          >
            <User className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <ProfileDialog open={isProfileOpen} onOpenChange={setIsProfileOpen} />
      <ArchiveDialog open={isArchiveOpen} onOpenChange={setIsArchiveOpen} />
    </>
  );
}
