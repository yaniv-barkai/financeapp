import { Timestamp } from "firebase/firestore";

export type TransactionType = "income" | "expense";

export interface Book {
  id: string;
  name: string;
  color: string;
  currency: string;
  createdAt: Timestamp;
}

export interface Category {
  id: string;
  name: string;
  nameEn?: string;
  type: TransactionType;
  icon: string;
  color: string;
  pinned: boolean;
  order: number;
}

export type BudgetPeriod = "monthly" | "yearly";

export interface CategoryLimit {
  budgetAmount: number;
  budgetPeriod: BudgetPeriod;
  /** Effective monthly limit: budgetAmount for monthly, budgetAmount/12 for yearly */
  monthlyLimit: number;
}

/** Per-month category budget amounts. Doc id = YYYY-MM. */
export interface MonthlyBudget {
  monthKey: string;
  /** categoryId → budget amount for that month */
  amounts: Record<string, number>;
  /** Planned monthly income for this month (optional; UI falls back to recurring). */
  income?: number;
  updatedAt?: Timestamp;
  createdAt?: Timestamp;
}

export type TransactionSource = "manual" | "csv" | "max";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  merchantNormalized?: string;
  merchantDisplay?: string;
  date: Timestamp;
  note?: string;
  tags: string[];
  splits?: Array<{ categoryId: string; amount: number }>;
  /** Credit-card installment plan (e.g. payment 2 of 3). */
  installments?: { number: number; total: number };
  /** Full purchase amount when `amount` is a single installment. */
  originalAmount?: number;
  recurringId?: string;
  /** Linked debt when this payment was attached/recognized */
  debtId?: string;
  source?: TransactionSource;
  sourceKey?: string;
  createdAt: Timestamp;
}

export interface Merchant {
  id: string;
  displayName: string;
  defaultCategoryId: string;
  count: number;
  lastSeenAt: Timestamp;
}

export type RecurringCadence = "monthly" | "weekly" | "yearly";

export interface Recurring {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  merchantDisplay?: string;
  note?: string;
  cadence: RecurringCadence;
  dayOfMonth?: number;
  nextRunDate: Timestamp;
  active: boolean;
  createdAt: Timestamp;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export type TaskStatus = "open" | "done";
export type TaskCostFrequency = "once" | "monthly" | "yearly";

export interface Task {
  id: string;
  title: string;
  note?: string;
  endDate: Timestamp;
  status: TaskStatus;
  transactionIds: string[];
  costFrequency: TaskCostFrequency;
  createdAt: Timestamp;
}

/** Simulation-only category row (never written to real categories). */
export interface SimulationWhatIfCategory {
  id: string;
  name: string;
  type: TransactionType;
}

/** One playground sheet per book (doc id = "main"). */
export interface Simulation {
  amounts: Record<string, number>;
  whatIfCategories: SimulationWhatIfCategory[];
  whatIfAmounts: Record<string, number>;
  updatedAt?: Timestamp;
}

export type DebtStatus = "open" | "paid";

/** Real obligation: bank loan, family loan, unpaid bill, etc. */
export interface Debt {
  id: string;
  name: string;
  balance: number;
  /** 0 = no fixed monthly obligation */
  monthlyPayment: number;
  /** User forces this debt into snowball phase 1 */
  forcePhase1: boolean;
  /** Linked auto-managed recurring (expense), if monthlyPayment > 0 */
  recurringId?: string;
  /** Sample / payment txs (like Task.transactionIds) */
  transactionIds: string[];
  /** Merchants used to auto-recognize future txs (normalized) */
  matchMerchants: string[];
  categoryId?: string;
  note?: string;
  status: DebtStatus;
  createdAt: Timestamp;
}

export interface SnowballOneTimeIncome {
  id: string;
  label: string;
  amount: number;
  /** Apply once when projection month equals this (0 = first month) */
  applyAfterMonths: number;
}

/** Snowball simulator settings (one doc per book). */
export interface SnowballPlan {
  /** Nominal monthly surplus for “play with time” */
  nominalMonthlyIncome: number;
  /** Extra monthly cash when nominal is unset (or unused if nominal > 0) */
  monthlyExtra: number;
  oneTimeIncomes: SnowballOneTimeIncome[];
  /** Emergency fund size in months of income; default 3 */
  emergencyFundMonths: number;
  /** Monthly income base for EF target */
  monthlyIncomeForFund: number;
  updatedAt?: Timestamp;
}

export type MaxSyncStatus = "ok" | "error" | "running";

export interface MaxSyncSettings {
  bookId: string;
  lastSyncAt?: Timestamp;
  lastSyncStatus?: MaxSyncStatus;
  lastSyncError?: string;
  lastSyncCount?: number;
}

export interface AlertSettings {
  emailEnabled: boolean;
  alertEmail?: string;
  thresholds: number[];
  /** When false, skip setup/weekly/mismatch guide emails. Default true. */
  guideEmailEnabled?: boolean;
}

export interface UserSettings {
  defaultBookId: string;
  currency: string;
  createdAt: Timestamp;
  maxSync?: MaxSyncSettings;
  alertSettings?: AlertSettings;
  /** Preferred UI/email locale; falls back to client localStorage when unset. */
  locale?: "en" | "he";
}

/** Persisted guide preferences that cannot be derived from finance data. */
export interface GuideState {
  categoriesReviewedAt?: Timestamp;
  /** Guide item id → snooze-until timestamp */
  snoozedUntil?: Record<string, Timestamp>;
  updatedAt?: Timestamp;
}

export type GuideItemId =
  | "setup_categories"
  | "setup_import"
  | "setup_recurring"
  | "setup_budget_current"
  | "setup_budget_next"
  | "habit_weekly_activity"
  | "habit_budget_current"
  | "habit_budget_next"
  | "habit_budget_mismatch"
  | "habit_overdue_tasks";

export type GuideNavHref = "/categories" | "/import" | "/recurring" | "/tasks" | "/";

export interface GuideItem {
  id: GuideItemId;
  kind: "setup" | "habit";
  href: GuideNavHref;
  severity: "info" | "warning";
  /** Number of mismatch categories or overdue tasks when relevant */
  count?: number;
  categoryIds?: string[];
}

export interface AlertStateDoc {
  lastThresholdSent: number;
  sentAt: Timestamp;
}

export interface CsvRow {
  date: string;
  merchant: string;
  amount: string;
  rawRow: Record<string, string>;
}

export interface ImportRow {
  id: string;
  date: Date;
  merchantDisplay: string;
  merchantNormalized: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  suggestedCategoryId?: string;
  bookId: string;
  skip: boolean;
  /** True when this row matches an existing transaction in the book. */
  isDuplicate?: boolean;
  /** Fingerprint written to Transaction.sourceKey on import. */
  sourceKey?: string;
  tags: string[];
  /** Tag display names to resolve to IDs (e.g. card last-4) before review. */
  pendingTagNames?: string[];
  imported?: boolean;
}
