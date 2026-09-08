"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, CheckCircle2, RotateCcw } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { startOfDay } from "date-fns";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  getTasks,
  addTask,
  updateTask,
  deleteTask,
  taskPossibleSavings,
  taskProjectedYearly,
} from "@/lib/firestore/tasks";
import { getAllTransactions } from "@/lib/firestore/transactions";
import { Task, TaskCostFrequency, Transaction } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { toast } from "sonner";

type StatusFilter = "open" | "done" | "all";

type TaskForm = Omit<Task, "id" | "createdAt">;

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function dateToInput(ts: Timestamp) {
  return ts.toDate().toISOString().slice(0, 10);
}

function inputToTimestamp(value: string) {
  return Timestamp.fromDate(new Date(value + "T12:00:00"));
}

const BLANK: TaskForm = {
  title: "",
  note: "",
  endDate: Timestamp.fromDate(new Date()),
  status: "open",
  transactionIds: [],
  costFrequency: "once",
};

function txLabel(tx: Transaction) {
  return tx.merchantDisplay || tx.note || "—";
}

export default function TasksPage() {
  const { loading } = useRequireAuth();
  const { user } = useAuth();
  const { activeBookId, currency } = useAppStore();
  const { t } = useLocale();
  const confirm = useConfirm();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(BLANK);
  const [endDateStr, setEndDateStr] = useState(todayDateStr());
  const [saving, setSaving] = useState(false);
  const [txSearch, setTxSearch] = useState("");

  const txById = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const tx of transactions) map.set(tx.id, tx);
    return map;
  }, [transactions]);

  const loadData = async () => {
    if (!user || !activeBookId) return;
    const [taskData, txData] = await Promise.all([
      getTasks(user.uid, activeBookId),
      getAllTransactions(user.uid, activeBookId),
    ]);
    setTasks(
      taskData.sort(
        (a, b) => a.endDate.toMillis() - b.endDate.toMillis()
      )
    );
    setTransactions(txData);
  };

  useEffect(() => {
    loadData();
  }, [user, activeBookId]);

  const filtered = tasks.filter((task) => {
    if (statusFilter === "all") return true;
    return task.status === statusFilter;
  });

  const openNew = () => {
    setEditItem(null);
    setForm({ ...BLANK, endDate: inputToTimestamp(todayDateStr()) });
    setEndDateStr(todayDateStr());
    setTxSearch("");
    setShowForm(true);
  };

  const openEdit = (task: Task) => {
    setEditItem(task);
    setForm({
      title: task.title,
      note: task.note ?? "",
      endDate: task.endDate,
      status: task.status,
      transactionIds: [...task.transactionIds],
      costFrequency: task.costFrequency,
    });
    setEndDateStr(dateToInput(task.endDate));
    setTxSearch("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!user || !activeBookId || !form.title.trim()) return;
    setSaving(true);
    try {
      const data: TaskForm = {
        title: form.title.trim(),
        endDate: inputToTimestamp(endDateStr),
        status: form.status,
        transactionIds: form.transactionIds,
        costFrequency: form.costFrequency,
        ...(form.note?.trim() ? { note: form.note.trim() } : {}),
      };
      if (editItem) {
        await updateTask(user.uid, activeBookId, editItem.id, data);
      } else {
        await addTask(user.uid, activeBookId, data);
      }
      await loadData();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task: Task) => {
    if (!user || !activeBookId) return;
    const ok = await confirm({
      title: t.tasks_delete_confirm,
      message: t.tasks_delete_confirm,
      confirmLabel: t.tasks_delete,
      cancelLabel: t.tasks_cancel,
    });
    if (!ok) return;
    await deleteTask(user.uid, activeBookId, task.id);
    loadData();
  };

  const handleToggleStatus = async (task: Task) => {
    if (!user || !activeBookId) return;
    const next: Task["status"] = task.status === "open" ? "done" : "open";
    await updateTask(user.uid, activeBookId, task.id, { status: next });
    toast.success(next === "done" ? t.tasks_mark_done : t.tasks_mark_open);
    loadData();
  };

  const attachTx = (id: string) => {
    setForm((f) =>
      f.transactionIds.includes(id)
        ? f
        : { ...f, transactionIds: [...f.transactionIds, id] }
    );
  };

  const detachTx = (id: string) => {
    setForm((f) => ({
      ...f,
      transactionIds: f.transactionIds.filter((x) => x !== id),
    }));
  };

  const searchLower = txSearch.trim().toLowerCase();
  const pickerResults = useMemo(() => {
    const available = transactions.filter(
      (tx) => !form.transactionIds.includes(tx.id)
    );
    if (!searchLower) return available.slice(0, 20);
    return available
      .filter((tx) => {
        const hay = `${tx.merchantDisplay ?? ""} ${tx.note ?? ""}`.toLowerCase();
        return hay.includes(searchLower);
      })
      .slice(0, 20);
  }, [transactions, form.transactionIds, searchLower]);

  const formSavings = taskPossibleSavings(form.transactionIds, txById);
  const formYearly = taskProjectedYearly(formSavings, form.costFrequency);

  const freqLabel = (f: TaskCostFrequency) => {
    if (f === "monthly") return t.tasks_freq_monthly;
    if (f === "yearly") return t.tasks_freq_yearly;
    return t.tasks_freq_once;
  };

  const isOverdue = (task: Task) => {
    if (task.status !== "open") return false;
    return startOfDay(task.endDate.toDate()) < startOfDay(new Date());
  };

  if (loading) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.tasks_title}</h1>
        <Button size="sm" onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> {t.tasks_add}
        </Button>
      </div>

      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as StatusFilter)}
      >
        <TabsList>
          <TabsTrigger value="open">{t.tasks_tab_open}</TabsTrigger>
          <TabsTrigger value="done">{t.tasks_tab_done}</TabsTrigger>
          <TabsTrigger value="all">{t.tasks_tab_all}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0 divide-y">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-10">
              {t.tasks_no_items}
            </p>
          )}
          {filtered.map((task) => {
            const savings = taskPossibleSavings(task.transactionIds, txById);
            const yearly = taskProjectedYearly(savings, task.costFrequency);
            const overdue = isOverdue(task);
            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  task.status === "done" ? "opacity-60" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge
                      variant={overdue ? "destructive" : "outline"}
                      className="text-xs py-0"
                    >
                      {overdue ? t.tasks_overdue : t.tasks_due}{" "}
                      {formatDate(task.endDate.toDate())}
                    </Badge>
                    <Badge variant="secondary" className="text-xs py-0">
                      {freqLabel(task.costFrequency)}
                    </Badge>
                    {task.status === "done" && (
                      <Badge variant="outline" className="text-xs py-0">
                        {t.tasks_status_done}
                      </Badge>
                    )}
                  </div>
                  {task.note && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {task.note}
                    </p>
                  )}
                </div>
                {savings > 0 && (
                  <div className="text-end flex-shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {t.tasks_possible_savings}
                    </p>
                    <p className="font-semibold text-sm text-green-600">
                      {formatCurrency(savings, currency)}
                      {task.costFrequency !== "once" && (
                        <span className="text-xs font-normal text-muted-foreground ms-1">
                          ({formatCurrency(yearly, currency)}
                          {t.tasks_projected_yearly})
                        </span>
                      )}
                    </p>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => handleToggleStatus(task)}
                  title={
                    task.status === "open"
                      ? t.tasks_mark_done
                      : t.tasks_mark_open
                  }
                >
                  {task.status === "open" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(task)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(task)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editItem ? t.tasks_edit_title : t.tasks_new_title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.tasks_title_label}</Label>
              <Input
                placeholder={t.tasks_title_placeholder}
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.tasks_note}</Label>
              <Input
                placeholder={t.tasks_note_placeholder}
                value={form.note ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.tasks_end_date}</Label>
                <Input
                  type="date"
                  value={endDateStr}
                  onChange={(e) => setEndDateStr(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.tasks_cost_frequency}</Label>
                <Select
                  value={form.costFrequency}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      costFrequency: v as TaskCostFrequency,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">{t.tasks_freq_once}</SelectItem>
                    <SelectItem value="monthly">
                      {t.tasks_freq_monthly}
                    </SelectItem>
                    <SelectItem value="yearly">
                      {t.tasks_freq_yearly}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t.tasks_attach_transactions}</Label>
              {form.transactionIds.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">
                    {t.tasks_attached}
                  </span>
                  {form.transactionIds.map((id) => {
                    const tx = txById.get(id);
                    if (!tx) {
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                        >
                          <span className="flex-1 truncate text-muted-foreground">
                            {id}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => detachTx(id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                      >
                        <span className="flex-1 min-w-0 truncate">
                          {txLabel(tx)} · {formatDate(tx.date.toDate())}
                        </span>
                        <span
                          className={
                            tx.type === "expense"
                              ? "text-red-500 font-medium flex-shrink-0"
                              : "text-muted-foreground flex-shrink-0"
                          }
                        >
                          {formatCurrency(tx.amount, currency)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => detachTx(id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              <Input
                placeholder={t.tasks_search_transactions}
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
              />
              <div className="mt-1 max-h-40 overflow-y-auto divide-y rounded-md border">
                {pickerResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">
                    {t.tasks_no_matching_transactions}
                  </p>
                ) : (
                  pickerResults.map((tx) => (
                    <button
                      key={tx.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs hover:bg-accent"
                      onClick={() => attachTx(tx.id)}
                    >
                      <span className="flex-1 min-w-0 truncate">
                        {txLabel(tx)} · {formatDate(tx.date.toDate())}
                      </span>
                      <span
                        className={
                          tx.type === "expense"
                            ? "text-red-500 font-medium flex-shrink-0"
                            : "text-green-600 font-medium flex-shrink-0"
                        }
                      >
                        {formatCurrency(tx.amount, currency)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {formSavings > 0 && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  {t.tasks_possible_savings}:{" "}
                </span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(formSavings, currency)}
                </span>
                {form.costFrequency !== "once" && (
                  <span className="text-muted-foreground ms-2">
                    ({formatCurrency(formYearly, currency)}
                    {t.tasks_projected_yearly})
                  </span>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t.tasks_cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.title.trim() || !endDateStr}
            >
              {saving
                ? t.tasks_saving
                : editItem
                  ? t.tasks_save
                  : t.tasks_create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
