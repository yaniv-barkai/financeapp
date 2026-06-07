"use client";

import React, { useState } from "react";
import { Upload, CheckCircle2, Sparkles } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import { parseCsvText, autoDetectColumns, buildImportRows, DateFormat } from "@/lib/csv";
import { batchImportTransactions } from "@/lib/firestore/transactions";
import { getMerchants } from "@/lib/firestore/merchants";
import { ImportRow } from "@/lib/types";
import { CategoryPicker } from "@/components/transactions/CategoryPicker";
import { TagPicker } from "@/components/transactions/TagPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useMemo } from "react";

type Step = "upload" | "map" | "review" | "done";

export default function ImportPage() {
  const { loading } = useRequireAuth();
  const { user } = useAuth();
  const { activeBookId, books, merchants, categories, tags, currency } = useAppStore();
  const { t, locale } = useLocale();

  const [step, setStep] = useState<Step>("upload");
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);

  const [dateCol, setDateCol] = useState("");
  const [merchantCol, setMerchantCol] = useState("");
  const [amountCol, setAmountCol] = useState("");
  const [debitCol, setDebitCol] = useState("");
  const [creditCol, setCreditCol] = useState("");
  const [negativeIsExpense, setNegativeIsExpense] = useState(true);
  const [useDebitCredit, setUseDebitCredit] = useState(false);
  const [dateFormat, setDateFormat] = useState<DateFormat>("auto");

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [aiCategorizing, setAiCategorizing] = useState(false);
  const [aiDoneCount, setAiDoneCount] = useState<number | null>(null);

  const defaultCategoryId = "";

  const merchantMemory = useMemo(() => {
    const mem: Record<string, string> = {};
    merchants.forEach((m) => { mem[m.id] = m.defaultCategoryId; });
    return mem;
  }, [merchants]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers } = parseCsvText(text);
      setCsvText(text);
      setHeaders(headers);

      const detected = autoDetectColumns(headers);
      setDateCol(detected.dateCol ?? headers[0] ?? "");
      setMerchantCol(detected.merchantCol ?? "");
      setAmountCol(detected.amountCol ?? "");
      setDebitCol(detected.debitCol ?? "");
      setCreditCol(detected.creditCol ?? "");
      setUseDebitCredit(!!(detected.debitCol && detected.creditCol));

      setStep("map");
    };
    reader.readAsText(file);
  };

  const handleBuildRows = () => {
    const { rows: csvRows } = parseCsvText(csvText);
    const built = buildImportRows(csvRows, {
      dateCol,
      merchantCol,
      amountCol: useDebitCredit ? undefined : amountCol,
      debitCol: useDebitCredit ? debitCol : undefined,
      creditCol: useDebitCredit ? creditCol : undefined,
      negativeIsExpense,
      merchantMemory,
      defaultCategoryId,
      defaultBookId: activeBookId ?? books[0]?.id ?? "",
      dateFormat,
    });
    setRows(built);
    setStep("review");
  };

  const updateRow = (id: string, changes: Partial<ImportRow>) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...changes } : r));
  };

  const bulkAssign = (categoryId: string) => {
    setRows((prev) => prev.map((r) => r.skip ? r : { ...r, categoryId }));
  };

  // Only rows that have a category, are not skipped, and not yet imported
  const readyToImport = rows.filter((r) => !r.skip && r.categoryId && !r.imported);
  const alreadyImported = rows.filter((r) => r.imported).length;
  const uncategorized = rows.filter((r) => !r.skip && !r.categoryId && !r.imported).length;

  const handleImport = async () => {
    if (!user || readyToImport.length === 0) return;
    setImporting(true);
    try {
      const byBook = new Map<string, typeof readyToImport>();
      for (const r of readyToImport) {
        const bid = r.bookId || activeBookId || "";
        if (!byBook.has(bid)) byBook.set(bid, []);
        byBook.get(bid)!.push(r);
      }

      const importedIds = new Set<string>();
      for (const [bookId, bookRows] of byBook) {
        const merchantUpdates: Array<{ normalized: string; display: string; categoryId: string }> = [];
        const txRows = bookRows.map((r) => {
          importedIds.add(r.id);
          if (r.merchantNormalized) {
            merchantUpdates.push({
              normalized: r.merchantNormalized,
              display: r.merchantDisplay,
              categoryId: r.categoryId,
            });
          }
          return {
            type: r.type,
            amount: r.amount,
            categoryId: r.categoryId,
            ...(r.merchantDisplay ? { merchantDisplay: r.merchantDisplay } : {}),
            ...(r.merchantNormalized ? { merchantNormalized: r.merchantNormalized } : {}),
            date: Timestamp.fromDate(r.date),
            tags: r.tags ?? [],
          };
        });
        await batchImportTransactions(user.uid, bookId, txRows, merchantUpdates);
      }

      // Mark rows as imported
      setRows((prev) => prev.map((r) => importedIds.has(r.id) ? { ...r, imported: true } : r));
      setImportedCount((c) => c + importedIds.size);

      // Refresh merchants for the active book
      if (activeBookId) {
        const updated = await getMerchants(user.uid, activeBookId);
        useAppStore.getState().setMerchants(updated);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleAiCategorize = async () => {
    setAiCategorizing(true);
    setAiDoneCount(null);
    try {
      const uncategorized = rows.filter((r) => !r.skip);
      const uniqueMerchants = [...new Set(uncategorized.map((r) => r.merchantDisplay).filter(Boolean))];

      const res = await fetch("/api/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchants: uniqueMerchants,
          categories: categories.map((c) => ({
            id: c.id,
            name: c.name,
            nameEn: c.nameEn,
            icon: c.icon,
            type: c.type,
          })),
        }),
      });
      const { matches } = await res.json() as { matches: Record<string, string> };

      let count = 0;
      setRows((prev) =>
        prev.map((r) => {
          const catId = matches[r.merchantDisplay];
          if (catId) { count++; return { ...r, categoryId: catId }; }
          return r;
        })
      );
      setAiDoneCount(count);
    } finally {
      setAiCategorizing(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setCsvText("");
    setHeaders([]);
    setRows([]);
    setImportedCount(0);
    setDateFormat("auto");
  };

  const stepLabels: Record<Step, string> = {
    upload: t.import_step_upload,
    map: t.import_step_map,
    review: t.import_step_review,
    done: t.import_step_done,
  };

  if (loading) return null;

  return (
    <div className="space-y-5 max-w-5xl">
      <h1 className="text-2xl font-bold">{t.import_title}</h1>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "map", "review", "done"] as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            <span className={`font-medium ${step === s ? "text-primary" : "text-muted-foreground"}`}>
              {i + 1}. {stepLabels[s]}
            </span>
            {i < 3 && <span className="text-muted-foreground">›</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardContent className="pt-6">
            <label className="flex flex-col items-center gap-4 cursor-pointer border-2 border-dashed border-border rounded-xl p-10 hover:border-primary transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">{t.import_upload_title}</p>
                <p className="text-sm text-muted-foreground mt-1">{t.import_upload_subtitle}</p>
              </div>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
              <Button variant="outline">{t.import_choose_file}</Button>
            </label>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column mapping */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.import_map_title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              {t.import_map_detected.replace("{n}", String(headers.length))}
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t.import_date_col}</Label>
                <Select value={dateCol} onValueChange={setDateCol}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t.import_date_format}</Label>
                <Select value={dateFormat} onValueChange={(v) => setDateFormat(v as DateFormat)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t.import_date_format_auto}</SelectItem>
                    <SelectItem value="DMY">{t.import_date_format_dmy}</SelectItem>
                    <SelectItem value="MDY">{t.import_date_format_mdy}</SelectItem>
                    <SelectItem value="YMD">{t.import_date_format_ymd}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t.import_merchant_col}</Label>
                <Select
                  value={merchantCol === "" ? "__none__" : merchantCol}
                  onValueChange={(v) => setMerchantCol(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t.import_none}</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={useDebitCredit} onCheckedChange={setUseDebitCredit} />
              <Label>{t.import_debit_credit_toggle}</Label>
            </div>

            {useDebitCredit ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t.import_debit_col}</Label>
                  <Select value={debitCol} onValueChange={setDebitCol}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t.import_credit_col}</Label>
                  <Select value={creditCol} onValueChange={setCreditCol}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t.import_amount_col}</Label>
                  <Select value={amountCol} onValueChange={setAmountCol}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 pt-7">
                  <Switch checked={negativeIsExpense} onCheckedChange={setNegativeIsExpense} />
                  <Label>{t.import_negative_expense}</Label>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>{t.import_back}</Button>
              <Button onClick={handleBuildRows} disabled={!dateCol || (!amountCol && !useDebitCredit)}>
                {t.import_preview}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                {alreadyImported > 0 && (
                  <span className="text-green-600 font-medium">✓ {alreadyImported} imported</span>
                )}
                {readyToImport.length > 0 && (
                  <span className="text-primary font-medium">{readyToImport.length} ready</span>
                )}
                {uncategorized > 0 && (
                  <span className="text-muted-foreground">{uncategorized} uncategorized</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleAiCategorize}
                disabled={aiCategorizing}
              >
                <Sparkles className={`h-3.5 w-3.5 ${aiCategorizing ? "animate-pulse text-yellow-500" : "text-yellow-500"}`} />
                {aiCategorizing ? "Asking AI…" : "AI Categorize"}
              </Button>
              {aiDoneCount !== null && (
                <span className="text-xs text-muted-foreground">✓ {aiDoneCount} matched</span>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <Label className="text-sm">{t.import_bulk_assign}</Label>
              <div className="w-44">
                <CategoryPicker value="" onChange={bulkAssign} placeholder={t.import_all_rows} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border overflow-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
            <table className="w-full text-sm" dir={locale === "he" ? "rtl" : "ltr"}>
              <thead className="sticky top-0 bg-background border-b z-10">
                <tr>
                  <th className="text-start px-3 py-2 font-medium w-12">{t.import_col_skip}</th>
                  <th className="text-start px-3 py-2 font-medium whitespace-nowrap">{t.import_col_date}</th>
                  <th className="text-start px-3 py-2 font-medium min-w-[220px]">{t.import_col_merchant}</th>
                  <th className="text-start px-3 py-2 font-medium whitespace-nowrap">{t.import_col_amount}</th>
                  <th className="text-start px-3 py-2 font-medium">{t.import_col_category}</th>
                  <th className="text-start px-3 py-2 font-medium">{t.import_col_tags}</th>
                  {books.length > 1 && (
                    <th className="text-start px-3 py-2 font-medium">{t.import_col_book}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`${row.imported ? "bg-green-50 dark:bg-green-950/20" : row.skip ? "opacity-40" : ""}`}
                  >
                    <td className="px-3 py-2 w-12">
                      {row.imported ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <Switch
                          checked={!row.skip}
                          onCheckedChange={(v) => updateRow(row.id, { skip: !v })}
                          className="scale-75"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-3 py-2 min-w-[220px] max-w-[280px] align-middle" title={row.merchantDisplay}>
                      <span className="break-words leading-snug">
                        {row.merchantDisplay}
                        {row.suggestedCategoryId && row.categoryId === row.suggestedCategoryId && (
                          <span className="ms-1 text-xs text-primary">✦</span>
                        )}
                      </span>
                    </td>
                    <td className={`px-3 py-2 font-mono whitespace-nowrap ${row.type === "income" ? "text-green-600" : "text-red-500"}`}>
                      {row.type === "income" ? "+" : "-"}{formatCurrency(row.amount, currency)}
                    </td>
                    <td className="px-3 py-1.5 min-w-[160px]">
                      {row.imported ? (
                        <span className="text-xs text-muted-foreground">
                          {categories.find((c) => c.id === row.categoryId)?.name ?? row.categoryId}
                        </span>
                      ) : (
                        <CategoryPicker
                          value={row.categoryId}
                          onChange={(v) => updateRow(row.id, { categoryId: v })}
                          typeFilter={row.type}
                        />
                      )}
                    </td>
                    <td className="px-3 py-1.5 min-w-[200px]">
                      {row.imported ? (
                        <span className="text-xs text-muted-foreground">
                          {row.tags.map((id) => tags.find((tg) => tg.id === id)?.name).filter(Boolean).join(", ")}
                        </span>
                      ) : (
                        <TagPicker
                          value={row.tags}
                          onChange={(t) => updateRow(row.id, { tags: t })}
                        />
                      )}
                    </td>
                    {books.length > 1 && (
                      <td className="px-3 py-1.5 min-w-[130px]">
                        {row.imported ? (
                          <span className="text-xs text-muted-foreground">
                            {books.find((b) => b.id === row.bookId)?.name}
                          </span>
                        ) : (
                          <Select
                            value={row.bookId}
                            onValueChange={(v) => updateRow(row.id, { bookId: v })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {books.map((b) => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-muted-foreground">{t.import_auto_hint}</div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setStep("map")}>{t.import_back}</Button>
            <Button
              onClick={handleImport}
              disabled={importing || readyToImport.length === 0}
            >
              {importing
                ? t.import_importing
                : `Import ${readyToImport.length} categorized`}
            </Button>
            {alreadyImported > 0 && uncategorized === 0 && readyToImport.length === 0 && (
              <Button variant="outline" onClick={() => setStep("done")}>
                <CheckCircle2 className="h-4 w-4 me-2 text-green-500" />
                All done — finish
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === "done" && (
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
            <div>
              <p className="text-xl font-bold">{t.import_done_title}</p>
              <p className="text-muted-foreground mt-1">
                {importedCount} {t.import_title.toLowerCase()}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset}>{t.import_another}</Button>
              <Button onClick={() => window.location.href = "/"}>{t.import_go_dashboard}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
