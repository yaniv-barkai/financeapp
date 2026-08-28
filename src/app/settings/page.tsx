"use client";

import React, { useEffect, useState } from "react";
import { Pencil, Trash2, LogOut, BookOpen, Globe, BrainCircuit, CreditCard, Bell, ExternalLink } from "lucide-react";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import { updateBook, deleteBook, getBooks } from "@/lib/firestore/books";
import { getAllTransactions } from "@/lib/firestore/transactions";
import { rebuildMerchantMemory, getMerchants } from "@/lib/firestore/merchants";
import { setUserSettings, getUserSettings } from "@/lib/firestore/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { AlertSettings, MaxSyncSettings } from "@/lib/types";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { toast } from "sonner";

const CURRENCIES = ["USD", "EUR", "GBP", "ILS", "JPY", "CAD", "AUD", "CHF", "CNY", "INR"];

const BOOK_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

export default function SettingsPage() {
  const { loading } = useRequireAuth();
  const { user, signOutUser } = useAuth();
  const { books, setBooks, activeBookId, setActiveBookId, currency, setCurrency, setMerchants } = useAppStore();
  const { t, locale, setLocale } = useLocale();

  const confirm = useConfirm();
  const [editBook, setEditBook] = useState<{ id: string; name: string; color: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [maxSync, setMaxSync] = useState<MaxSyncSettings | null>(null);
  const [alertEmailEnabled, setAlertEmailEnabled] = useState(true);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertsSaving, setAlertsSaving] = useState(false);

  const githubRepo = process.env.NEXT_PUBLIC_GITHUB_REPO;
  const workflowUrl = githubRepo
    ? `https://github.com/${githubRepo}/actions/workflows/max-sync.yml`
    : null;

  useEffect(() => {
    if (!user) return;
    getUserSettings(user.uid).then((s) => {
      if (s?.maxSync) setMaxSync(s.maxSync);
      if (s?.alertSettings) {
        setAlertEmailEnabled(s.alertSettings.emailEnabled !== false);
        setAlertEmail(s.alertSettings.alertEmail ?? "");
      }
    });
  }, [user]);

  const handleSaveAlerts = async () => {
    if (!user) return;
    setAlertsSaving(true);
    try {
      const alertSettings: AlertSettings = {
        emailEnabled: alertEmailEnabled,
        thresholds: [80, 100],
        ...(alertEmail.trim() ? { alertEmail: alertEmail.trim() } : {}),
      };
      await setUserSettings(user.uid, { alertSettings });
      toast.success(t.settings_alerts_saved);
    } finally {
      setAlertsSaving(false);
    }
  };

  const handleSaveMaxBook = async (bookId: string) => {
    if (!user) return;
    const next: MaxSyncSettings = { ...maxSync, bookId };
    await setUserSettings(user.uid, { maxSync: next });
    setMaxSync(next);
    toast.success(t.settings_save);
  };

  const formatSyncTime = (ts?: { toDate?: () => Date }) => {
    if (!ts?.toDate) return t.settings_max_never;
    return ts.toDate().toLocaleString(locale === "he" ? "he-IL" : "en-IL");
  };

  const handleRebuildMemory = async () => {
    if (!user) return;
    setRebuilding(true);
    try {
      let total = 0;
      for (const book of books) {
        const allTx = await getAllTransactions(user.uid, book.id);
        const count = await rebuildMerchantMemory(user.uid, book.id, allTx);
        total += count;
      }
      // Refresh merchants for the active book into the store
      if (activeBookId) {
        const updated = await getMerchants(user.uid, activeBookId);
        setMerchants(updated);
      }
      toast.success(t.settings_rebuild_done.replace("{n}", String(total)));
    } finally {
      setRebuilding(false);
    }
  };

  const handleCurrencyChange = async (val: string) => {
    setCurrency(val);
    if (user) await setUserSettings(user.uid, { currency: val });
  };

  const handleEditBook = async () => {
    if (!user || !editBook) return;
    setSaving(true);
    try {
      await updateBook(user.uid, editBook.id, { name: editBook.name, color: editBook.color });
      const updated = await getBooks(user.uid);
      setBooks(updated);
      setEditBook(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBook = async (bookId: string, name: string) => {
    if (!user) return;
    if (books.length <= 1) {
      toast.error(t.settings_one_book_required);
      return;
    }
    const ok = await confirm({
      title: `Delete "${name}"?`,
      message: t.settings_delete_book_confirm,
      confirmLabel: "Delete",
      cancelLabel: t.settings_cancel,
    });
    if (!ok) return;
    await deleteBook(user.uid, bookId);
    const updated = await getBooks(user.uid);
    setBooks(updated);
    if (activeBookId === bookId) setActiveBookId(updated[0]?.id ?? null);
  };

  if (loading) return null;

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">{t.settings_title}</h1>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.settings_preferences}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.settings_currency}</Label>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t.settings_language}
            </Label>
            <div className="flex gap-2">
              <Button
                variant={locale === "en" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setLocale("en")}
              >
                🇺🇸 English
              </Button>
              <Button
                variant={locale === "he" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setLocale("he")}
              >
                🇮🇱 עברית
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Books */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> {t.settings_books}
          </CardTitle>
          <CardDescription>{t.settings_books_description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {books.map((book) => (
            <div key={book.id} className="flex items-center gap-3 py-2">
              <span
                className="inline-block w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: book.color }}
              />
              <span className="flex-1 font-medium text-sm">{book.name}</span>
              {activeBookId === book.id && (
                <span className="text-xs text-primary font-semibold">{t.settings_active}</span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditBook({ id: book.id, name: book.name, color: book.color })}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleDeleteBook(book.id, book.name)}
                disabled={books.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* MAX Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> {t.settings_max_title}
          </CardTitle>
          <CardDescription>{t.settings_max_description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-1">{t.settings_max_secrets_title}</p>
            <p className="text-sm text-muted-foreground">{t.settings_max_secrets_steps}</p>
          </div>

          <div className="space-y-1.5">
            <Label>{t.settings_max_book}</Label>
            <Select
              value={maxSync?.bookId ?? activeBookId ?? undefined}
              onValueChange={handleSaveMaxBook}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {books.map((book) => (
                  <SelectItem key={book.id} value={book.id}>{book.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">{t.settings_max_last_sync}: </span>
              {formatSyncTime(maxSync?.lastSyncAt as { toDate?: () => Date } | undefined)}
            </p>
            {maxSync?.lastSyncStatus && (
              <p>
                <span className="text-muted-foreground">Status: </span>
                {maxSync.lastSyncStatus === "ok" && t.settings_max_status_ok}
                {maxSync.lastSyncStatus === "error" && t.settings_max_status_error}
                {maxSync.lastSyncStatus === "running" && t.settings_max_status_running}
                {maxSync.lastSyncStatus === "ok" && maxSync.lastSyncCount != null && (
                  <> — {t.settings_max_imported.replace("{n}", String(maxSync.lastSyncCount))}</>
                )}
              </p>
            )}
            {maxSync?.lastSyncError && maxSync.lastSyncStatus === "error" && (
              <p className="text-destructive text-xs">{maxSync.lastSyncError}</p>
            )}
          </div>

          {workflowUrl && (
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href={workflowUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                {t.settings_max_run_workflow}
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Budget alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> {t.settings_alerts_title}
          </CardTitle>
          <CardDescription>{t.settings_alerts_description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="alert-email"
              checked={alertEmailEnabled}
              onCheckedChange={(v) => setAlertEmailEnabled(v === true)}
            />
            <Label htmlFor="alert-email">{t.settings_alerts_email_enabled}</Label>
          </div>
          <div className="space-y-1.5">
            <Label>{t.settings_alerts_email_override}</Label>
            <Input
              type="email"
              placeholder={t.settings_alerts_email_placeholder}
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={handleSaveAlerts} disabled={alertsSaving}>
            {alertsSaving ? t.settings_saving : t.settings_save}
          </Button>
        </CardContent>
      </Card>

      {/* Merchant Memory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BrainCircuit className="h-4 w-4" /> {t.settings_rebuild_memory}
          </CardTitle>
          <CardDescription>{t.settings_rebuild_memory_desc}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRebuildMemory}
            disabled={rebuilding}
          >
            {rebuilding ? t.settings_rebuilding : t.settings_rebuild_memory}
          </Button>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.settings_account}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {user && (
            <div className="flex items-center gap-3">
              {user.photoURL && (
                <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full" />
              )}
              <div>
                <p className="font-medium text-sm">{user.displayName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          )}
          <Separator />
          <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={signOutUser}>
            <LogOut className="h-4 w-4" /> {t.settings_sign_out}
          </Button>
        </CardContent>
      </Card>

      {/* Edit book dialog */}
      <Dialog open={!!editBook} onOpenChange={(o) => !o && setEditBook(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{t.settings_edit_book_title}</DialogTitle>
          </DialogHeader>
          {editBook && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t.settings_book_name}</Label>
                <Input
                  value={editBook.name}
                  onChange={(e) => setEditBook((b) => b ? { ...b, name: e.target.value } : b)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.settings_book_color}</Label>
                <div className="flex gap-2 flex-wrap">
                  {BOOK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: editBook.color === c ? "#000" : "transparent" }}
                      onClick={() => setEditBook((b) => b ? { ...b, color: c } : b)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBook(null)}>{t.settings_cancel}</Button>
            <Button onClick={handleEditBook} disabled={saving || !editBook?.name.trim()}>
              {saving ? t.settings_saving : t.settings_save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
