import { Category } from "./types";

type SeedCategory = Omit<Category, "id">;

export const DEFAULT_EXPENSE_CATEGORIES: SeedCategory[] = [
  { name: "שכירות",            nameEn: "Rent",               type: "expense", icon: "🏠", color: "#3b82f6", pinned: true,  order: 0 },
  { name: "מזון",              nameEn: "Food",               type: "expense", icon: "🛒", color: "#22c55e", pinned: true,  order: 1 },
  { name: "תחבורה",            nameEn: "Transportation",     type: "expense", icon: "🚗", color: "#8b5cf6", pinned: true,  order: 2 },
  { name: "בריאות",            nameEn: "Health",             type: "expense", icon: "❤️", color: "#ef4444", pinned: true,  order: 3 },
  { name: "חשמל",              nameEn: "Electricity",        type: "expense", icon: "⚡", color: "#f59e0b", pinned: false, order: 4 },
  { name: "מים",               nameEn: "Water",              type: "expense", icon: "💧", color: "#38bdf8", pinned: false, order: 5 },
  { name: "גז",                nameEn: "Gas",                type: "expense", icon: "🔥", color: "#fb923c", pinned: false, order: 6 },
  { name: "ארנונה",            nameEn: "Property Tax",       type: "expense", icon: "🏛️", color: "#64748b", pinned: false, order: 7 },
  { name: "ועד בית",           nameEn: "Building Committee", type: "expense", icon: "🏢", color: "#6b7280", pinned: false, order: 8 },
  { name: "בר מים",            nameEn: "Water Dispenser",    type: "expense", icon: "🚰", color: "#0ea5e9", pinned: false, order: 9 },
  { name: "חו״ל",              nameEn: "Travel / Abroad",    type: "expense", icon: "✈️", color: "#06b6d4", pinned: false, order: 10 },
  { name: "מנויים בטלפון",     nameEn: "Phone Subscriptions",type: "expense", icon: "📱", color: "#a78bfa", pinned: false, order: 11 },
  { name: "טלוויזיה ומנויים",  nameEn: "TV & Subscriptions", type: "expense", icon: "📺", color: "#818cf8", pinned: false, order: 12 },
  { name: "פארמה",             nameEn: "Pharmacy",           type: "expense", icon: "💊", color: "#f43f5e", pinned: false, order: 13 },
  { name: "ספורט",             nameEn: "Sports",             type: "expense", icon: "🏋️", color: "#10b981", pinned: false, order: 14 },
  { name: "בילוי",             nameEn: "Entertainment",      type: "expense", icon: "🎬", color: "#a855f7", pinned: false, order: 15 },
  { name: "ביגוד והנעלה",      nameEn: "Clothing & Footwear",type: "expense", icon: "👕", color: "#ec4899", pinned: false, order: 16 },
  { name: "תכולת בית",         nameEn: "Home Contents",      type: "expense", icon: "🛋️", color: "#d97706", pinned: false, order: 17 },
  { name: "אחזקת בית",         nameEn: "Home Maintenance",   type: "expense", icon: "🔧", color: "#78716c", pinned: false, order: 18 },
  { name: "חינוך",             nameEn: "Education",          type: "expense", icon: "📚", color: "#0d9488", pinned: false, order: 19 },
  { name: "תרומות",            nameEn: "Donations",          type: "expense", icon: "🤝", color: "#84cc16", pinned: false, order: 20 },
  { name: "אירועים",           nameEn: "Events",             type: "expense", icon: "🎉", color: "#f472b6", pinned: false, order: 21 },
  { name: "ביטוחים",           nameEn: "Insurance",          type: "expense", icon: "🛡️", color: "#475569", pinned: false, order: 22 },
  { name: "חובות",             nameEn: "Debts",              type: "expense", icon: "💳", color: "#dc2626", pinned: false, order: 23 },
  { name: "פיננסים",           nameEn: "Finance",            type: "expense", icon: "📊", color: "#2563eb", pinned: false, order: 24 },
  { name: "עישון",             nameEn: "Smoking",            type: "expense", icon: "🚬", color: "#57534e", pinned: false, order: 25 },
  { name: "בייביסיטר",         nameEn: "Babysitter",         type: "expense", icon: "👶", color: "#fb7185", pinned: false, order: 26 },
  { name: "אחר",               nameEn: "Other",              type: "expense", icon: "📦", color: "#6b7280", pinned: false, order: 27 },
];

export const DEFAULT_INCOME_CATEGORIES: SeedCategory[] = [
  { name: "משכורת", nameEn: "Salary",      type: "income", icon: "💼", color: "#22c55e", pinned: true,  order: 0 },
  { name: "פרילנס", nameEn: "Freelance",   type: "income", icon: "💻", color: "#3b82f6", pinned: false, order: 1 },
  { name: "השקעות", nameEn: "Investments", type: "income", icon: "📈", color: "#f59e0b", pinned: false, order: 2 },
  { name: "אחר",    nameEn: "Other",       type: "income", icon: "💰", color: "#6b7280", pinned: false, order: 3 },
];
