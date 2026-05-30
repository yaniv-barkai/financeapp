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
  recurringId?: string;
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

export interface UserSettings {
  defaultBookId: string;
  currency: string;
  createdAt: Timestamp;
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
  skip: boolean;
  isDuplicate?: boolean;
}
