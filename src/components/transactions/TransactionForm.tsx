"use client";

import React, { useState, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import { addTransaction, updateTransaction } from "@/lib/firestore/transactions";
import { upsertMerchant } from "@/lib/firestore/merchants";
import { lookupMerchantCategory } from "@/lib/firestore/merchants";
import { Transaction } from "@/lib/types";
import { normalizemerchant } from "@/lib/utils";
import { CategoryPicker } from "./CategoryPicker";
import { TagPicker } from "./TagPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  existing?: Transaction;
  onDone: () => void;
  defaultType?: "income" | "expense";
}

export function TransactionForm({ existing, onDone, defaultType = "expense" }: Props) {
  const { user } = useAuth();
  const { activeBookId, merchants, categories, setMerchants, bumpTxVersion } = useAppStore();
  const { t } = useLocale();

  const [type, setType] = useState<"income" | "expense">(existing?.type ?? defaultType);
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [merchantDisplay, setMerchantDisplay] = useState(existing?.merchantDisplay ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [date, setDate] = useState(
    existing ? existing.date.toDate().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const normalized = normalizemerchant(merchantDisplay);
    if (!normalized) { setSuggestedCategoryId(null); return; }
    const suggestion = lookupMerchantCategory(merchants, merchantDisplay);
    setSuggestedCategoryId(suggestion);
    if (suggestion && !categoryId) setCategoryId(suggestion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantDisplay, merchants]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeBookId || !categoryId || !amount) return;

    setSaving(true);
    try {
      const normalized = normalizemerchant(merchantDisplay);
      const txData = {
        type,
        amount: parseFloat(amount),
        categoryId,
        ...(merchantDisplay && { merchantDisplay }),
        ...(normalized && { merchantNormalized: normalized }),
        date: Timestamp.fromDate(new Date(date + "T12:00:00")),
        ...(note && { note }),
        tags,
      };

      if (existing) {
        await updateTransaction(user.uid, activeBookId, existing.id, txData);
      } else {
        await addTransaction(user.uid, activeBookId, txData);
      }

      if (merchantDisplay) {
        await upsertMerchant(user.uid, activeBookId, merchantDisplay, categoryId);
        const { getMerchants } = await import("@/lib/firestore/merchants");
        const updated = await getMerchants(user.uid, activeBookId);
        setMerchants(updated);
      }

      bumpTxVersion();
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs value={type} onValueChange={(v) => setType(v as "income" | "expense")}>
        <TabsList className="w-full">
          <TabsTrigger value="expense" className="flex-1">{t.form_expense}</TabsTrigger>
          <TabsTrigger value="income" className="flex-1">{t.form_income}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t.form_amount}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t.form_date}</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t.form_merchant}</Label>
        <Input
          placeholder={t.form_merchant_placeholder}
          value={merchantDisplay}
          onChange={(e) => setMerchantDisplay(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t.form_category}</Label>
        <CategoryPicker
          value={categoryId}
          onChange={setCategoryId}
          typeFilter={type}
        />
        {suggestedCategoryId && suggestedCategoryId === categoryId && (
          <p className="text-xs text-muted-foreground">
            ✦ {t.form_auto_suggested}
          </p>
        )}
        {suggestedCategoryId && suggestedCategoryId !== categoryId && (() => {
          const suggestedCat = categories.find((c) => c.id === suggestedCategoryId);
          return suggestedCat ? (
            <button
              type="button"
              className="text-xs text-primary underline-offset-2 hover:underline flex items-center gap-1"
              onClick={() => setCategoryId(suggestedCategoryId)}
            >
              ✦ {t.form_suggested_prefix} {suggestedCat.icon} {suggestedCat.name}
            </button>
          ) : null;
        })()}
      </div>

      <div className="space-y-1.5">
        <Label>{t.form_note}</Label>
        <Textarea
          placeholder={t.form_note_placeholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t.form_tags}</Label>
        <TagPicker value={tags} onChange={setTags} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          {t.form_cancel}
        </Button>
        <Button type="submit" className="flex-1" disabled={saving || !amount || !categoryId}>
          {saving ? t.form_saving : existing ? t.form_save_changes : t.form_add_transaction}
        </Button>
      </div>
    </form>
  );
}
