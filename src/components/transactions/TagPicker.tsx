"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import { addTag, getTags } from "@/lib/firestore/tags";
import { Tag } from "@/lib/types";

interface Props {
  /** Selected tag IDs */
  value: string[];
  onChange: (ids: string[]) => void;
}

const TAG_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#6b7280",
];

export function TagPicker({ value, onChange }: Props) {
  const { user } = useAuth();
  const { activeBookId, tags, setTags } = useAppStore();
  const { t } = useLocale();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedTags = tags.filter((t) => value.includes(t.id));

  const filtered = tags.filter(
    (tag) =>
      !value.includes(tag.id) &&
      tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const canCreate =
    search.trim().length > 0 &&
    !tags.some((t) => t.name.toLowerCase() === search.trim().toLowerCase());

  const toggle = (tagId: string) => {
    if (value.includes(tagId)) {
      onChange(value.filter((id) => id !== tagId));
    } else {
      onChange([...value, tagId]);
    }
  };

  const handleCreate = async () => {
    if (!user || !activeBookId || !search.trim()) return;
    setCreating(true);
    try {
      const id = await addTag(user.uid, activeBookId, search.trim(), newColor);
      const updated = await getTags(user.uid, activeBookId);
      setTags(updated);
      onChange([...value, id]);
      setSearch("");
      setNewColor(TAG_COLORS[0]);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length === 1 && !canCreate) {
        toggle(filtered[0].id);
        setSearch("");
      } else if (canCreate) {
        handleCreate();
      }
    }
    if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: tag.color + "22", color: tag.color, border: `1px solid ${tag.color}55` }}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => onChange(value.filter((id) => id !== tag.id))}
                className="hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown trigger */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t.tags_picker_search}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />

        {open && (
          <div className="absolute top-full mt-1 z-50 w-full rounded-md border bg-popover shadow-md max-h-52 overflow-y-auto">
            {filtered.length === 0 && !canCreate && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t.tags_picker_no_results}
              </p>
            )}

            {filtered.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                onClick={() => { toggle(tag.id); setSearch(""); }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            ))}

            {canCreate && (
              <div className="border-t px-3 py-2 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t.tags_picker_create} &ldquo;{search.trim()}&rdquo;
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="w-5 h-5 rounded-full border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: newColor === c ? "#000" : "transparent" }}
                      onClick={() => setNewColor(c)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreate}
                  className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md border border-input hover:bg-accent disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  {creating ? t.tags_saving : t.tags_picker_create}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
