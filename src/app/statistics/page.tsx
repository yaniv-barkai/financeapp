"use client";

import React, { useEffect, useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { TrendingDown, TrendingUp, Minus, BarChart2 } from "lucide-react";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import { getTransactionsByMonth } from "@/lib/firestore/transactions";
import { Transaction, Category, Tag } from "@/lib/types";
import { formatCurrency, formatDate, getCategoryDisplayName } from "@/lib/utils";
import { CategoryPicker } from "@/components/transactions/CategoryPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Preset = "this_month" | "last_month" | "last_3" | "last_6" | "this_year" | "custom";
type GroupBy = "none" | "category" | "tag" | "month" | "merchant";
type SortField = "date" | "amount" | "merchant" | "category";
type SortDir = "asc" | "desc";

function toDateInput(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function getPresetRange(preset: Preset): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last_month": {
      const last = subMonths(now, 1);
      return { from: startOfMonth(last), to: endOfMonth(last) };
    }
    case "last_3": {
      const three = subMonths(now, 2);
      return { from: startOfMonth(three), to: endOfMonth(now) };
    }
    case "last_6": {
      const six = subMonths(now, 5);
      return { from: startOfMonth(six), to: endOfMonth(now) };
    }
    case "this_year":
      return { from: startOfYear(now), to: endOfYear(now) };
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
}

interface AggregatedRow {
  key: string;
  label: string;
  icon?: string;
  color?: string;
  count: number;
  income: number;
  expenses: number;
  net: number;
}

export default function StatisticsPage() {
  const { user, loading } = useRequireAuth();
  const { activeBookId, categories, tags, currency } = useAppStore();
  const { t, locale } = useLocale();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fetching, setFetching] = useState(false);

  // Filters
  const [preset, setPreset] = useState<Preset>("this_month");
  const [fromDate, setFromDate] = useState(() => toDateInput(startOfMonth(new Date())));
  const [toDate, setToDate] = useState(() => toDateInput(endOfMonth(new Date())));
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterCat, setFilterCat] = useState("");
  const [filterTag, setFilterTag] = useState("all");
  const [searchText, setSearchText] = useState("");

  // View
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const { from, to } = getPresetRange(p);
      setFromDate(toDateInput(from));
      setToDate(toDateInput(to));
    }
  };

  const loadData = async () => {
    if (!user || !activeBookId) return;
    setFetching(true);
    try {
      const from = new Date(fromDate + "T00:00:00");
      const to = new Date(toDate + "T23:59:59");
      // Fetch month by month to avoid Firestore compound index limits
      const results: Transaction[] = [];
      let cursor = startOfMonth(from);
      while (cursor <= to) {
        const monthStart = cursor < from ? from : startOfMonth(cursor);
        const monthEnd = endOfMonth(cursor) > to ? to : endOfMonth(cursor);
        const chunk = await getTransactionsByMonth(user.uid, activeBookId, monthStart, monthEnd);
        results.push(...chunk);
        cursor = startOfMonth(subMonths(cursor, -1)); // advance one month
      }
      // Deduplicate (same tx could appear if ranges overlap)
      const seen = new Set<string>();
      setTransactions(results.filter((tx) => {
        if (seen.has(tx.id)) return false;
        seen.add(tx.id);
        return true;
      }));
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeBookId, fromDate, toDate]);

  // Only tags that appear in result set
  const usedTags = useMemo(() => {
    const ids = new Set<string>();
    transactions.forEach((tx) => tx.tags?.forEach((id) => ids.add(id)));
    return tags.filter((tg) => ids.has(tg.id));
  }, [transactions, tags]);

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== "all" && tx.type !== filterType) return false;
      if (filterCat && tx.categoryId !== filterCat) return false;
      if (filterTag !== "all" && !tx.tags?.includes(filterTag)) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!tx.merchantDisplay?.toLowerCase().includes(q) && !tx.note?.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [transactions, filterType, filterCat, filterTag, searchText]);

  // Summary totals
  const summary = useMemo(() => {
    let income = 0;
    let expenses = 0;
    filtered.forEach((tx) => {
      if (tx.type === "income") income += tx.amount;
      else expenses += tx.amount;
    });
    return { income, expenses, net: income - expenses, count: filtered.length };
  }, [filtered]);

  // Category / tag lookup helpers
  const catMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const tagMap = useMemo(() => {
    const m = new Map<string, Tag>();
    tags.forEach((tg) => m.set(tg.id, tg));
    return m;
  }, [tags]);

  // Aggregated rows
  const aggregated = useMemo((): AggregatedRow[] => {
    if (groupBy === "none") return [];

    const buckets = new Map<string, AggregatedRow>();

    const getOrCreate = (key: string, label: string, icon?: string, color?: string) => {
      if (!buckets.has(key)) {
        buckets.set(key, { key, label, icon, color, count: 0, income: 0, expenses: 0, net: 0 });
      }
      return buckets.get(key)!;
    };

    filtered.forEach((tx) => {
      if (groupBy === "category") {
        const cat = catMap.get(tx.categoryId);
        const key = tx.categoryId || "unknown";
        const label = cat ? getCategoryDisplayName(cat, locale) : "Unknown";
        const row = getOrCreate(key, label, cat?.icon, cat?.color);
        row.count++;
        if (tx.type === "income") row.income += tx.amount;
        else row.expenses += tx.amount;
        row.net = row.income - row.expenses;
      } else if (groupBy === "tag") {
        if (!tx.tags?.length) {
          const row = getOrCreate("__none__", "No tag");
          row.count++;
          if (tx.type === "income") row.income += tx.amount;
          else row.expenses += tx.amount;
          row.net = row.income - row.expenses;
        } else {
          tx.tags.forEach((tagId) => {
            const tg = tagMap.get(tagId);
            const row = getOrCreate(tagId, tg?.name ?? tagId, undefined, tg?.color);
            row.count++;
            if (tx.type === "income") row.income += tx.amount;
            else row.expenses += tx.amount;
            row.net = row.income - row.expenses;
          });
        }
      } else if (groupBy === "month") {
        const d = tx.date.toDate();
        const key = format(d, "yyyy-MM");
        const label = format(d, "MMMM yyyy");
        const row = getOrCreate(key, label);
        row.count++;
        if (tx.type === "income") row.income += tx.amount;
        else row.expenses += tx.amount;
        row.net = row.income - row.expenses;
      } else if (groupBy === "merchant") {
        const key = tx.merchantNormalized || tx.merchantDisplay || "__unknown__";
        const label = tx.merchantDisplay || "Unknown";
        const cat = catMap.get(tx.categoryId);
        const row = getOrCreate(key, label, cat?.icon);
        row.count++;
        if (tx.type === "income") row.income += tx.amount;
        else row.expenses += tx.amount;
        row.net = row.income - row.expenses;
      }
    });

    return Array.from(buckets.values()).sort((a, b) => b.expenses - a.expenses);
  }, [filtered, groupBy, catMap, tagMap, locale]);

  // Sorted flat rows
  const sortedFlat = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") {
        cmp = a.date.seconds - b.date.seconds;
      } else if (sortField === "amount") {
        cmp = a.amount - b.amount;
      } else if (sortField === "merchant") {
        cmp = (a.merchantDisplay ?? "").localeCompare(b.merchantDisplay ?? "");
      } else if (sortField === "category") {
        const ca = catMap.get(a.categoryId);
        const cb = catMap.get(b.categoryId);
        cmp = (getCategoryDisplayName(ca ?? { name: "" }, locale)).localeCompare(
          getCategoryDisplayName(cb ?? { name: "" }, locale)
        );
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir, catMap, locale]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="opacity-25 ms-1">↕</span>;
    return <span className="ms-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const hasActiveFilter = filterType !== "all" || filterCat || filterTag !== "all" || searchText;

  if (loading) return null;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t.stats_title}</h1>

      {/* ── Filters ──────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-4 space-y-4">

        {/* Date range row */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">{t.stats_preset}</Label>
            <Select value={preset} onValueChange={(v) => applyPreset(v as Preset)}>
              <SelectTrigger className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">{t.stats_preset_this_month}</SelectItem>
                <SelectItem value="last_month">{t.stats_preset_last_month}</SelectItem>
                <SelectItem value="last_3">{t.stats_preset_last_3_months}</SelectItem>
                <SelectItem value="last_6">{t.stats_preset_last_6_months}</SelectItem>
                <SelectItem value="this_year">{t.stats_preset_this_year}</SelectItem>
                <SelectItem value="custom">{t.stats_preset_custom}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t.stats_date_from}</Label>
            <Input
              type="date"
              className="h-9 w-36"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPreset("custom"); }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t.stats_date_to}</Label>
            <Input
              type="date"
              className="h-9 w-36"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPreset("custom"); }}
            />
          </div>
        </div>

        {/* Transaction filters row */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
            <SelectTrigger className="h-9 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.transactions_all_types}</SelectItem>
              <SelectItem value="expense">{t.transactions_expense}</SelectItem>
              <SelectItem value="income">{t.transactions_income}</SelectItem>
            </SelectContent>
          </Select>

          <div className="w-44">
            <CategoryPicker
              value={filterCat}
              onChange={(v) => setFilterCat(v === filterCat ? "" : v)}
              placeholder={t.transactions_all_categories}
            />
          </div>

          {usedTags.length > 0 && (
            <Select value={filterTag} onValueChange={(v) => setFilterTag(v)}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.transactions_all_tags}</SelectItem>
                {usedTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Input
            placeholder={t.transactions_search_placeholder}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="h-9 w-40"
          />

          {hasActiveFilter && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterType("all"); setFilterCat(""); setFilterTag("all"); setSearchText(""); }}>
              {t.transactions_clear}
            </Button>
          )}
        </div>

        {/* Group by row */}
        <div className="flex flex-wrap gap-2 items-center pt-1 border-t">
          <span className="text-sm text-muted-foreground">{t.stats_group_by}:</span>
          {(["none", "category", "tag", "month", "merchant"] as GroupBy[]).map((g) => (
            <Button
              key={g}
              variant={groupBy === g ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => setGroupBy(g)}
            >
              {g === "none" ? t.stats_group_none
                : g === "category" ? t.stats_group_category
                : g === "tag" ? t.stats_group_tag
                : g === "month" ? t.stats_group_month
                : t.stats_group_merchant}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Summary cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label={t.stats_summary_transactions}
          value={String(summary.count)}
          icon={<BarChart2 className="h-4 w-4" />}
          color="text-foreground"
        />
        <SummaryCard
          label={t.stats_summary_income}
          value={formatCurrency(summary.income, currency)}
          icon={<TrendingUp className="h-4 w-4" />}
          color="text-green-600"
        />
        <SummaryCard
          label={t.stats_summary_expenses}
          value={formatCurrency(summary.expenses, currency)}
          icon={<TrendingDown className="h-4 w-4" />}
          color="text-red-500"
        />
        <SummaryCard
          label={t.stats_summary_net}
          value={formatCurrency(summary.net, currency)}
          icon={<Minus className="h-4 w-4" />}
          color={summary.net >= 0 ? "text-green-600" : "text-red-500"}
        />
      </div>

      {/* ── Table ────────────────────────────────────────── */}
      {fetching ? (
        <p className="text-center text-muted-foreground py-10">{t.stats_loading}</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">{t.stats_no_results}</p>
      ) : groupBy !== "none" ? (
        <AggregatedTable rows={aggregated} currency={currency} t={t} groupBy={groupBy} />
      ) : (
        <FlatTable
          rows={sortedFlat}
          categories={categories}
          tagMap={tagMap}
          currency={currency}
          locale={locale}
          t={t}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          SortIndicator={SortIndicator}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, color }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <p className={`text-lg font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function FlatTable({ rows, categories, tagMap, currency, locale, t, sortField, sortDir, onSort, SortIndicator }: {
  rows: Transaction[];
  categories: Category[];
  tagMap: Map<string, Tag>;
  currency: string;
  locale: string;
  t: ReturnType<typeof useLocale>["t"];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  SortIndicator: React.FC<{ field: SortField }>;
}) {
  const catMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  return (
    <div className="rounded-xl border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <Th onClick={() => onSort("date")} className="w-32 cursor-pointer select-none">
              {t.stats_col_date}<SortIndicator field="date" />
            </Th>
            <Th onClick={() => onSort("merchant")} className="cursor-pointer select-none">
              {t.stats_col_merchant}<SortIndicator field="merchant" />
            </Th>
            <Th onClick={() => onSort("category")} className="cursor-pointer select-none">
              {t.stats_col_category}<SortIndicator field="category" />
            </Th>
            <Th>{t.stats_col_tags}</Th>
            <Th>{t.stats_col_note}</Th>
            <Th onClick={() => onSort("amount")} className="text-end cursor-pointer select-none">
              {t.stats_col_amount}<SortIndicator field="amount" />
            </Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((tx) => {
            const cat = catMap.get(tx.categoryId);
            const txTags = (tx.tags ?? [])
              .map((id) => tagMap.get(id))
              .filter(Boolean) as Tag[];
            return (
              <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                <Td className="text-muted-foreground whitespace-nowrap">
                  {formatDate(tx.date.toDate())}
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{cat?.icon ?? "📦"}</span>
                    <span className="font-medium truncate max-w-[180px]">
                      {tx.merchantDisplay || cat?.name || "—"}
                    </span>
                  </div>
                </Td>
                <Td>
                  <span className="text-muted-foreground text-xs">
                    {cat ? getCategoryDisplayName(cat, locale) : "—"}
                  </span>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {txTags.map((tg) => (
                      <Badge
                        key={tg.id}
                        variant="outline"
                        className="text-[10px] py-0 h-5"
                        style={{ borderColor: tg.color + "55", color: tg.color, backgroundColor: tg.color + "11" }}
                      >
                        {tg.name}
                      </Badge>
                    ))}
                  </div>
                </Td>
                <Td>
                  {tx.note && (
                    <span className="text-xs text-muted-foreground italic truncate max-w-[140px] block">
                      {tx.note}
                    </span>
                  )}
                </Td>
                <Td className="text-end font-semibold whitespace-nowrap">
                  <span className={tx.type === "income" ? "text-green-600" : "text-red-500"}>
                    {tx.type === "income" ? "+" : "−"}{formatCurrency(tx.amount, currency)}
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AggregatedTable({ rows, currency, t, groupBy }: {
  rows: AggregatedRow[];
  currency: string;
  t: ReturnType<typeof useLocale>["t"];
  groupBy: GroupBy;
}) {
  return (
    <div className="rounded-xl border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <Th>
              {groupBy === "category" ? t.stats_group_category
                : groupBy === "tag" ? t.stats_group_tag
                : groupBy === "month" ? t.stats_col_month
                : t.stats_group_merchant}
            </Th>
            <Th className="text-end">{t.stats_col_count}</Th>
            <Th className="text-end">{t.stats_col_income}</Th>
            <Th className="text-end">{t.stats_col_expenses}</Th>
            <Th className="text-end">{t.stats_col_net}</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-muted/30 transition-colors">
              <Td>
                <div className="flex items-center gap-2">
                  {row.icon && <span className="text-base">{row.icon}</span>}
                  {row.color && !row.icon && (
                    <span className="w-3 h-3 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: row.color }} />
                  )}
                  <span className="font-medium">{row.label}</span>
                </div>
              </Td>
              <Td className="text-end text-muted-foreground">{row.count}</Td>
              <Td className="text-end">
                {row.income > 0 ? (
                  <span className="text-green-600 font-medium">+{formatCurrency(row.income, currency)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Td>
              <Td className="text-end">
                {row.expenses > 0 ? (
                  <span className="text-red-500 font-medium">−{formatCurrency(row.expenses, currency)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Td>
              <Td className="text-end font-semibold">
                <span className={row.net >= 0 ? "text-green-600" : "text-red-500"}>
                  {row.net >= 0 ? "+" : "−"}{formatCurrency(Math.abs(row.net), currency)}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className, onClick }: {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <th
      className={`px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide ${className ?? ""}`}
      onClick={onClick}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-2.5 ${className ?? ""}`}>
      {children}
    </td>
  );
}
