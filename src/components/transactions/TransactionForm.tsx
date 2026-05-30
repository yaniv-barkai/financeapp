"use client";

import React, { useState, useEffect, useRef } from "react";
import { Timestamp } from "firebase/firestore";
import { X, Paperclip } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import { addTransaction, updateTransaction } from "@/lib/firestore/transactions";
import { upsertMerchant } from "@/lib/firestore/merchants";
import { lookupMerchantCategory } from "@/lib/firestore/merchants";
import { Transaction } from "@/lib/types";
import { normalizemerchant } from "@/lib/utils";
import { CategoryPicker } from "./CategoryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

interface Props {
  existing?: Transaction;
  onDone: () => void;
  defaultType?: "income" | "expense";
}

export function TransactionForm({ existing, onDone, defaultType = "expense" }: Props) {
  const { user } = useAuth();
  const { activeBookId, merchants, setMerchants, bumpTxVersion } = useAppStore();
  const { t } = useLocale();

  const [type, setType] = useState<"income" | "expense">(existing?.type ?? defaultType);
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [merchantDisplay, setMerchantDisplay] = useState(existing?.merchantDisplay ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [date, setDate] = useState(
    existing ? existing.date.toDate().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const normalized = normalizemerchant(merchantDisplay);
    if (!normalized) { setSuggestedCategoryId(null); return; }
    const suggestion = lookupMerchantCategory(merchants, merchantDisplay);
    setSuggestedCategoryId(suggestion);
    if (suggestion && !categoryId) setCategoryId(suggestion);
  }, [merchantDisplay]);

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag]);
    setTagInput("");
  };

  const uploadReceipt = async (txId: string): Promise<string | null> => {
    if (!user || !receiptFile) return null;
    const path = `users/${user.uid}/receipts/${txId}/${receiptFile.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, receiptFile);
    return path;
  };

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
        ...(existing?.receiptPath != null && { receiptPath: existing.receiptPath }),
      };

      if (existing) {
        let receiptPath = existing.receiptPath;
        if (receiptFile) receiptPath = (await uploadReceipt(existing.id)) ?? undefined;
        await updateTransaction(user.uid, activeBookId, existing.id, { ...txData, receiptPath });
      } else {
        const txId = await addTransaction(user.uid, activeBookId, txData);
        if (receiptFile) {
          const receiptPath = await uploadReceipt(txId);
          if (receiptPath) await updateTransaction(user.uid, activeBookId, txId, { receiptPath });
        }
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
        <Label>{t.form_category}</Label>
        <CategoryPicker
          value={categoryId}
          onChange={setCategoryId}
          typeFilter={type}
        />
        {suggestedCategoryId && suggestedCategoryId === categoryId && (
          <p className="text-xs text-muted-foreground">{t.form_auto_suggested}</p>
        )}
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
        <div className="flex gap-2">
          <Input
            placeholder={t.form_tag_placeholder}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag}>{t.form_add_tag}</Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                #{tag}
                <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== tag))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>{t.form_receipt}</Label>
        <div className="flex gap-2 items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
            {receiptFile ? receiptFile.name : t.form_attach_photo}
          </Button>
          {receiptFile && (
            <button type="button" onClick={() => setReceiptFile(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {existing?.receiptPath && !receiptFile && (
          <p className="text-xs text-muted-foreground">{t.form_receipt_attached}</p>
        )}
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
