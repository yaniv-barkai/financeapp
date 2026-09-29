"use client";

import React, { useEffect, useState } from "react";
import { Bot, Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getIdToken } from "@/lib/auth-token";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Scope = "read" | "write";

interface TokenSummary {
  id: string;
  name: string;
  prefix: string;
  scope: Scope;
  createdAt: string;
  lastUsedAt: string | null;
}

const TOKEN_PLACEHOLDER = "YOUR_TOKEN";

async function tokensApi<T>(method: "GET" | "POST" | "DELETE", body?: unknown): Promise<T> {
  const idToken = await getIdToken();
  const res = await fetch("/api/tokens", {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

function CopyBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy} aria-label={label}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <pre dir="ltr" className="text-xs bg-muted rounded-md p-2 overflow-x-auto whitespace-pre">
        {text}
      </pre>
    </div>
  );
}

export function AiAssistantsCard() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const confirm = useConfirm();
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<Scope>("read");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [endpoint] = useState(() => {
    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      (typeof window === "undefined" ? "" : window.location.origin);
    return `${base}/api/mcp`;
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    tokensApi<{ tokens: TokenSummary[] }>("GET")
      .then(({ tokens }) => {
        if (!cancelled) setTokens(tokens);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { token, summary } = await tokensApi<{ token: string; summary: TokenSummary }>("POST", {
        name: name.trim(),
        scope,
      });
      setNewToken(token);
      setTokens((prev) => [summary, ...prev]);
      setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (token: TokenSummary) => {
    const ok = await confirm({
      title: t.settings_ai_revoke_title.replace("{name}", token.name),
      message: t.settings_ai_revoke_confirm,
      confirmLabel: t.settings_ai_revoke,
      cancelLabel: t.settings_cancel,
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await tokensApi("DELETE", { id: token.id });
      setTokens((prev) => prev.filter((x) => x.id !== token.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const formatTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale === "he" ? "he-IL" : "en-IL") : t.settings_ai_never_used;

  const tokenForSnippets = newToken ?? TOKEN_PLACEHOLDER;
  const cursorSnippet = JSON.stringify(
    { mcpServers: { finance: { url: endpoint, headers: { Authorization: `Bearer ${tokenForSnippets}` } } } },
    null,
    2
  );
  const claudeSnippet = JSON.stringify(
    {
      mcpServers: {
        finance: {
          command: "npx",
          args: ["-y", "mcp-remote", endpoint, "--header", "Authorization:${AUTH_HEADER}"],
          env: { AUTH_HEADER: `Bearer ${tokenForSnippets}` },
        },
      },
    },
    null,
    2
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" /> {t.settings_ai_title}
        </CardTitle>
        <CardDescription>{t.settings_ai_description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t.settings_ai_new_token}</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              className="flex-1 min-w-40"
              placeholder={t.settings_ai_token_name_placeholder}
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">{t.settings_ai_scope_read}</SelectItem>
                <SelectItem value="write">{t.settings_ai_scope_write}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-9" onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating ? t.settings_saving : t.settings_ai_create}
            </Button>
          </div>
          {scope === "write" && (
            <p className="text-xs text-muted-foreground">{t.settings_ai_scope_write_hint}</p>
          )}
        </div>

        {newToken && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
            <p className="text-sm font-medium">{t.settings_ai_token_once}</p>
            <CopyBlock text={newToken} label={t.settings_ai_copy_token} />
          </div>
        )}

        {tokens.length > 0 && (
          <div className="space-y-1">
            {tokens.map((token) => (
              <div key={token.id} className="flex items-center gap-3 py-1.5">
                <KeyRound className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {token.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {token.scope === "write" ? t.settings_ai_scope_write : t.settings_ai_scope_read}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {token.prefix}… · {t.settings_ai_last_used}: {formatTime(token.lastUsedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRevoke(token)}
                  aria-label={t.settings_ai_revoke}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-medium">{t.settings_ai_connect_title}</p>
          <CopyBlock text={endpoint} label={t.settings_ai_endpoint} />
          <CopyBlock text={cursorSnippet} label={t.settings_ai_cursor} />
          <CopyBlock text={claudeSnippet} label={t.settings_ai_claude} />
          <p className="text-xs text-muted-foreground">{t.settings_ai_chatgpt_note}</p>
        </div>
      </CardContent>
    </Card>
  );
}
