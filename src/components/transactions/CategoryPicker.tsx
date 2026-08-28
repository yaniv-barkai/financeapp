"use client";

import React, { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { addCategory } from "@/lib/firestore/categories";
import { Category, TransactionType } from "@/lib/types";
import { cn, getCategoryDisplayName, translateHeToEn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmojiPickerButton } from "@/components/ui/EmojiPickerButton";

interface Props {
  value: string;
  onChange: (categoryId: string) => void;
  typeFilter?: TransactionType;
  placeholder?: string;
  /** Custom trigger content. Replaces the default outline combobox button. */
  trigger?: React.ReactNode;
  /** When true, no trigger is rendered — use controlled `open` / `onOpenChange`. */
  hideTrigger?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CAT_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#6b7280"];

export function CategoryPicker({
  value,
  onChange,
  typeFilter,
  placeholder,
  trigger,
  hideTrigger,
  className,
  open: openControlled,
  onOpenChange,
}: Props) {
  const { user } = useAuth();
  const { categories, activeBookId, setCategories } = useAppStore();
  const { t, locale } = useLocale();
  const [openUncontrolled, setOpenUncontrolled] = useState(false);
  const open = openControlled ?? openUncontrolled;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openControlled === undefined) setOpenUncontrolled(next);
  };
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNameEn, setNewNameEn] = useState("");
  const [newIcon, setNewIcon] = useState("📦");
  const [newColor, setNewColor] = useState(CAT_COLORS[0]);
  const [translating, setTranslating] = useState(false);

  const effectivePlaceholder = placeholder ?? t.picker_placeholder;

  const filtered = typeFilter
    ? categories.filter((c) => c.type === typeFilter)
    : categories;

  const pinned = filtered.filter((c) => c.pinned);
  const rest = filtered.filter((c) => !c.pinned);
  const selected = categories.find((c) => c.id === value);

  const handleSelect = (catId: string) => {
    onChange(catId);
    setOpen(false);
  };

  const handleAutoTranslate = async () => {
    if (!newName.trim()) return;
    setTranslating(true);
    const translated = await translateHeToEn(newName.trim());
    setNewNameEn(translated);
    setTranslating(false);
  };

  const handleCreateCategory = async () => {
    if (!user || !activeBookId || !newName.trim()) return;
    const maxOrder = Math.max(0, ...filtered.map((c) => c.order));
    const newCat: Omit<Category, "id"> = {
      name: newName.trim(),
      ...(newNameEn.trim() ? { nameEn: newNameEn.trim() } : {}),
      type: typeFilter ?? "expense",
      icon: newIcon,
      color: newColor,
      pinned: false,
      order: maxOrder + 1,
    };
    const id = await addCategory(user.uid, activeBookId, newCat);
    const { getCategories } = await import("@/lib/firestore/categories");
    const updated = await getCategories(user.uid, activeBookId);
    setCategories(updated);
    onChange(id);
    setShowNew(false);
    setOpen(false);
    setNewName("");
    setNewNameEn("");
  };

  const CategoryItem = ({ cat }: { cat: Category }) => (
    <CommandItem
      key={cat.id}
      value={`${cat.name}${cat.nameEn ? " " + cat.nameEn : ""}`}
      onSelect={() => handleSelect(cat.id)}
      className="gap-2"
    >
      <span>{cat.icon}</span>
      <span className="flex-1">{getCategoryDisplayName(cat, locale)}</span>
      {value === cat.id && <Check className="h-4 w-4 text-primary" />}
    </CommandItem>
  );

  return (
    <>
      {!hideTrigger && (
        trigger ? (
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label={selected ? getCategoryDisplayName(selected, locale) : effectivePlaceholder}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-left font-normal transition-colors",
              "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className
            )}
            onClick={() => setOpen(true)}
          >
            {trigger}
          </button>
        ) : (
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal", className)}
            onClick={() => setOpen(true)}
          >
            {selected ? (
              <span className="flex items-center gap-2">
                <span>{selected.icon}</span>
                <span>{getCategoryDisplayName(selected, locale)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{effectivePlaceholder}</span>
            )}
            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        )
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm overflow-hidden">
          <DialogTitle className="sr-only">{t.picker_placeholder}</DialogTitle>
          <Command>
            <div className="border-b px-1 pt-1">
              <CommandInput placeholder={t.picker_search} />
            </div>
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>{t.picker_no_category}</CommandEmpty>
              {pinned.length > 0 && (
                <CommandGroup heading={t.picker_pinned}>
                  {pinned.map((cat) => (
                    <CategoryItem key={cat.id} cat={cat} />
                  ))}
                </CommandGroup>
              )}
              {rest.length > 0 && (
                <CommandGroup heading={pinned.length > 0 ? t.picker_all : undefined}>
                  {rest.map((cat) => (
                    <CategoryItem key={cat.id} cat={cat} />
                  ))}
                </CommandGroup>
              )}
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => { setShowNew(true); setOpen(false); }}
                  className="gap-2 text-primary"
                >
                  <Plus className="h-4 w-4" />
                  {t.picker_create_new}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.picker_new_category_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.picker_name}</Label>
              <Input
                placeholder={t.picker_name_placeholder}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.categories_name_en}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t.categories_name_en_placeholder}
                  value={newNameEn}
                  onChange={(e) => setNewNameEn(e.target.value)}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={handleAutoTranslate}
                  disabled={translating || !newName.trim()}
                  className="text-xs px-2 py-1 rounded border border-input bg-muted hover:bg-accent disabled:opacity-40 whitespace-nowrap"
                >
                  {translating ? t.categories_translating : t.categories_translate}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.picker_icon}</Label>
              <EmojiPickerButton
                value={newIcon}
                onChange={(emoji) => setNewIcon(emoji)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.picker_color}</Label>
              <div className="flex gap-2 flex-wrap">
                {CAT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: newColor === c ? "#000" : "transparent" }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>{t.picker_cancel}</Button>
            <Button onClick={handleCreateCategory} disabled={!newName.trim()}>{t.picker_create}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
