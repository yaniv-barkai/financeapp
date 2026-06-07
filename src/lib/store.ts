import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Book, Category, Merchant, Tag } from "./types";

export type DashboardSectionId = "summary" | "budgets" | "recurring" | "transactions";

export const DEFAULT_DASHBOARD_ORDER: DashboardSectionId[] = [
  "summary",
  "budgets",
  "recurring",
  "transactions",
];

interface AppState {
  activeBookId: string | null;
  books: Book[];
  categories: Category[];
  merchants: Merchant[];
  tags: Tag[];
  currency: string;
  activeMonth: string;
  txVersion: number;
  dashboardSectionOrder: DashboardSectionId[];

  setActiveBookId: (id: string | null) => void;
  setBooks: (books: Book[]) => void;
  setCategories: (cats: Category[]) => void;
  setMerchants: (m: Merchant[]) => void;
  setTags: (tags: Tag[]) => void;
  setCurrency: (c: string) => void;
  setActiveMonth: (m: string) => void;
  bumpTxVersion: () => void;
  setDashboardSectionOrder: (order: DashboardSectionId[]) => void;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeBookId: null,
      books: [],
      categories: [],
      merchants: [],
      tags: [],
      currency: "USD",
      activeMonth: currentMonthKey(),
      txVersion: 0,
      dashboardSectionOrder: DEFAULT_DASHBOARD_ORDER,

      setActiveBookId: (id) => set({ activeBookId: id }),
      setBooks: (books) => set({ books }),
      setCategories: (cats) => set({ categories: cats }),
      setMerchants: (m) => set({ merchants: m }),
      setTags: (tags) => set({ tags }),
      setCurrency: (c) => set({ currency: c }),
      setActiveMonth: (m) => set({ activeMonth: m }),
      bumpTxVersion: () => set((s) => ({ txVersion: s.txVersion + 1 })),
      setDashboardSectionOrder: (order) => set({ dashboardSectionOrder: order }),
    }),
    {
      name: "finance-app-store",
      partialize: (state) => ({
        activeBookId: state.activeBookId,
        currency: state.currency,
        activeMonth: state.activeMonth,
        dashboardSectionOrder: state.dashboardSectionOrder,
      }),
    }
  )
);
