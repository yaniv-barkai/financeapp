"use client";

import React, { useCallback, useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, UserPlus, Ban, CheckCircle, KeyRound, Trash2, Copy, RefreshCw } from "lucide-react";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  createAdminAccount,
  deleteAdminAccount,
  listAdminAccounts,
  resetAdminAccountPassword,
  setAdminAccountDisabled,
} from "@/lib/admin-api";
import type { AccountListItem } from "@/lib/admin-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { toast } from "sonner";

export default function AdminPage() {
  const { loading: authLoading } = useRequireAuth();
  const { user, isAdmin, loading: authContextLoading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const confirm = useConfirm();

  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountListItem | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");

  useEffect(() => {
    if (authLoading || authContextLoading) return;
    if (!user) return;
    if (!isAdmin) {
      startTransition(() => router.replace("/"));
    }
  }, [user, isAdmin, authLoading, authContextLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listAdminAccounts();
      setAccounts(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.admin_error_generic);
    } finally {
      setLoading(false);
    }
  }, [t.admin_error_generic]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, load]);

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
    toast.success(t.admin_link_copied);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await createAdminAccount(email.trim(), displayName.trim());
      setResetLink(result.resetLink);
      setCreateOpen(false);
      setEmail("");
      setDisplayName("");
      toast.success(t.admin_created);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.admin_error_generic);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (account: AccountListItem) => {
    const nextDisabled = account.status === "active";
    const ok = await confirm({
      title: nextDisabled ? t.admin_disable_title : t.admin_enable_title,
      message: nextDisabled
        ? t.admin_disable_confirm.replace("{email}", account.email ?? account.uid)
        : t.admin_enable_confirm.replace("{email}", account.email ?? account.uid),
    });
    if (!ok) return;
    try {
      await setAdminAccountDisabled(account.uid, nextDisabled);
      toast.success(nextDisabled ? t.admin_disabled : t.admin_enabled);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.admin_error_generic);
    }
  };

  const handleReset = async (account: AccountListItem) => {
    try {
      const { resetLink: link } = await resetAdminAccountPassword(account.uid, account.email);
      setResetLink(link);
      toast.success(t.admin_reset_ready);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.admin_error_generic);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if ((deleteTarget.email ?? "").toLowerCase() !== deleteConfirmEmail.trim().toLowerCase()) {
      toast.error(t.admin_delete_email_mismatch);
      return;
    }
    setSubmitting(true);
    try {
      await deleteAdminAccount(deleteTarget.uid);
      toast.success(t.admin_deleted);
      setDeleteTarget(null);
      setDeleteConfirmEmail("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.admin_error_generic);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || authContextLoading || !user || !isAdmin) {
    return (
      <div className="p-6 text-sm text-muted-foreground">{t.admin_loading}</div>
    );
  }

  const statusLabel = (status: AccountListItem["status"]) => {
    if (status === "active") return t.admin_status_active;
    if (status === "disabled") return t.admin_status_disabled;
    return t.admin_status_unprovisioned;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> {t.admin_title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t.admin_privacy_note}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="h-4 w-4 me-1" /> {t.admin_refresh}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 me-1" /> {t.admin_create}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.admin_accounts}</CardTitle>
          <CardDescription>{t.admin_accounts_description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t.admin_loading}</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.admin_empty}</p>
          ) : (
            accounts.map((account) => {
              const isSelf = account.uid === user.uid;
              return (
                <div
                  key={account.uid}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium truncate">
                      {account.displayName || account.email || account.uid}
                      {isSelf ? (
                        <span className="ms-2 text-xs text-muted-foreground">({t.admin_you})</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{account.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {statusLabel(account.status)}
                      {account.lastSignInTime
                        ? ` · ${t.admin_last_login}: ${new Date(account.lastSignInTime).toLocaleString()}`
                        : ` · ${t.admin_never_logged_in}`}
                    </p>
                  </div>
                    <div className="flex flex-wrap gap-2">
                    {(account.status === "unprovisioned" || account.status === "disabled") ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSelf}
                        onClick={() => void handleToggle(account)}
                      >
                        <CheckCircle className="h-3.5 w-3.5 me-1" /> {t.admin_enable}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSelf}
                        onClick={() => void handleToggle(account)}
                      >
                        <Ban className="h-3.5 w-3.5 me-1" /> {t.admin_disable}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => void handleReset(account)}>
                      <KeyRound className="h-3.5 w-3.5 me-1" /> {t.admin_reset_password}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      disabled={isSelf}
                      onClick={() => {
                        setDeleteTarget(account);
                        setDeleteConfirmEmail("");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 me-1" /> {t.admin_delete}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.admin_create_title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">{t.admin_email}</Label>
              <Input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.admin_email_placeholder}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-name">{t.admin_name}</Label>
              <Input
                id="admin-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t.admin_name_placeholder}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t.admin_create_hint}</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t.admin_cancel}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? t.admin_creating : t.admin_create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirmEmail("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.admin_delete_title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t.admin_delete_confirm.replace("{email}", deleteTarget?.email ?? "")}
          </p>
          <div className="space-y-1.5">
            <Label>{t.admin_delete_type_email}</Label>
            <Input
              value={deleteConfirmEmail}
              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              placeholder={deleteTarget?.email ?? ""}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t.admin_cancel}
            </Button>
            <Button variant="destructive" disabled={submitting} onClick={() => void handleDelete()}>
              {submitting ? t.admin_deleting : t.admin_delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetLink)} onOpenChange={(open) => !open && setResetLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.admin_reset_link_title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t.admin_reset_link_description}</p>
          <div className="rounded-md bg-muted p-3 text-xs break-all font-mono">{resetLink}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetLink(null)}>
              {t.admin_cancel}
            </Button>
            <Button onClick={() => resetLink && void copyLink(resetLink)}>
              <Copy className="h-4 w-4 me-1" /> {t.admin_copy_link}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
