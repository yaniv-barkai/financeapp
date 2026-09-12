import { GuideItem, GuideItemId } from "@/lib/types";
import { Translations } from "@/lib/i18n";

const TITLE_KEYS: Record<GuideItemId, keyof Translations> = {
  setup_categories: "guide_setup_categories_title",
  setup_import: "guide_setup_import_title",
  setup_recurring: "guide_setup_recurring_title",
  setup_budget_current: "guide_setup_budget_current_title",
  setup_budget_next: "guide_setup_budget_next_title",
  habit_weekly_activity: "guide_habit_weekly_activity_title",
  habit_budget_current: "guide_habit_budget_current_title",
  habit_budget_next: "guide_habit_budget_next_title",
  habit_budget_mismatch: "guide_habit_budget_mismatch_title",
  habit_overdue_tasks: "guide_habit_overdue_tasks_title",
};

const REASON_KEYS: Record<GuideItemId, keyof Translations> = {
  setup_categories: "guide_setup_categories_reason",
  setup_import: "guide_setup_import_reason",
  setup_recurring: "guide_setup_recurring_reason",
  setup_budget_current: "guide_setup_budget_current_reason",
  setup_budget_next: "guide_setup_budget_next_reason",
  habit_weekly_activity: "guide_habit_weekly_activity_reason",
  habit_budget_current: "guide_habit_budget_current_reason",
  habit_budget_next: "guide_habit_budget_next_reason",
  habit_budget_mismatch: "guide_habit_budget_mismatch_reason",
  habit_overdue_tasks: "guide_habit_overdue_tasks_reason",
};

export function guideItemTitle(t: Translations, item: GuideItem): string {
  return String(t[TITLE_KEYS[item.id]]);
}

export function guideItemReason(t: Translations, item: GuideItem): string {
  const raw = String(t[REASON_KEYS[item.id]]);
  return raw.replace("{count}", String(item.count ?? 0));
}
