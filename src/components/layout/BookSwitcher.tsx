"use client";

import React, { useState } from "react";
import { ChevronDown, Plus, BookOpen } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import { createBook } from "@/lib/firestore/books";
import { setUserSettings } from "@/lib/firestore/settings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BOOK_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

export function BookSwitcher() {
  const { user } = useAuth();
  const { books, activeBookId, setActiveBookId, setBooks } = useAppStore();
  const { t } = useLocale();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(BOOK_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const activeBook = books.find((b) => b.id === activeBookId) ?? books[0];

  const handleSelect = async (bookId: string) => {
    setActiveBookId(bookId);
    if (user) {
      await setUserSettings(user.uid, { defaultBookId: bookId });
    }
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    try {
      const bookId = await createBook(user.uid, newName.trim(), newColor);
      const { getBooks } = await import("@/lib/firestore/books");
      const updated = await getBooks(user.uid);
      setBooks(updated);
      setActiveBookId(bookId);
      setShowNew(false);
      setNewName("");
    } finally {
      setCreating(false);
    }
  };

  if (!activeBook) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 h-9 px-3">
            <span
              className="inline-block w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: activeBook.color }}
            />
            <span className="font-medium max-w-[120px] truncate">{activeBook.name}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {books.map((book) => (
            <DropdownMenuItem
              key={book.id}
              onClick={() => handleSelect(book.id)}
              className="gap-2"
            >
              <span
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: book.color }}
              />
              <span className="truncate">{book.name}</span>
              {book.id === activeBookId && (
                <span className="ms-auto text-primary text-xs font-semibold">{t.book_active}</span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t.book_new}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> {t.book_new}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.book_name}</Label>
              <Input
                placeholder={t.book_name_placeholder}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.book_color}</Label>
              <div className="flex gap-2 flex-wrap">
                {BOOK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: newColor === c ? "#000" : "transparent",
                    }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>{t.book_cancel}</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? t.book_creating : t.book_create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
