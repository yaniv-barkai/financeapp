"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Plus, Pencil, Trash2, Pin, PinOff, TrendingUp, TrendingDown, Wallet, GripVertical, Tag } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  addCategory,
  updateCategory,
  deleteCategory,
  setCategoryLimit,
  removeCategoryLimit,
  getAllLimitDetails,
  getCategories,
  updateCategoryOrders,
} from "@/lib/firestore/categories";
import { getRecurring, toMonthlyRecurringAmount } from "@/lib/firestore/recurring";
import { addTag, updateTag, deleteTag, getTags } from "@/lib/firestore/tags";
import { getTransactionsByMonth } from "@/lib/firestore/transactions";
import { BudgetPeriod, Category, CategoryLimit, Recurring } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn, formatCurrency, getCategoryDisplayName, translateHeToEn, getMonthRange } from "@/lib/utils";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { EmojiPickerButton } from "@/components/ui/EmojiPickerButton";


const CAT_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#6b7280",
];

interface CategoryFormData {
  name: string;
  nameEn: string;
  icon: string;
  color: string;
}

// ─── Sortable category row ────────────────────────────────────────────────────

function SortableCatRow({ id, isRtl, children }: { id: string; isRtl: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={cn("flex items-center gap-2", isRtl && "flex-row-reverse")}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 px-1 py-3 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const { loading } = useRequireAuth();
  const { user } = useAuth();
  const { activeBookId, categories, setCategories, tags, setTags, currency, activeMonth } = useAppStore();
  const { t, locale } = useLocale();
  const isRtl = locale === "he";

  const confirm = useConfirm();
  const [limits, setLimits] = useState<Record<string, CategoryLimit>>({});
  const [recurrings, setRecurrings] = useState<Recurring[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormData>({ name: "", nameEn: "", icon: "📦", color: CAT_COLORS[0] });
  const [formType, setFormType] = useState<"expense" | "income">("expense");
  const [showLimitDialog, setShowLimitDialog] = useState<Category | null>(null);
  const [limitValue, setLimitValue] = useState("");
  const [limitPeriod, setLimitPeriod] = useState<BudgetPeriod>("monthly");
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  // Tag state
  const [tagStats, setTagStats] = useState<Record<string, { spent: number; count: number }>>({});
  const [tagStatsLoaded, setTagStatsLoaded] = useState(false);
  const [showTagForm, setShowTagForm] = useState(false);
  const [editTagId, setEditTagId] = useState<string | null>(null);
  const [tagForm, setTagForm] = useState({ name: "", color: CAT_COLORS[0] });
  const [savingTag, setSavingTag] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 10 } })
  );

  const handleCatDragEnd = (type: "expense" | "income") => async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !user || !activeBookId) return;
    const typedCats = categories.filter((c) => c.type === type).sort((a, b) => a.order - b.order);
    const ids = typedCats.map((c) => c.id);
    const reordered = arrayMove(ids, ids.indexOf(active.id as string), ids.indexOf(over.id as string));
    const updatedCats = categories.map((c) => {
      const newOrder = reordered.indexOf(c.id);
      return newOrder >= 0 ? { ...c, order: newOrder } : c;
    });
    setCategories(updatedCats);
    await updateCategoryOrders(user.uid, activeBookId, reordered);
  };

  const loadLimits = async () => {
    if (!user || !activeBookId) return;
    const [lims, recs] = await Promise.all([
      getAllLimitDetails(user.uid, activeBookId, categories),
      getRecurring(user.uid, activeBookId),
    ]);
    setLimits(lims);
    setRecurrings(recs.filter((r) => r.active));
  };

  const loadTagStats = async () => {
    if (!user || !activeBookId) return;
    const { start, end } = getMonthRange(activeMonth);
    const txs = await getTransactionsByMonth(user.uid, activeBookId, start, end);
    const stats: Record<string, { spent: number; count: number }> = {};
    for (const tx of txs) {
      if (tx.type !== "expense") continue;
      for (const tagId of (tx.tags ?? [])) {
        if (!stats[tagId]) stats[tagId] = { spent: 0, count: 0 };
        stats[tagId].spent += tx.amount;
        stats[tagId].count += 1;
      }
    }
    setTagStats(stats);
    setTagStatsLoaded(true);
  };

  useEffect(() => {
    loadLimits();
  }, [user, activeBookId, categories.length]);

  const monthlyIncome = useMemo(
    () =>
      recurrings
        .filter((r) => r.type === "income")
        .reduce((s, r) => s + toMonthlyRecurringAmount(r.amount, r.cadence), 0),
    [recurrings]
  );
  const monthlyExpenses = useMemo(
    () =>
      recurrings
        .filter((r) => r.type === "expense")
        .reduce((s, r) => s + toMonthlyRecurringAmount(r.amount, r.cadence), 0),
    [recurrings]
  );
  const monthlyNet = monthlyIncome - monthlyExpenses;

  const expenseCategories = useMemo(() => categories.filter((c) => c.type === "expense"), [categories]);
  const incomeCategories = useMemo(() => categories.filter((c) => c.type === "income"), [categories]);

  const refreshCats = async () => {
    if (!user || !activeBookId) return;
    const updated = await getCategories(user.uid, activeBookId);
    setCategories(updated);
  };

  const refreshTags = async () => {
    if (!user || !activeBookId) return;
    const updated = await getTags(user.uid, activeBookId);
    setTags(updated);
  };

  const openNew = (type: "expense" | "income") => {
    setEditCat(null);
    setFormType(type);
    setForm({ name: "", nameEn: "", icon: "📦", color: CAT_COLORS[0] });
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    setFormType(cat.type);
    setForm({ name: cat.name, nameEn: cat.nameEn ?? "", icon: cat.icon, color: cat.color });
    setShowForm(true);
  };

  const handleAutoTranslate = async () => {
    if (!form.name.trim()) return;
    setTranslating(true);
    const translated = await translateHeToEn(form.name.trim());
    setForm((f) => ({ ...f, nameEn: translated }));
    setTranslating(false);
  };

  const handleSave = async () => {
    if (!user || !activeBookId || !form.name.trim()) return;
    setSaving(true);
    try {
      const nameEnVal = form.nameEn.trim() || undefined;
      if (editCat) {
        await updateCategory(user.uid, activeBookId, editCat.id, {
          name: form.name.trim(),
          nameEn: nameEnVal,
          icon: form.icon,
          color: form.color,
        });
      } else {
        const maxOrder = Math.max(0, ...categories.filter((c) => c.type === formType).map((c) => c.order));
        await addCategory(user.uid, activeBookId, {
          name: form.name.trim(),
          ...(nameEnVal ? { nameEn: nameEnVal } : {}),
          type: formType,
          icon: form.icon,
          color: form.color,
          pinned: false,
          order: maxOrder + 1,
        });
      }
      await refreshCats();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!user || !activeBookId) return;
    const ok = await confirm({
      title: `${t.categories_edit_title} "${cat.name}"?`,
      message: t.categories_delete_confirm,
      confirmLabel: "Delete",
      cancelLabel: t.categories_cancel,
    });
    if (!ok) return;
    await deleteCategory(user.uid, activeBookId, cat.id);
    await refreshCats();
  };

  const handleTogglePin = async (cat: Category) => {
    if (!user || !activeBookId) return;
    await updateCategory(user.uid, activeBookId, cat.id, { pinned: !cat.pinned });
    await refreshCats();
  };

  const handleSetLimit = async () => {
    if (!user || !activeBookId || !showLimitDialog) return;
    setSaving(true);
    try {
      const val = parseFloat(limitValue);
      if (!isNaN(val) && val > 0) {
        await setCategoryLimit(user.uid, activeBookId, showLimitDialog.id, val, limitPeriod);
      } else {
        await removeCategoryLimit(user.uid, activeBookId, showLimitDialog.id);
      }
      await loadLimits();
      setShowLimitDialog(null);
    } finally {
      setSaving(false);
    }
  };

  // ─── Tag handlers ──────────────────────────────────────────────────────────

  const openNewTag = () => {
    setEditTagId(null);
    setTagForm({ name: "", color: CAT_COLORS[0] });
    setShowTagForm(true);
  };

  const openEditTag = (tag: { id: string; name: string; color: string }) => {
    setEditTagId(tag.id);
    setTagForm({ name: tag.name, color: tag.color });
    setShowTagForm(true);
  };

  const handleSaveTag = async () => {
    if (!user || !activeBookId || !tagForm.name.trim()) return;
    setSavingTag(true);
    try {
      if (editTagId) {
        await updateTag(user.uid, activeBookId, editTagId, { name: tagForm.name.trim(), color: tagForm.color });
      } else {
        await addTag(user.uid, activeBookId, tagForm.name.trim(), tagForm.color);
      }
      await refreshTags();
      setShowTagForm(false);
    } finally {
      setSavingTag(false);
    }
  };

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    if (!user || !activeBookId) return;
    const ok = await confirm({
      title: `Delete tag "${tagName}"?`,
      message: t.tags_delete_confirm,
      confirmLabel: "Delete",
      cancelLabel: t.tags_cancel,
    });
    if (!ok) return;
    await deleteTag(user.uid, activeBookId, tagId);
    await refreshTags();
    setTagStats((prev) => { const s = { ...prev }; delete s[tagId]; return s; });
  };

  if (loading) return null;

  const CategoryList = ({ cats, type }: { cats: Category[]; type: "expense" | "income" }) => {
    const sorted = [...cats].sort((a, b) => a.order - b.order);
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleCatDragEnd(type)}
      >
        <SortableContext items={sorted.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sorted.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">{t.categories_no_categories}</p>
            )}
            {sorted.map((cat) => (
              <SortableCatRow key={cat.id} id={cat.id} isRtl={isRtl}>
                <div className={cn("flex items-center gap-3 px-4 py-3 rounded-lg border bg-card", isRtl && "flex-row-reverse")}>
                  <span
                    className="text-xl w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ backgroundColor: cat.color + "22" }}
                  >
                    {cat.icon}
                  </span>
                  <div className={cn("flex-1 min-w-0", isRtl && "text-end")}>
                    <div className={cn("flex items-center gap-2", isRtl && "justify-end")}>
                      <span className="font-medium text-sm">{getCategoryDisplayName(cat, locale)}</span>
                      {cat.pinned && <Pin className="h-3 w-3 text-primary" />}
                    </div>
                    {limits[cat.id] !== undefined && (() => {
                      const lim = limits[cat.id];
                      const suffix = lim.budgetPeriod === "yearly" ? t.categories_limit_per_year : t.categories_limit_per_month;
                      return (
                        <span className="text-xs text-muted-foreground">
                          {t.categories_limit_prefix}{" "}
                          <span dir="ltr" className="tabular-nums inline-block">
                            {formatCurrency(lim.budgetAmount, currency)}{suffix}
                          </span>
                          {lim.budgetPeriod === "yearly" && (
                            <span className="ms-1 opacity-70" dir="ltr">({formatCurrency(lim.monthlyLimit, currency)}/mo)</span>
                          )}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={cat.pinned ? t.categories_unpin : t.categories_pin}
                      onClick={() => handleTogglePin(cat)}
                    >
                      {cat.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setShowLimitDialog(cat);
                        const lim = limits[cat.id];
                        setLimitValue(lim ? String(lim.budgetAmount) : "");
                        setLimitPeriod(lim?.budgetPeriod ?? "monthly");
                      }}
                    >
                      {t.categories_limit}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(cat)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </SortableCatRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  };

  return (
    <div className="space-y-5" dir={isRtl ? "rtl" : "ltr"}>
      <h1 className={cn("text-2xl font-bold", isRtl && "text-end")}>{t.nav_categories}</h1>

      {/* Net income summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className={cn("text-sm text-muted-foreground font-normal", isRtl && "text-end")}>{t.budget_summary_subtitle}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-3 gap-3">
            <div className={cn("flex flex-col gap-1", isRtl && "items-end")}>
              <span className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", isRtl && "flex-row-reverse")}>
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                {t.budget_summary_income}
              </span>
              <span className="text-lg font-bold text-green-600 tabular-nums" dir="ltr">{formatCurrency(monthlyIncome, currency)}</span>
            </div>
            <div className={cn("flex flex-col gap-1", isRtl && "items-end")}>
              <span className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", isRtl && "flex-row-reverse")}>
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                {t.budget_summary_expenses}
              </span>
              <span className="text-lg font-bold text-red-500 tabular-nums" dir="ltr">{formatCurrency(monthlyExpenses, currency)}</span>
            </div>
            <div className={cn("flex flex-col gap-1", isRtl && "items-end")}>
              <span className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", isRtl && "flex-row-reverse")}>
                <Wallet className="h-3.5 w-3.5" />
                {t.budget_summary_net}
              </span>
              <span className={`text-lg font-bold tabular-nums ${monthlyNet >= 0 ? "text-green-600" : "text-red-500"}`} dir="ltr">
                {formatCurrency(monthlyNet, currency)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="expense" dir={isRtl ? "rtl" : "ltr"}>
        <TabsList className={cn(isRtl && "w-full")}>
          <TabsTrigger value="expense">{t.categories_expenses_tab} ({expenseCategories.length})</TabsTrigger>
          <TabsTrigger value="income">{t.categories_income_tab} ({incomeCategories.length})</TabsTrigger>
          <TabsTrigger value="tags" onClick={() => { if (!tagStatsLoaded) loadTagStats(); }}>
            <Tag className="h-3.5 w-3.5 me-1.5" />
            {t.tags_tab} ({tags.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expense" className="mt-4 space-y-3">
          <div className={cn("flex", isRtl && "justify-end")}>
            <Button size="sm" onClick={() => openNew("expense")} className="gap-2">
              <Plus className="h-4 w-4" /> {t.categories_add_expense}
            </Button>
          </div>
          <CategoryList cats={expenseCategories} type="expense" />
        </TabsContent>

        <TabsContent value="income" className="mt-4 space-y-3">
          <div className={cn("flex", isRtl && "justify-end")}>
            <Button size="sm" onClick={() => openNew("income")} className="gap-2">
              <Plus className="h-4 w-4" /> {t.categories_add_income}
            </Button>
          </div>
          <CategoryList cats={incomeCategories} type="income" />
        </TabsContent>

        <TabsContent value="tags" className="mt-4 space-y-3">
          <div className={cn("flex", isRtl && "justify-end")}>
            <Button size="sm" onClick={openNewTag} className="gap-2">
              <Plus className="h-4 w-4" /> {t.tags_add}
            </Button>
          </div>

          {tags.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">{t.tags_no_tags}</p>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => {
                const stats = tagStats[tag.id];
                return (
                  <div key={tag.id} className={cn("flex items-center gap-3 px-4 py-3 rounded-lg border bg-card", isRtl && "flex-row-reverse")}>
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <div className={cn("flex-1 min-w-0", isRtl && "text-end")}>
                      <span className="font-medium text-sm">{tag.name}</span>
                      {tagStatsLoaded && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {stats
                            ? `${t.tags_stats_spent}: ${formatCurrency(stats.spent, currency)} · ${stats.count} ${t.tags_stats_transactions}`
                            : t.tags_stats_empty}
                        </p>
                      )}
                    </div>
                    {tagStatsLoaded && stats && (
                      <div
                        className="h-1.5 rounded-full w-20 flex-shrink-0 overflow-hidden bg-muted"
                        title={formatCurrency(stats.spent, currency)}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ backgroundColor: tag.color, width: "100%" }}
                        />
                      </div>
                    )}
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTag(tag)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteTag(tag.id, tag.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Category form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editCat ? t.categories_edit_title : (formType === "expense" ? t.categories_new_expense_title : t.categories_new_income_title)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.categories_name}</Label>
              <Input
                placeholder={t.categories_name_placeholder}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.categories_name_en}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t.categories_name_en_placeholder}
                  value={form.nameEn}
                  onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={handleAutoTranslate}
                  disabled={translating || !form.name.trim()}
                  className="text-xs px-2 py-1 rounded border border-input bg-muted hover:bg-accent disabled:opacity-40 whitespace-nowrap"
                >
                  {translating ? t.categories_translating : t.categories_translate}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.categories_icon}</Label>
              <EmojiPickerButton
                value={form.icon}
                onChange={(emoji) => setForm((f) => ({ ...f, icon: emoji }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.categories_color}</Label>
              <div className="flex gap-2 flex-wrap">
                {CAT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: form.color === c ? "#000" : "transparent" }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t.categories_cancel}</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saving}>
              {saving ? t.categories_saving : editCat ? t.categories_save : t.categories_create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget limit dialog */}
      <Dialog open={!!showLimitDialog} onOpenChange={(o) => !o && setShowLimitDialog(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{t.categories_limit_dialog_prefix} {showLimitDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t.categories_limit_period}</Label>
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  type="button"
                  className={`flex-1 py-1.5 text-sm transition-colors ${limitPeriod === "monthly" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  onClick={() => setLimitPeriod("monthly")}
                >
                  {t.categories_limit_period_monthly}
                </button>
                <button
                  type="button"
                  className={`flex-1 py-1.5 text-sm transition-colors ${limitPeriod === "yearly" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  onClick={() => setLimitPeriod("yearly")}
                >
                  {t.categories_limit_period_yearly}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.categories_limit_input_label} ({currency})</Label>
              <Input
                type="number"
                min="0"
                step="10"
                placeholder={t.categories_limit_placeholder}
                value={limitValue}
                onChange={(e) => setLimitValue(e.target.value)}
              />
              {limitPeriod === "yearly" && limitValue && !isNaN(parseFloat(limitValue)) && parseFloat(limitValue) > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t.categories_limit_yearly_equiv.replace("{amount}", formatCurrency(parseFloat(limitValue) / 12, currency))}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t.categories_limit_hint}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLimitDialog(null)}>{t.categories_cancel}</Button>
            <Button onClick={handleSetLimit} disabled={saving}>{t.categories_save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag form dialog */}
      <Dialog open={showTagForm} onOpenChange={setShowTagForm}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{editTagId ? t.tags_edit_title : t.tags_create_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.tags_name}</Label>
              <Input
                placeholder={t.tags_name_placeholder}
                value={tagForm.name}
                onChange={(e) => setTagForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.tags_color}</Label>
              <div className="flex gap-2 flex-wrap">
                {CAT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: tagForm.color === c ? "#000" : "transparent" }}
                    onClick={() => setTagForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
            {tagForm.name.trim() && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Preview:</span>
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: tagForm.color + "22", color: tagForm.color, border: `1px solid ${tagForm.color}55` }}
                >
                  {tagForm.name.trim()}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagForm(false)}>{t.tags_cancel}</Button>
            <Button onClick={handleSaveTag} disabled={!tagForm.name.trim() || savingTag}>
              {savingTag ? t.tags_saving : editTagId ? t.tags_save : t.tags_create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
