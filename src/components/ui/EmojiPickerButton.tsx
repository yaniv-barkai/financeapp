"use client";

import React, { useState, useCallback } from "react";
import data from "@emoji-mart/data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface EmojiPickerButtonProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPickerButton({ value, onChange }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);

  // Callback ref fires the moment the div mounts in the DOM (inside the popover portal),
  // guaranteeing the element exists before we hand it to emoji-mart.
  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      import("emoji-mart").then(({ Picker }) => {
        new Picker({
          data,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref: { current: node } as any,
          onEmojiSelect: (emoji: { native: string }) => {
            onChange(emoji.native);
            setOpen(false);
          },
          previewPosition: "none",
          skinTonePosition: "none",
        });
      });
    },
    // Intentionally omit `onChange` — recreating the picker on every keystroke would be disruptive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-14 h-14 text-3xl flex items-center justify-center rounded-lg border border-input bg-background hover:bg-accent transition-colors"
          aria-label="Pick emoji"
        >
          {value}
        </button>
      </PopoverTrigger>
      {open && (
        <PopoverContent
          className="w-auto p-0 border-0 shadow-xl overflow-visible"
          align="start"
          // Let the picker's own scroll work; don't trap pointer events.
          onWheel={(e) => e.stopPropagation()}
        >
          <div ref={containerRef} />
        </PopoverContent>
      )}
    </Popover>
  );
}
