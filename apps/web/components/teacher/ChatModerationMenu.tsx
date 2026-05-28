"use client";

// Phase 4 Track 4B — moderation kebab on each chat message in /live-control.
// Uses Radix DropdownMenu so it's keyboard-accessible + focus-trapped.

import { Ban, MoreHorizontal, Trash2, Volume2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ChatModerationMenuProps {
  authorName: string;
  isBanned: boolean;
  onDelete: () => void;
  onBan: () => void;
  onUnban: () => void;
}

export function ChatModerationMenu({
  authorName,
  isBanned,
  onDelete,
  onBan,
  onUnban,
}: ChatModerationMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Moderate message from ${authorName}`}
          className="opacity-0 transition-opacity group-hover/msg:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Delete message
        </DropdownMenuItem>
        {isBanned ? (
          <DropdownMenuItem onSelect={onUnban}>
            <Volume2 />
            Unmute {authorName}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onBan}>
            <Ban />
            Mute {authorName} for this class
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
