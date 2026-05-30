"use client";

import React, { useState } from "react";
import { Upload, CheckCircle2, Monitor } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import { parseCsvText, autoDetectColumns, buildImportRows } from "@/lib/csv";
import { batchImportTransactions } from "@/lib/firestore/transactions";
import { getMerchants } from "@/lib/firestore/merchants";
import { ImportRow } from "@/lib/types";
import { CategoryPicker } from "@/components/transactions/CategoryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo } from "react";

type Step = "upload" | "map" | "review" | "done";

export default function ImportPage() {
  const { loading } = useRequireAuth();
  const { user } = useAuth();
  const { activeBookId, merchants, categories, currency } = useAppStore();
  const { t } = useLocale();

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

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const defaultCategoryId = categories.find((c) => c.type === "expense")?.id ?? "";

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

  const selectedCount = rows.filter((r) => !r.skip).length;

  const handleImport = async () => {
    if (!user || !activeBookId) return;
    setImporting(true);
    try {
      const toImport = rows.filter((r) => !r.skip);
      const merchantUpdates: Array<{ normalized: string; display: string; categoryId: string }> = [];
      const txRows = toImport.map((r) => {
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
          merchantDisplay: r.merchantDisplay || undefined,
          merchantNormalized: r.merchantNormalized || undefined,
          date: Timestamp.fromDate(r.date),
          tags: [],
        };
      });

      await batchImportTransactions(user.uid, activeBookId, txRows, merchantUpdates);

      const updated = await getMerchants(user.uid, activeBookId);
      const { setMerchants } = useAppStore.getState();
      setMerchants(updated);

      setImportedCount(txRows.length);
      setStep("done");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setCsvText("");
    setHeaders([]);
    setRows([]);
    setImportedCount(0);
  };

  const stepLabels: Record<Step, string> = {
    upload: t.import_step_upload,
    map: t.import_step_map,
    review: t.import_step_review,
    done: t.import_step_done,
  };

  if (loading) return null;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Mobile-only notice */}
      <div className="sm:hidden flex flex-col items-center justify-center gap-4 py-16 text-center px-6">
        <Monitor className="h-12 w-12 text-muted-foreground" />
        <div>
          <p className="font-semibold text-base">{t.import_title}</p>
          <p className="text-sm text-muted-foreground mt-1">{t.import_desktop_only}</p>
        </div>
      </div>

      {/* Desktop-only content */}
      <div className="hidden sm:contents">
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
                <Label>{t.import_merchant_col}</Label>
                <Select value={merchantCol} onValueChange={setMerchantCol}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t.import_none}</SelectItem>
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
            <p className="text-sm text-muted-foreground">
              {selectedCount} / {rows.length}{" "}
              {merchants.length > 0 && ` · ${rows.filter((r) => r.suggestedCategoryId).length} auto`}
            </p>
            <div className="flex gap-2 items-center">
              <Label className="text-sm">{t.import_bulk_assign}</Label>
              <div className="w-44">
                <CategoryPicker value="" onChange={bulkAssign} placeholder={t.import_all_rows} />
              </div>
            </div>
          </div>

          <ScrollArea className="h-[500px] rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="text-start px-3 py-2 font-medium">{t.import_col_skip}</th>
                  <th className="text-start px-3 py-2 font-medium">{t.import_col_date}</th>
                  <th className="text-start px-3 py-2 font-medium">{t.import_col_merchant}</th>
                  <th className="text-start px-3 py-2 font-medium">{t.import_col_amount}</th>
                  <th className="text-start px-3 py-2 font-medium">{t.import_col_category}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className={`${row.skip ? "opacity-40" : ""}`}>
                    <td className="px-3 py-2">
                      <Switch
                        checked={!row.skip}
                        onCheckedChange={(v) => updateRow(row.id, { skip: !v })}
                        className="scale-75"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-3 py-2 max-w-[160px] truncate">
                      {row.merchantDisplay}
                      {row.suggestedCategoryId && row.categoryId === row.suggestedCategoryId && (
                        <span className="ms-1 text-xs text-primary">✦</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 font-mono whitespace-nowrap ${row.type === "income" ? "text-green-600" : "text-red-500"}`}>
                      {row.type === "income" ? "+" : "-"}{formatCurrency(row.amount, currency)}
                    </td>
                    <td className="px-3 py-1.5 min-w-[160px]">
                      <CategoryPicker
                        value={row.categoryId}
                        onChange={(v) => updateRow(row.id, { categoryId: v })}
                        typeFilter={row.type}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>

          <div className="text-xs text-muted-foreground">{t.import_auto_hint}</div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("map")}>{t.import_back}</Button>
            <Button onClick={handleImport} disabled={importing || selectedCount === 0}>
              {importing ? t.import_importing : `${t.import_title} ${selectedCount}`}
            </Button>
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
      </div>{/* end sm:contents */}
    </div>
  );
}
