"use client";

import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  getRecurring,
  addRecurring,
  updateRecurring,
  deleteRecurring,
} from "@/lib/firestore/recurring";
import { Recurring } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CategoryPicker } from "@/components/transactions/CategoryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addMonths, addWeeks, addYears } from "date-fns";
import { useConfirm } from "@/components/providers/ConfirmProvider";

function nextRunDate(cadence: Recurring["cadence"]): Date {
  const now = new Date();
  switch (cadence) {
    case "weekly": return addWeeks(now, 1);
    case "monthly": return addMonths(now, 1);
    case "yearly": return addYears(now, 1);
  }
}

const BLANK: Omit<Recurring, "id" | "createdAt"> = {
  type: "expense",
  amount: 0,
  categoryId: "",
  merchantDisplay: "",
  note: "",
  cadence: "monthly",
  nextRunDate: Timestamp.fromDate(new Date()),
  active: true,
};

export default function RecurringPage() {
  const { loading } = useRequireAuth();
  const { user } = useAuth();
  const { activeBookId, categories, currency } = useAppStore();
  const { t } = useLocale();

  const confirm = useConfirm();
  const [recurrings, setRecurrings] = useState<Recurring[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Recurring | null>(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!user || !activeBookId) return;
    const data = await getRecurring(user.uid, activeBookId);
    setRecurrings(data.sort((a, b) => a.cadence.localeCompare(b.cadence)));
  };

  useEffect(() => {
    loadData();
  }, [user, activeBookId]);

  const openNew = () => {
    setEditItem(null);
    setForm({ ...BLANK, nextRunDate: Timestamp.fromDate(nextRunDate("monthly")) });
    setShowForm(true);
  };

  const openEdit = (r: Recurring) => {
    setEditItem(r);
    setForm({
      type: r.type,
      amount: r.amount,
      categoryId: r.categoryId,
      merchantDisplay: r.merchantDisplay ?? "",
      note: r.note ?? "",
      cadence: r.cadence,
      nextRunDate: r.nextRunDate,
      active: r.active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!user || !activeBookId || !form.categoryId) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        nextRunDate: Timestamp.fromDate(nextRunDate(form.cadence)),
      };
      if (editItem) {
        await updateRecurring(user.uid, activeBookId, editItem.id, data);
      } else {
        await addRecurring(user.uid, activeBookId, data);
      }
      await loadData();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: Recurring) => {
    if (!user || !activeBookId) return;
    const ok = await confirm({
      title: "Delete recurring?",
      message: t.recurring_delete_confirm,
      confirmLabel: "Delete",
      cancelLabel: t.recurring_cancel,
    });
    if (!ok) return;
    await deleteRecurring(user.uid, activeBookId, r.id);
    loadData();
  };

  const handleToggleActive = async (r: Recurring) => {
    if (!user || !activeBookId) return;
    await updateRecurring(user.uid, activeBookId, r.id, { active: !r.active });
    loadData();
  };

  const cadenceLabel = (c: Recurring["cadence"]) => {
    if (c === "weekly") return t.recurring_weekly;
    if (c === "monthly") return t.recurring_monthly;
    return t.recurring_yearly;
  };

  const typeLabel = (type: "income" | "expense") =>
    type === "income" ? t.recurring_income : t.recurring_expense;

  if (loading) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.recurring_title}</h1>
        <Button size="sm" onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> {t.recurring_add}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {recurrings.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-10">
              {t.recurring_no_items}
            </p>
          )}
          {recurrings.map((r) => {
            const cat = categories.find((c) => c.id === r.categoryId);
            return (
              <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${!r.active ? "opacity-50" : ""}`}>
                <span className="text-xl w-8 text-center flex-shrink-0">{cat?.icon ?? "🔄"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {r.merchantDisplay || cat?.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="outline" className="text-xs py-0">{cadenceLabel(r.cadence)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {t.recurring_next} {formatDate(r.nextRunDate.toDate())}
                    </span>
                    <Badge variant={r.type === "income" ? "default" : "secondary"} className="text-xs py-0">
                      {typeLabel(r.type)}
                    </Badge>
                  </div>
                </div>
                <span className={`font-semibold text-sm flex-shrink-0 ${r.type === "income" ? "text-green-600" : "text-red-500"}`}>
                  {formatCurrency(r.amount, currency)}
                </span>
                <Switch
                  checked={r.active}
                  onCheckedChange={() => handleToggleActive(r)}
                  className="flex-shrink-0"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(r)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? t.recurring_edit_title : t.recurring_new_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as "income" | "expense" }))}>
              <TabsList className="w-full">
                <TabsTrigger value="expense" className="flex-1">{t.recurring_expense}</TabsTrigger>
                <TabsTrigger value="income" className="flex-1">{t.recurring_income}</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.recurring_amount}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={t.recurring_amount_placeholder}
                  value={form.amount || ""}
                  onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.recurring_cadence}</Label>
                <Select value={form.cadence} onValueChange={(v) => setForm((f) => ({ ...f, cadence: v as Recurring["cadence"] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">{t.recurring_weekly}</SelectItem>
                    <SelectItem value="monthly">{t.recurring_monthly}</SelectItem>
                    <SelectItem value="yearly">{t.recurring_yearly}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t.recurring_category}</Label>
              <CategoryPicker
                value={form.categoryId}
                onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
                typeFilter={form.type}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.recurring_merchant}</Label>
              <Input
                placeholder={t.recurring_merchant_placeholder}
                value={form.merchantDisplay ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, merchantDisplay: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.recurring_note}</Label>
              <Input
                placeholder={t.recurring_note_placeholder}
                value={form.note ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
              <Label>{t.recurring_active}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t.recurring_cancel}</Button>
            <Button onClick={handleSave} disabled={saving || !form.categoryId || form.amount <= 0}>
              {saving ? t.recurring_saving : editItem ? t.recurring_save : t.recurring_create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
