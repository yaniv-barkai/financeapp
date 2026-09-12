export type Locale = "en" | "he";

export interface Translations {
  // Navigation
  nav_dashboard: string;
  nav_transactions: string;
  nav_import_csv: string;
  nav_categories: string;
  budget_summary_income: string;
  budget_summary_expenses: string;
  budget_summary_net: string;
  budget_summary_subtitle: string;
  budget_all_categories: string;
  nav_recurring: string;
  nav_tasks: string;
  nav_settings: string;
  nav_admin: string;
  nav_sign_out: string;
  nav_search_placeholder: string;
  nav_brand: string;

  // Global search
  search_placeholder: string;
  search_no_results: string;
  search_group_heading: string;

  // Book switcher
  book_active: string;
  book_new: string;
  book_name: string;
  book_color: string;
  book_name_placeholder: string;
  book_cancel: string;
  book_creating: string;
  book_create: string;

  // Month switcher
  month_today: string;

  // Dashboard
  dashboard_title: string;
  dashboard_delete_confirm: string;
  dashboard_income: string;
  dashboard_expenses: string;
  dashboard_net: string;
  dashboard_monthly_limits: string;
  dashboard_expenses_by_category: string;
  dashboard_income_by_category: string;
  dashboard_income_vs_expenses: string;
  dashboard_income_legend: string;
  dashboard_expense_legend: string;
  dashboard_top_merchants: string;
  dashboard_recent_transactions: string;
  dashboard_no_transactions: string;
  dashboard_edit_transaction: string;
  dashboard_no_category_transactions: string;
  dashboard_income_wrong_category: string;
  dashboard_income_missing_category: string;
  dashboard_budget_over: string;
  dashboard_budget_left: string;
  dashboard_budget_rollover: string;

  // Transactions page
  transactions_title: string;
  transactions_last_updated: string;
  transactions_last_updated_never: string;
  transactions_search_placeholder: string;
  transactions_all_types: string;
  transactions_expense: string;
  transactions_income: string;
  transactions_all_categories: string;
  transactions_all_tags: string;
  transactions_clear: string;
  transactions_no_results: string;
  transactions_edit: string;
  transactions_move_to_book: string;
  transactions_delete: string;
  transactions_edit_dialog_title: string;
  transactions_move_dialog_title: string;
  transactions_select_book: string;
  transactions_cancel: string;
  transactions_moving: string;
  transactions_move: string;
  transactions_delete_confirm: string;
  transactions_convert_to_recurring: string;
  transactions_recurring_dialog_title: string;
  transactions_recurring_cadence: string;
  transactions_recurring_converting: string;
  transactions_recurring_convert: string;

  // Categories page
  categories_title: string;
  categories_expenses_tab: string;
  categories_income_tab: string;
  categories_add_expense: string;
  categories_add_income: string;
  categories_no_categories: string;
  categories_limit_prefix: string;
  categories_limit_per_month: string;
  categories_unpin: string;
  categories_pin: string;
  categories_limit: string;
  categories_edit_title: string;
  categories_new_expense_title: string;
  categories_new_income_title: string;
  categories_name: string;
  categories_icon: string;
  categories_color: string;
  categories_name_placeholder: string;
  categories_cancel: string;
  categories_saving: string;
  categories_save: string;
  categories_create: string;
  categories_limit_dialog_prefix: string;
  categories_limit_input_label: string;
  categories_limit_placeholder: string;
  categories_limit_hint: string;
  categories_limit_period: string;
  categories_limit_period_monthly: string;
  categories_limit_period_yearly: string;
  categories_limit_yearly_equiv: string;
  categories_limit_per_year: string;
  categories_delete_confirm: string;
  categories_name_en: string;
  categories_name_en_placeholder: string;
  categories_translate: string;
  categories_translating: string;
  dashboard_budget: string;

  // Monthly budget editor
  monthly_budget_title: string;
  monthly_budget_save: string;
  monthly_budget_saved: string;
  monthly_budget_save_error: string;
  monthly_budget_loading: string;
  monthly_budget_total: string;
  monthly_budget_income: string;
  monthly_budget_left: string;
  monthly_budget_not_set: string;
  monthly_budget_seeded_previous: string;
  monthly_budget_seeded_legacy: string;
  monthly_budget_col_category: string;
  monthly_budget_col_recurring: string;
  monthly_budget_col_prev: string;
  monthly_budget_col_budget: string;
  monthly_budget_spent: string;
  monthly_budget_suggest: string;
  monthly_budget_suggesting: string;
  monthly_budget_suggest_error: string;
  monthly_budget_suggest_title: string;
  monthly_budget_suggest_apply: string;
  monthly_budget_suggest_applied: string;
  monthly_budget_suggest_empty: string;
  monthly_budget_suggest_remove: string;
  monthly_budget_suggest_amount: string;
  monthly_budget_suggest_kept: string;
  monthly_budget_below_recurring: string;
  monthly_budget_tx_count: string;
  monthly_budget_no_transactions: string;

  // Settings page
  settings_title: string;
  settings_preferences: string;
  settings_currency: string;
  settings_language: string;
  settings_books: string;
  settings_books_description: string;
  settings_active: string;
  settings_account: string;
  settings_sign_out: string;
  settings_edit_book_title: string;
  settings_book_name: string;
  settings_book_color: string;
  settings_cancel: string;
  settings_saving: string;
  settings_save: string;
  settings_one_book_required: string;
  settings_delete_book_confirm: string;
  settings_rebuild_memory: string;
  settings_rebuild_memory_desc: string;
  settings_rebuilding: string;
  settings_rebuild_done: string;

  settings_max_title: string;
  settings_max_description: string;
  settings_max_secrets_title: string;
  settings_max_secrets_steps: string;
  settings_max_run_workflow: string;
  settings_max_last_sync: string;
  settings_max_never: string;
  settings_max_status_ok: string;
  settings_max_status_error: string;
  settings_max_status_running: string;
  settings_max_imported: string;
  settings_max_book: string;

  settings_alerts_title: string;
  settings_alerts_description: string;
  settings_alerts_email_enabled: string;
  settings_alerts_email_override: string;
  settings_alerts_email_placeholder: string;
  settings_alerts_saved: string;

  // Login page
  login_title: string;
  login_sign_in_description: string;
  login_email: string;
  login_password: string;
  login_email_placeholder: string;
  login_password_signin_placeholder: string;
  login_signing_in: string;
  login_sign_in: string;
  login_account_blocked: string;
  login_sign_out_blocked: string;
  login_error_invalid_email: string;
  login_error_wrong_password: string;
  login_error_disabled: string;
  login_error_too_many_requests: string;
  login_error_popup_closed: string;
  login_error_generic: string;

  // Admin
  admin_title: string;
  admin_privacy_note: string;
  admin_accounts: string;
  admin_accounts_description: string;
  admin_loading: string;
  admin_empty: string;
  admin_refresh: string;
  admin_create: string;
  admin_create_title: string;
  admin_creating: string;
  admin_created: string;
  admin_create_hint: string;
  admin_email: string;
  admin_email_placeholder: string;
  admin_name: string;
  admin_name_placeholder: string;
  admin_cancel: string;
  admin_you: string;
  admin_status_active: string;
  admin_status_disabled: string;
  admin_status_unprovisioned: string;
  admin_last_login: string;
  admin_never_logged_in: string;
  admin_enable: string;
  admin_disable: string;
  admin_enable_title: string;
  admin_disable_title: string;
  admin_enable_confirm: string;
  admin_disable_confirm: string;
  admin_enabled: string;
  admin_disabled: string;
  admin_reset_password: string;
  admin_reset_ready: string;
  admin_reset_link_title: string;
  admin_reset_link_description: string;
  admin_copy_link: string;
  admin_link_copied: string;
  admin_delete: string;
  admin_delete_title: string;
  admin_delete_confirm: string;
  admin_delete_type_email: string;
  admin_delete_email_mismatch: string;
  admin_deleting: string;
  admin_deleted: string;
  admin_error_generic: string;

  // Import CSV
  import_title: string;
  import_step_upload: string;
  import_step_map: string;
  import_step_review: string;
  import_step_done: string;
  import_upload_title: string;
  import_upload_subtitle: string;
  import_choose_file: string;
  import_map_title: string;
  import_map_detected: string;
  import_date_col: string;
  import_date_format: string;
  import_date_format_auto: string;
  import_date_format_dmy: string;
  import_date_format_mdy: string;
  import_date_format_ymd: string;
  import_merchant_col: string;
  import_none: string;
  import_debit_credit_toggle: string;
  import_debit_col: string;
  import_credit_col: string;
  import_amount_col: string;
  import_negative_expense: string;
  import_back: string;
  import_preview: string;
  import_bulk_assign: string;
  import_all_rows: string;
  import_col_skip: string;
  import_col_date: string;
  import_col_merchant: string;
  import_col_amount: string;
  import_col_category: string;
  import_col_book: string;
  import_col_tags: string;
  import_auto_hint: string;
  import_importing: string;
  import_done_title: string;
  import_another: string;
  import_go_dashboard: string;
  import_desktop_only: string;

  // Recurring page
  recurring_title: string;
  recurring_add: string;
  recurring_no_items: string;
  recurring_next: string;
  recurring_edit_title: string;
  recurring_new_title: string;
  recurring_expense: string;
  recurring_income: string;
  recurring_amount: string;
  recurring_cadence: string;
  recurring_weekly: string;
  recurring_monthly: string;
  recurring_yearly: string;
  recurring_category: string;
  recurring_merchant: string;
  recurring_merchant_placeholder: string;
  recurring_note: string;
  recurring_note_placeholder: string;
  recurring_amount_placeholder: string;
  recurring_active: string;
  recurring_cancel: string;
  recurring_saving: string;
  recurring_save: string;
  recurring_create: string;
  recurring_delete_confirm: string;
  recurring_add_to_transaction: string;
  recurring_added_to_transaction: string;
  recurring_add_to_transaction_error: string;

  // Tasks page
  tasks_title: string;
  tasks_add: string;
  tasks_no_items: string;
  tasks_tab_open: string;
  tasks_tab_done: string;
  tasks_tab_all: string;
  tasks_edit_title: string;
  tasks_new_title: string;
  tasks_title_label: string;
  tasks_title_placeholder: string;
  tasks_note: string;
  tasks_note_placeholder: string;
  tasks_end_date: string;
  tasks_cost_frequency: string;
  tasks_freq_once: string;
  tasks_freq_monthly: string;
  tasks_freq_yearly: string;
  tasks_possible_savings: string;
  tasks_projected_yearly: string;
  tasks_overdue: string;
  tasks_due: string;
  tasks_mark_done: string;
  tasks_mark_open: string;
  tasks_attach_transactions: string;
  tasks_search_transactions: string;
  tasks_no_matching_transactions: string;
  tasks_attached: string;
  tasks_cancel: string;
  tasks_saving: string;
  tasks_save: string;
  tasks_create: string;
  tasks_delete: string;
  tasks_delete_confirm: string;
  tasks_status_open: string;
  tasks_status_done: string;

  // Transaction form
  form_add_title: string;
  form_expense: string;
  form_income: string;
  form_amount: string;
  form_date: string;
  form_category: string;
  form_merchant: string;
  form_merchant_placeholder: string;
  form_note: string;
  form_note_placeholder: string;
  form_tags: string;
  form_tag_placeholder: string;
  form_add_tag: string;
  form_auto_suggested: string;
  form_suggested_prefix: string;
  form_receipt: string;
  form_attach_photo: string;
  form_receipt_attached: string;
  form_cancel: string;
  form_saving: string;
  form_save_changes: string;
  form_add_transaction: string;

  // Category picker
  picker_placeholder: string;
  picker_search: string;
  picker_no_category: string;
  picker_pinned: string;
  picker_all: string;
  picker_create_new: string;
  picker_new_category_title: string;
  picker_name: string;
  picker_icon: string;
  picker_color: string;
  picker_name_placeholder: string;
  picker_cancel: string;
  picker_create: string;

  // QuickAdd FAB
  fab_add_transaction: string;

  // Statistics page
  nav_statistics: string;
  stats_title: string;
  stats_date_from: string;
  stats_date_to: string;
  stats_preset: string;
  stats_preset_this_month: string;
  stats_preset_last_month: string;
  stats_preset_last_3_months: string;
  stats_preset_last_6_months: string;
  stats_preset_this_year: string;
  stats_preset_custom: string;
  stats_group_by: string;
  stats_group_none: string;
  stats_group_category: string;
  stats_group_tag: string;
  stats_group_month: string;
  stats_group_merchant: string;
  stats_col_date: string;
  stats_col_merchant: string;
  stats_col_category: string;
  stats_col_amount: string;
  stats_col_type: string;
  stats_col_tags: string;
  stats_col_note: string;
  stats_col_count: string;
  stats_col_income: string;
  stats_col_expenses: string;
  stats_col_net: string;
  stats_col_name: string;
  stats_col_month: string;
  stats_summary_income: string;
  stats_summary_expenses: string;
  stats_summary_net: string;
  stats_summary_transactions: string;
  stats_no_results: string;
  stats_loading: string;

  // Tags management
  tags_tab: string;
  tags_title: string;
  tags_add: string;
  tags_no_tags: string;
  tags_name: string;
  tags_name_placeholder: string;
  tags_color: string;
  tags_create_title: string;
  tags_edit_title: string;
  tags_create: string;
  tags_save: string;
  tags_saving: string;
  tags_cancel: string;
  tags_delete_confirm: string;
  tags_stats_spent: string;
  tags_stats_transactions: string;
  tags_stats_empty: string;
  tags_picker_search: string;
  tags_picker_no_results: string;
  tags_picker_create: string;

  // Guide / rhythm
  guide_next_step: string;
  guide_needs_attention: string;
  guide_dismiss_snooze: string;
  guide_bell_title: string;
  guide_bell_empty: string;
  guide_suggested: string;
  guide_looks_good: string;
  guide_looks_good_done: string;
  guide_cta: string;
  guide_setup_categories_title: string;
  guide_setup_categories_reason: string;
  guide_setup_import_title: string;
  guide_setup_import_reason: string;
  guide_setup_recurring_title: string;
  guide_setup_recurring_reason: string;
  guide_setup_budget_current_title: string;
  guide_setup_budget_current_reason: string;
  guide_setup_budget_next_title: string;
  guide_setup_budget_next_reason: string;
  guide_habit_weekly_activity_title: string;
  guide_habit_weekly_activity_reason: string;
  guide_habit_budget_current_title: string;
  guide_habit_budget_current_reason: string;
  guide_habit_budget_next_title: string;
  guide_habit_budget_next_reason: string;
  guide_habit_budget_mismatch_title: string;
  guide_habit_budget_mismatch_reason: string;
  guide_habit_overdue_tasks_title: string;
  guide_habit_overdue_tasks_reason: string;
  guide_banner_import: string;
  guide_banner_budget: string;
  guide_banner_recurring: string;
  settings_alerts_guide_email: string;
}

const en: Translations = {
  nav_dashboard: "Dashboard",
  nav_transactions: "Transactions",
  nav_import_csv: "Import CSV",
  nav_categories: "Budget",
  budget_summary_income: "Monthly Income",
  budget_summary_expenses: "Monthly Expenses",
  budget_summary_net: "Net / Month",
  budget_summary_subtitle: "Based on active recurring items",
  budget_all_categories: "All Categories",
  nav_recurring: "Recurring",
  nav_tasks: "Tasks",
  nav_settings: "Settings",
  nav_admin: "Admin",
  nav_sign_out: "Sign out",
  nav_search_placeholder: "Search…",
  nav_brand: "FinanceApp",

  search_placeholder: "Search transactions…",
  search_no_results: "No transactions found.",
  search_group_heading: "Transactions",

  book_active: "Active",
  book_new: "New Book",
  book_name: "Name",
  book_color: "Color",
  book_name_placeholder: "e.g. Business",
  book_cancel: "Cancel",
  book_creating: "Creating…",
  book_create: "Create",

  month_today: "Today",

  dashboard_title: "Dashboard",
  dashboard_delete_confirm: "Delete this transaction?",
  dashboard_income: "Income",
  dashboard_expenses: "Expenses",
  dashboard_net: "Net",
  dashboard_monthly_limits: "Monthly Budget",
  dashboard_expenses_by_category: "Expenses by Category",
  dashboard_income_by_category: "Income by Category",
  dashboard_income_vs_expenses: "Income vs Expenses (6 months)",
  dashboard_income_legend: "Income",
  dashboard_expense_legend: "Expense",
  dashboard_top_merchants: "Top Merchants",
  dashboard_recent_transactions: "Recent Transactions",
  dashboard_no_transactions: "No transactions this month. Use the + button to add one!",
  dashboard_edit_transaction: "Edit Transaction",
  dashboard_no_category_transactions: "No transactions in this category this month.",
  dashboard_income_wrong_category: "Assigned to expense category",
  dashboard_income_missing_category: "Missing category",
  dashboard_budget_over: "over",
  dashboard_budget_left: "left",
  dashboard_budget_rollover: "carried from last month",

  transactions_title: "Transactions",
  transactions_last_updated: "Last updated",
  transactions_last_updated_never: "Never",
  transactions_search_placeholder: "Search…",
  transactions_all_types: "All types",
  transactions_expense: "Expense",
  transactions_income: "Income",
  transactions_all_categories: "All categories",
  transactions_all_tags: "All tags",
  transactions_clear: "Clear",
  transactions_no_results: "No transactions found.",
  transactions_edit: "Edit",
  transactions_move_to_book: "Move to book…",
  transactions_delete: "Delete",
  transactions_edit_dialog_title: "Edit Transaction",
  transactions_move_dialog_title: "Move to another Book",
  transactions_select_book: "Select book",
  transactions_cancel: "Cancel",
  transactions_moving: "Moving…",
  transactions_move: "Move",
  transactions_delete_confirm: "Delete this transaction?",
  transactions_convert_to_recurring: "Make recurring…",
  transactions_recurring_dialog_title: "Make Recurring",
  transactions_recurring_cadence: "Repeat",
  transactions_recurring_converting: "Converting…",
  transactions_recurring_convert: "Convert",

  categories_title: "Categories",
  categories_expenses_tab: "Expenses",
  categories_income_tab: "Income",
  categories_add_expense: "Add Expense Category",
  categories_add_income: "Add Income Category",
  categories_no_categories: "No categories yet.",
  categories_limit_prefix: "Limit:",
  categories_limit_per_month: "/mo",
  categories_unpin: "Unpin",
  categories_pin: "Pin to top",
  categories_limit: "Limit",
  categories_edit_title: "Edit Category",
  categories_new_expense_title: "New Expense Category",
  categories_new_income_title: "New Income Category",
  categories_name: "Name",
  categories_icon: "Icon (emoji)",
  categories_color: "Color",
  categories_name_placeholder: "e.g. Gym",
  categories_cancel: "Cancel",
  categories_saving: "Saving…",
  categories_save: "Save",
  categories_create: "Create",
  categories_limit_dialog_prefix: "Budget —",
  categories_limit_input_label: "Budget amount",
  categories_limit_placeholder: "e.g. 500",
  categories_limit_hint: "Leave empty to remove the budget.",
  categories_limit_period: "Period",
  categories_limit_period_monthly: "Monthly",
  categories_limit_period_yearly: "Yearly",
  categories_limit_yearly_equiv: "≈ {amount}/mo",
  categories_limit_per_year: "/yr",
  categories_delete_confirm: "Transactions in this category won't be deleted.",
  categories_name_en: "English name",
  categories_name_en_placeholder: "e.g. Gym",
  categories_translate: "Auto-translate",
  categories_translating: "Translating…",
  dashboard_budget: "Monthly Budget",
  monthly_budget_title: "Monthly budget",
  monthly_budget_save: "Save budget",
  monthly_budget_saved: "Monthly budget saved",
  monthly_budget_save_error: "Could not save budget",
  monthly_budget_loading: "Loading budget…",
  monthly_budget_total: "Budgeted",
  monthly_budget_income: "Income",
  monthly_budget_left: "Left",
  monthly_budget_not_set: "Budget not set for this month yet — edit and save",
  monthly_budget_seeded_previous: "Pre-filled from last month — review and save",
  monthly_budget_seeded_legacy: "Pre-filled from your previous limits — review and save",
  monthly_budget_col_category: "Category",
  monthly_budget_col_recurring: "Recurring",
  monthly_budget_col_prev: "Last month",
  monthly_budget_col_budget: "Budget",
  monthly_budget_spent: "Spent",
  monthly_budget_suggest: "Suggest solution",
  monthly_budget_suggesting: "Thinking…",
  monthly_budget_suggest_error: "Could not get AI suggestions",
  monthly_budget_suggest_title: "Suggested reallocation",
  monthly_budget_suggest_apply: "Apply suggestions",
  monthly_budget_suggest_applied: "Suggestions applied — save to keep them",
  monthly_budget_suggest_empty: "No moves needed — gaps look covered.",
  monthly_budget_suggest_remove: "Remove",
  monthly_budget_suggest_amount: "New budget",
  monthly_budget_suggest_kept: "{count} changes ready to apply",
  monthly_budget_below_recurring: "Below recurring — raise budget to cover fixed costs",
  monthly_budget_tx_count: "{count} transactions",
  monthly_budget_no_transactions: "No transactions in this category this month.",

  settings_title: "Settings",
  settings_preferences: "Preferences",
  settings_currency: "Currency",
  settings_language: "Language",
  settings_books: "Books",
  settings_books_description: "Manage your financial books (e.g. Personal, Business).",
  settings_active: "Active",
  settings_account: "Account",
  settings_sign_out: "Sign out",
  settings_edit_book_title: "Edit Book",
  settings_book_name: "Name",
  settings_book_color: "Color",
  settings_cancel: "Cancel",
  settings_saving: "Saving…",
  settings_save: "Save",
  settings_one_book_required: "You must keep at least one book.",
  settings_delete_book_confirm: "All transactions inside will be lost.",
  settings_rebuild_memory: "Rebuild Merchant Memory",
  settings_rebuild_memory_desc: "Re-scan all transactions and rebuild auto-category suggestions from your history. Use this if suggestions stopped working after adding transactions.",
  settings_rebuilding: "Rebuilding…",
  settings_rebuild_done: "Rebuilt {n} merchant categories",

  settings_max_title: "MAX Credit Card Sync",
  settings_max_description: "Transactions are imported daily via GitHub Actions. Store MAX credentials in your repo Secrets — never in this app.",
  settings_max_secrets_title: "One-time setup",
  settings_max_secrets_steps: "In GitHub: Settings → Secrets and variables → Actions. Add MAX_USERNAME, MAX_PASSWORD, FIREBASE_SERVICE_ACCOUNT_KEY, OPENAI_API_KEY, SYNC_USER_UID, and SYNC_BOOK_ID.",
  settings_max_run_workflow: "Run sync manually",
  settings_max_last_sync: "Last sync",
  settings_max_never: "Never",
  settings_max_status_ok: "Success",
  settings_max_status_error: "Failed",
  settings_max_status_running: "Running…",
  settings_max_imported: "{n} transactions imported",
  settings_max_book: "Target book",

  settings_alerts_title: "Budget email alerts",
  settings_alerts_description: "Get an email when any category reaches 80% or 100% of its monthly budget.",
  settings_alerts_email_enabled: "Enable email alerts",
  settings_alerts_email_override: "Alert email (optional)",
  settings_alerts_email_placeholder: "Defaults to your login email",
  settings_alerts_saved: "Alert settings saved",

  login_title: "FinanceApp",
  login_sign_in_description: "Sign in to your account",
  login_email: "Email",
  login_password: "Password",
  login_email_placeholder: "you@example.com",
  login_password_signin_placeholder: "••••••••",
  login_signing_in: "Signing in…",
  login_sign_in: "Sign in",
  login_account_blocked:
    "This account is not provisioned or has been disabled. Contact the admin.",
  login_sign_out_blocked: "Sign out",
  login_error_invalid_email: "Invalid email address.",
  login_error_wrong_password: "Incorrect email or password.",
  login_error_disabled: "This account has been disabled.",
  login_error_too_many_requests: "Too many attempts — please try again later.",
  login_error_popup_closed: "Sign-in popup was closed. Please try again.",
  login_error_generic: "Something went wrong. Please try again.",

  admin_title: "Account management",
  admin_privacy_note:
    "Admins can create and manage accounts, but cannot view another account’s financial data (transactions, budgets, books, or merchants).",
  admin_accounts: "Accounts",
  admin_accounts_description: "Email, name, status, and last login only.",
  admin_loading: "Loading…",
  admin_empty: "No accounts found.",
  admin_refresh: "Refresh",
  admin_create: "Create account",
  admin_create_title: "Create account",
  admin_creating: "Creating…",
  admin_created: "Account created",
  admin_create_hint: "A one-time password reset link will be shown so they can set their password.",
  admin_email: "Email",
  admin_email_placeholder: "user@example.com",
  admin_name: "Name",
  admin_name_placeholder: "Optional display name",
  admin_cancel: "Cancel",
  admin_you: "you",
  admin_status_active: "Active",
  admin_status_disabled: "Disabled",
  admin_status_unprovisioned: "Unprovisioned",
  admin_last_login: "Last login",
  admin_never_logged_in: "Never signed in",
  admin_enable: "Enable",
  admin_disable: "Disable",
  admin_enable_title: "Enable account",
  admin_disable_title: "Disable account",
  admin_enable_confirm: "Enable {email}?",
  admin_disable_confirm: "Disable {email}? They will not be able to sign in or access their data.",
  admin_enabled: "Account enabled",
  admin_disabled: "Account disabled",
  admin_reset_password: "Reset password",
  admin_reset_ready: "Password reset link ready",
  admin_reset_link_title: "Password reset link",
  admin_reset_link_description:
    "Copy and send this link privately. It is shown once and is not stored.",
  admin_copy_link: "Copy link",
  admin_link_copied: "Link copied",
  admin_delete: "Delete",
  admin_delete_title: "Delete account",
  admin_delete_confirm:
    "Permanently delete {email} and all of their finance data? This cannot be undone.",
  admin_delete_type_email: "Type the account email to confirm",
  admin_delete_email_mismatch: "Email does not match",
  admin_deleting: "Deleting…",
  admin_deleted: "Account deleted",
  admin_error_generic: "Something went wrong",

  import_title: "Import CSV",
  import_step_upload: "upload",
  import_step_map: "map",
  import_step_review: "review",
  import_step_done: "done",
  import_upload_title: "Upload a CSV file",
  import_upload_subtitle: "Exported from your bank, credit card, or other app.",
  import_choose_file: "Choose file",
  import_map_title: "Map Columns",
  import_map_detected: "We detected {n} columns. Match them to the right fields.",
  import_date_col: "Date column *",
  import_date_format: "Date format",
  import_date_format_auto: "Auto-detect",
  import_date_format_dmy: "DD/MM/YYYY (e.g. 01-02-2026)",
  import_date_format_mdy: "MM/DD/YYYY (e.g. 02-01-2026)",
  import_date_format_ymd: "YYYY-MM-DD (e.g. 2026-02-01)",
  import_merchant_col: "Merchant / Description *",
  import_none: "-- none --",
  import_debit_credit_toggle: "Separate Debit / Credit columns",
  import_debit_col: "Debit (charges)",
  import_credit_col: "Credit (deposits)",
  import_amount_col: "Amount column *",
  import_negative_expense: "Negative = Expense",
  import_back: "Back",
  import_preview: "Preview rows",
  import_bulk_assign: "Bulk assign:",
  import_all_rows: "All rows…",
  import_col_skip: "Skip",
  import_col_date: "Date",
  import_col_merchant: "Merchant",
  import_col_amount: "Amount",
  import_col_category: "Category",
  import_col_book: "Book",
  import_col_tags: "Tags",
  import_auto_hint: "✦ = auto-categorized from merchant history",
  import_importing: "Importing…",
  import_done_title: "Import complete!",
  import_another: "Import another file",
  import_go_dashboard: "Go to Dashboard",
  import_desktop_only: "CSV import is available on desktop only. Open this page on a computer to import transactions.",

  recurring_title: "Recurring",
  recurring_add: "Add Recurring",
  recurring_no_items: "No recurring transactions yet.",
  recurring_next: "Next:",
  recurring_edit_title: "Edit Recurring",
  recurring_new_title: "New Recurring Transaction",
  recurring_expense: "Expense",
  recurring_income: "Income",
  recurring_amount: "Amount",
  recurring_cadence: "Cadence",
  recurring_weekly: "Weekly",
  recurring_monthly: "Monthly",
  recurring_yearly: "Yearly",
  recurring_category: "Category",
  recurring_merchant: "Merchant / Description",
  recurring_merchant_placeholder: "e.g. Netflix",
  recurring_note: "Note",
  recurring_note_placeholder: "Optional note",
  recurring_amount_placeholder: "0.00",
  recurring_active: "Active",
  recurring_cancel: "Cancel",
  recurring_saving: "Saving…",
  recurring_save: "Save",
  recurring_create: "Create",
  recurring_delete_confirm: "Delete this recurring item?",
  recurring_add_to_transaction: "Add to transactions",
  recurring_added_to_transaction: "Added to this month's transactions",
  recurring_add_to_transaction_error: "Could not add transaction",

  tasks_title: "Tasks",
  tasks_add: "Add Task",
  tasks_no_items: "No tasks yet.",
  tasks_tab_open: "Open",
  tasks_tab_done: "Done",
  tasks_tab_all: "All",
  tasks_edit_title: "Edit Task",
  tasks_new_title: "New Task",
  tasks_title_label: "Title",
  tasks_title_placeholder: "e.g. Move CC to another bank",
  tasks_note: "Note",
  tasks_note_placeholder: "Optional note",
  tasks_end_date: "End date",
  tasks_cost_frequency: "Cost frequency",
  tasks_freq_once: "One-time",
  tasks_freq_monthly: "Monthly",
  tasks_freq_yearly: "Yearly",
  tasks_possible_savings: "Possible savings",
  tasks_projected_yearly: "/yr",
  tasks_overdue: "Overdue",
  tasks_due: "Due",
  tasks_mark_done: "Mark done",
  tasks_mark_open: "Reopen",
  tasks_attach_transactions: "Attach transactions",
  tasks_search_transactions: "Search merchant or note…",
  tasks_no_matching_transactions: "No matching transactions.",
  tasks_attached: "Attached",
  tasks_cancel: "Cancel",
  tasks_saving: "Saving…",
  tasks_save: "Save",
  tasks_create: "Create",
  tasks_delete: "Delete",
  tasks_delete_confirm: "Delete this task?",
  tasks_status_open: "Open",
  tasks_status_done: "Done",

  form_add_title: "Add Transaction",
  form_expense: "Expense",
  form_income: "Income",
  form_amount: "Amount",
  form_date: "Date",
  form_category: "Category",
  form_merchant: "Merchant / Description",
  form_merchant_placeholder: "e.g. Trader Joe's",
  form_note: "Note",
  form_note_placeholder: "Optional note…",
  form_tags: "Tags",
  form_tag_placeholder: "Add tag…",
  form_add_tag: "Add",
  form_auto_suggested: "Auto-suggested from merchant history",
  form_suggested_prefix: "Suggested:",
  form_receipt: "Receipt",
  form_attach_photo: "Attach photo",
  form_receipt_attached: "Receipt already attached",
  form_cancel: "Cancel",
  form_saving: "Saving…",
  form_save_changes: "Save changes",
  form_add_transaction: "Add transaction",

  picker_placeholder: "Select category…",
  picker_search: "Search categories…",
  picker_no_category: "No category found.",
  picker_pinned: "Pinned",
  picker_all: "All",
  picker_create_new: "Create new category",
  picker_new_category_title: "New Category",
  picker_name: "Name",
  picker_icon: "Icon",
  picker_color: "Color",
  picker_name_placeholder: "e.g. Gym",
  picker_cancel: "Cancel",
  picker_create: "Create",

  fab_add_transaction: "Add transaction",

  tags_tab: "Tags",
  tags_title: "Tags",
  tags_add: "New Tag",
  tags_no_tags: "No tags yet. Create one to label your expenses.",
  tags_name: "Name",
  tags_name_placeholder: "e.g. Greece Trip",
  tags_color: "Color",
  tags_create_title: "New Tag",
  tags_edit_title: "Edit Tag",
  tags_create: "Create",
  tags_save: "Save",
  tags_saving: "Saving…",
  tags_cancel: "Cancel",
  tags_delete_confirm: "Transactions tagged with this won't be deleted.",
  tags_stats_spent: "Total spent",
  tags_stats_transactions: "transactions",
  tags_stats_empty: "No spending yet this month.",
  tags_picker_search: "Search or create tag…",
  tags_picker_no_results: "No tags found.",
  tags_picker_create: "Create",

  nav_statistics: "Statistics",
  stats_title: "Statistics",
  stats_date_from: "From",
  stats_date_to: "To",
  stats_preset: "Preset",
  stats_preset_this_month: "This month",
  stats_preset_last_month: "Last month",
  stats_preset_last_3_months: "Last 3 months",
  stats_preset_last_6_months: "Last 6 months",
  stats_preset_this_year: "This year",
  stats_preset_custom: "Custom",
  stats_group_by: "Group by",
  stats_group_none: "No grouping",
  stats_group_category: "Category",
  stats_group_tag: "Tag",
  stats_group_month: "Month",
  stats_group_merchant: "Merchant",
  stats_col_date: "Date",
  stats_col_merchant: "Merchant",
  stats_col_category: "Category",
  stats_col_amount: "Amount",
  stats_col_type: "Type",
  stats_col_tags: "Tags",
  stats_col_note: "Note",
  stats_col_count: "Transactions",
  stats_col_income: "Income",
  stats_col_expenses: "Expenses",
  stats_col_net: "Net",
  stats_col_name: "Name",
  stats_col_month: "Month",
  stats_summary_income: "Total Income",
  stats_summary_expenses: "Total Expenses",
  stats_summary_net: "Net",
  stats_summary_transactions: "Transactions",
  stats_no_results: "No transactions found for the selected filters.",
  stats_loading: "Loading…",

  guide_next_step: "Next step",
  guide_needs_attention: "Needs attention",
  guide_dismiss_snooze: "Remind me in a week",
  guide_bell_title: "Your finance rhythm",
  guide_bell_empty: "You're on track — nothing waiting.",
  guide_suggested: "Suggested",
  guide_looks_good: "Looks good",
  guide_looks_good_done: "Categories confirmed",
  guide_cta: "Go",
  guide_setup_categories_title: "Review your categories",
  guide_setup_categories_reason: "Confirm or tweak the default categories so budgets match how you spend.",
  guide_setup_import_title: "Import 3 months of history",
  guide_setup_import_reason: "A few months of transactions make budgets and patterns reliable.",
  guide_setup_recurring_title: "Add recurring expenses",
  guide_setup_recurring_reason: "Rent, subscriptions, and other fixed costs should be listed here.",
  guide_setup_budget_current_title: "Set this month's budget",
  guide_setup_budget_current_reason: "Save positive amounts for the current month so the dashboard can guide you.",
  guide_setup_budget_next_title: "Set next month's budget",
  guide_setup_budget_next_reason: "Plan next month before it starts — especially when spending already drifted.",
  guide_habit_weekly_activity_title: "Log or sync this week",
  guide_habit_weekly_activity_reason: "Keep the books fresh — add expenses or let bank sync run at least weekly.",
  guide_habit_budget_current_title: "Set this month's budget",
  guide_habit_budget_current_reason: "This month has no saved budget yet.",
  guide_habit_budget_next_title: "Set next month's budget",
  guide_habit_budget_next_reason: "Month-end is close and next month's budget is still empty.",
  guide_habit_budget_mismatch_title: "Update budgets that drifted",
  guide_habit_budget_mismatch_reason: "{count} categories are over budget or below recurring costs.",
  guide_habit_overdue_tasks_title: "Overdue savings tasks",
  guide_habit_overdue_tasks_reason: "You have {count} open tasks past their due date.",
  guide_banner_import: "Import enough history so at least 3 months have transactions.",
  guide_banner_budget: "Save this month's budget (and next month near month-end).",
  guide_banner_recurring: "Add at least one active recurring expense.",
  settings_alerts_guide_email: "Also email setup and weekly reminders",
};

const he: Translations = {
  nav_dashboard: "לוח בקרה",
  nav_transactions: "עסקאות",
  nav_import_csv: "ייבוא CSV",
  nav_categories: "תקציב",
  budget_summary_income: "הכנסה חודשית",
  budget_summary_expenses: "הוצאה חודשית",
  budget_summary_net: "נטו / חודש",
  budget_summary_subtitle: "לפי תשלומים קבועים פעילים",
  budget_all_categories: "כל הקטגוריות",
  nav_recurring: "תשלומים קבועים",
  nav_tasks: "משימות",
  nav_settings: "הגדרות",
  nav_admin: "ניהול",
  nav_sign_out: "התנתק",
  nav_search_placeholder: "חיפוש…",
  nav_brand: "FinanceApp",

  search_placeholder: "חפש עסקאות…",
  search_no_results: "לא נמצאו עסקאות.",
  search_group_heading: "עסקאות",

  book_active: "פעיל",
  book_new: "ספר חדש",
  book_name: "שם",
  book_color: "צבע",
  book_name_placeholder: "לדוגמה: עסקים",
  book_cancel: "ביטול",
  book_creating: "יוצר…",
  book_create: "צור",

  month_today: "היום",

  dashboard_title: "לוח בקרה",
  dashboard_delete_confirm: "למחוק עסקה זו?",
  dashboard_income: "הכנסות",
  dashboard_expenses: "הוצאות",
  dashboard_net: "נטו",
  dashboard_monthly_limits: "תקציב חודשי",
  dashboard_expenses_by_category: "הוצאות לפי קטגוריה",
  dashboard_income_by_category: "הכנסות לפי קטגוריה",
  dashboard_income_vs_expenses: "הכנסות מול הוצאות (6 חודשים)",
  dashboard_income_legend: "הכנסות",
  dashboard_expense_legend: "הוצאות",
  dashboard_top_merchants: "ספקים מובילים",
  dashboard_recent_transactions: "עסקאות אחרונות",
  dashboard_no_transactions: "אין עסקאות החודש. לחץ על + כדי להוסיף!",
  dashboard_edit_transaction: "עריכת עסקה",
  dashboard_no_category_transactions: "אין עסקאות בקטגוריה זו החודש.",
  dashboard_income_wrong_category: "משויך לקטגוריית הוצאה",
  dashboard_income_missing_category: "קטגוריה חסרה",
  dashboard_budget_over: "חריגה",
  dashboard_budget_left: "נותר",
  dashboard_budget_rollover: "הועבר מהחודש הקודם",

  transactions_title: "עסקאות",
  transactions_last_updated: "עודכן לאחרונה",
  transactions_last_updated_never: "מעולם לא",
  transactions_search_placeholder: "חיפוש…",
  transactions_all_types: "כל הסוגים",
  transactions_expense: "הוצאה",
  transactions_income: "הכנסה",
  transactions_all_categories: "כל הקטגוריות",
  transactions_all_tags: "כל התגיות",
  transactions_clear: "נקה",
  transactions_no_results: "לא נמצאו עסקאות.",
  transactions_edit: "עריכה",
  transactions_move_to_book: "העבר לספר…",
  transactions_delete: "מחיקה",
  transactions_edit_dialog_title: "עריכת עסקה",
  transactions_move_dialog_title: "העבר לספר אחר",
  transactions_select_book: "בחר ספר",
  transactions_cancel: "ביטול",
  transactions_moving: "מעביר…",
  transactions_move: "העבר",
  transactions_delete_confirm: "למחוק עסקה זו?",
  transactions_convert_to_recurring: "הפוך לתשלום קבוע…",
  transactions_recurring_dialog_title: "הפוך לתשלום קבוע",
  transactions_recurring_cadence: "חזרה",
  transactions_recurring_converting: "ממיר…",
  transactions_recurring_convert: "המר",

  categories_title: "קטגוריות",
  categories_expenses_tab: "הוצאות",
  categories_income_tab: "הכנסות",
  categories_add_expense: "הוסף קטגוריית הוצאה",
  categories_add_income: "הוסף קטגוריית הכנסה",
  categories_no_categories: "אין קטגוריות עדיין.",
  categories_limit_prefix: "מגבלה:",
  categories_limit_per_month: "/חודש",
  categories_unpin: "בטל נעיצה",
  categories_pin: "נעץ לראש",
  categories_limit: "מגבלה",
  categories_edit_title: "עריכת קטגוריה",
  categories_new_expense_title: "קטגוריית הוצאה חדשה",
  categories_new_income_title: "קטגוריית הכנסה חדשה",
  categories_name: "שם",
  categories_icon: "אייקון (אמוג׳י)",
  categories_color: "צבע",
  categories_name_placeholder: "לדוגמה: חדר כושר",
  categories_cancel: "ביטול",
  categories_saving: "שומר…",
  categories_save: "שמור",
  categories_create: "צור",
  categories_limit_dialog_prefix: "תקציב —",
  categories_limit_input_label: "סכום תקציב",
  categories_limit_placeholder: "לדוגמה: 500",
  categories_limit_hint: "השאר ריק להסרת התקציב.",
  categories_limit_period: "תקופה",
  categories_limit_period_monthly: "חודשי",
  categories_limit_period_yearly: "שנתי",
  categories_limit_yearly_equiv: "≈ {amount}/חודש",
  categories_limit_per_year: "/שנה",
  categories_delete_confirm: "עסקאות בקטגוריה זו לא יימחקו.",
  categories_name_en: "שם באנגלית",
  categories_name_en_placeholder: "לדוגמה: Gym",
  categories_translate: "תרגם אוטומטית",
  categories_translating: "מתרגם…",
  dashboard_budget: "תקציב חודשי",
  monthly_budget_title: "תקציב חודשי",
  monthly_budget_save: "שמור תקציב",
  monthly_budget_saved: "התקציב החודשי נשמר",
  monthly_budget_save_error: "שמירת התקציב נכשלה",
  monthly_budget_loading: "טוען תקציב…",
  monthly_budget_total: "תוקצב",
  monthly_budget_income: "הכנסה",
  monthly_budget_left: "נותר",
  monthly_budget_not_set: "עדיין לא הוגדר תקציב לחודש זה — ערכו ושמרו",
  monthly_budget_seeded_previous: "מולא לפי החודש הקודם — בדקו ושמרו",
  monthly_budget_seeded_legacy: "מולא לפי המגבלות הקודמות — בדקו ושמרו",
  monthly_budget_col_category: "קטגוריה",
  monthly_budget_col_recurring: "קבוע",
  monthly_budget_col_prev: "חודש קודם",
  monthly_budget_col_budget: "תקציב",
  monthly_budget_spent: "הוצא",
  monthly_budget_suggest: "הצע פתרון",
  monthly_budget_suggesting: "חושב…",
  monthly_budget_suggest_error: "לא ניתן לקבל הצעות AI",
  monthly_budget_suggest_title: "הצעת הקצאה מחדש",
  monthly_budget_suggest_apply: "החל הצעות",
  monthly_budget_suggest_applied: "ההצעות הוחלו — שמרו כדי לשמור אותן",
  monthly_budget_suggest_empty: "אין צורך בהעברה — הפערים נראים מכוסים.",
  monthly_budget_suggest_remove: "הסר",
  monthly_budget_suggest_amount: "תקציב חדש",
  monthly_budget_suggest_kept: "{count} שינויים מוכנים להחלה",
  monthly_budget_below_recurring: "מתחת לקבוע — העלו את התקציב לכיסוי ההוצאות הקבועות",
  monthly_budget_tx_count: "{count} עסקאות",
  monthly_budget_no_transactions: "אין עסקאות בקטגוריה זו בחודש זה.",

  settings_title: "הגדרות",
  settings_preferences: "העדפות",
  settings_currency: "מטבע",
  settings_language: "שפה",
  settings_books: "ספרים",
  settings_books_description: "נהל את ספרי הכספים שלך (לדוגמה: אישי, עסקי).",
  settings_active: "פעיל",
  settings_account: "חשבון",
  settings_sign_out: "התנתק",
  settings_edit_book_title: "עריכת ספר",
  settings_book_name: "שם",
  settings_book_color: "צבע",
  settings_cancel: "ביטול",
  settings_saving: "שומר…",
  settings_save: "שמור",
  settings_one_book_required: "חייב להישאר לפחות ספר אחד.",
  settings_delete_book_confirm: "כל העסקאות בספר זה יאבדו.",
  settings_rebuild_memory: "שחזר זיכרון ספקים",
  settings_rebuild_memory_desc: "סרוק מחדש את כל העסקאות ובנה מחדש את הצעות הקטגוריה האוטומטיות. השתמש בזה אם ההצעות הפסיקו לעבוד.",
  settings_rebuilding: "בונה מחדש…",
  settings_rebuild_done: "שוחזרו {n} ספקים",

  settings_max_title: "סנכרון MAX",
  settings_max_description: "עסקאות מיובאות יומית דרך GitHub Actions. שמור את פרטי MAX ב-Secrets של הריפו — לא באפליקציה.",
  settings_max_secrets_title: "הגדרה חד-פעמית",
  settings_max_secrets_steps: "ב-GitHub: Settings → Secrets and variables → Actions. הוסף MAX_USERNAME, MAX_PASSWORD, FIREBASE_SERVICE_ACCOUNT_KEY, OPENAI_API_KEY, SYNC_USER_UID ו-SYNC_BOOK_ID.",
  settings_max_run_workflow: "הרץ סנכרון ידנית",
  settings_max_last_sync: "סנכרון אחרון",
  settings_max_never: "מעולם לא",
  settings_max_status_ok: "הצליח",
  settings_max_status_error: "נכשל",
  settings_max_status_running: "רץ…",
  settings_max_imported: "{n} עסקאות יובאו",
  settings_max_book: "ספר יעד",

  settings_alerts_title: "התראות תקציב במייל",
  settings_alerts_description: "קבל מייל כשקטגוריה מגיעה ל-80% או 100% מהתקציב החודשי.",
  settings_alerts_email_enabled: "הפעל התראות במייל",
  settings_alerts_email_override: "מייל להתראות (אופציונלי)",
  settings_alerts_email_placeholder: "ברירת מחדל: מייל ההתחברות",
  settings_alerts_saved: "הגדרות ההתראות נשמרו",

  login_title: "FinanceApp",
  login_sign_in_description: "התחבר לחשבונך",
  login_email: "אימייל",
  login_password: "סיסמה",
  login_email_placeholder: "you@example.com",
  login_password_signin_placeholder: "••••••••",
  login_signing_in: "מתחבר…",
  login_sign_in: "התחבר",
  login_account_blocked:
    "החשבון אינו מופעל או שנוטרל. פנה למנהל המערכת.",
  login_sign_out_blocked: "התנתק",
  login_error_invalid_email: "כתובת אימייל לא תקינה.",
  login_error_wrong_password: "אימייל או סיסמה שגויים.",
  login_error_disabled: "החשבון נוטרל.",
  login_error_too_many_requests: "יותר מדי ניסיונות — נסה שוב מאוחר יותר.",
  login_error_popup_closed: "חלון הכניסה נסגר. נסה שוב.",
  login_error_generic: "משהו השתבש. נסה שוב.",

  admin_title: "ניהול חשבונות",
  admin_privacy_note:
    "מנהלים יכולים ליצור ולנהל חשבונות, אך אינם יכולים לצפות במידע הפיננסי של חשבון אחר (עסקאות, תקציבים, ספרים או ספקים).",
  admin_accounts: "חשבונות",
  admin_accounts_description: "אימייל, שם, סטטוס והתחברות אחרונה בלבד.",
  admin_loading: "טוען…",
  admin_empty: "לא נמצאו חשבונות.",
  admin_refresh: "רענן",
  admin_create: "צור חשבון",
  admin_create_title: "יצירת חשבון",
  admin_creating: "יוצר…",
  admin_created: "החשבון נוצר",
  admin_create_hint: "יוצג קישור חד-פעמי לאיפוס סיסמה כדי שהמשתמש יוכל להגדיר סיסמה.",
  admin_email: "אימייל",
  admin_email_placeholder: "user@example.com",
  admin_name: "שם",
  admin_name_placeholder: "שם תצוגה (אופציונלי)",
  admin_cancel: "ביטול",
  admin_you: "אתה",
  admin_status_active: "פעיל",
  admin_status_disabled: "מנוטרל",
  admin_status_unprovisioned: "לא מופעל",
  admin_last_login: "התחברות אחרונה",
  admin_never_logged_in: "מעולם לא התחבר",
  admin_enable: "הפעל",
  admin_disable: "נטרל",
  admin_enable_title: "הפעלת חשבון",
  admin_disable_title: "נטרול חשבון",
  admin_enable_confirm: "להפעיל את {email}?",
  admin_disable_confirm: "לנטרל את {email}? לא יוכל להתחבר או לגשת לנתונים.",
  admin_enabled: "החשבון הופעל",
  admin_disabled: "החשבון נוטרל",
  admin_reset_password: "איפוס סיסמה",
  admin_reset_ready: "קישור לאיפוס סיסמה מוכן",
  admin_reset_link_title: "קישור לאיפוס סיסמה",
  admin_reset_link_description:
    "העתק ושלח את הקישור באופן פרטי. הוא מוצג פעם אחת ואינו נשמר.",
  admin_copy_link: "העתק קישור",
  admin_link_copied: "הקישור הועתק",
  admin_delete: "מחק",
  admin_delete_title: "מחיקת חשבון",
  admin_delete_confirm:
    "למחוק לצמיתות את {email} ואת כל נתוני הכספים שלו? לא ניתן לבטל.",
  admin_delete_type_email: "הקלד את האימייל לאישור",
  admin_delete_email_mismatch: "האימייל אינו תואם",
  admin_deleting: "מוחק…",
  admin_deleted: "החשבון נמחק",
  admin_error_generic: "משהו השתבש",

  import_title: "ייבוא CSV",
  import_step_upload: "העלאה",
  import_step_map: "מיפוי",
  import_step_review: "סקירה",
  import_step_done: "סיום",
  import_upload_title: "העלה קובץ CSV",
  import_upload_subtitle: "מיוצא מהבנק, כרטיס האשראי, או אפליקציה אחרת.",
  import_choose_file: "בחר קובץ",
  import_map_title: "מיפוי עמודות",
  import_map_detected: "זיהינו {n} עמודות. התאם אותן לשדות הנכונים.",
  import_date_col: "עמודת תאריך *",
  import_date_format: "פורמט תאריך",
  import_date_format_auto: "זיהוי אוטומטי",
  import_date_format_dmy: "DD/MM/YYYY (לדוגמה: 01-02-2026)",
  import_date_format_mdy: "MM/DD/YYYY (לדוגמה: 02-01-2026)",
  import_date_format_ymd: "YYYY-MM-DD (לדוגמה: 2026-02-01)",
  import_merchant_col: "ספק / תיאור *",
  import_none: "-- ללא --",
  import_debit_credit_toggle: "עמודות חיוב / זיכוי נפרדות",
  import_debit_col: "חיוב (הוצאות)",
  import_credit_col: "זיכוי (הפקדות)",
  import_amount_col: "עמודת סכום *",
  import_negative_expense: "שלילי = הוצאה",
  import_back: "חזרה",
  import_preview: "תצוגה מקדימה",
  import_bulk_assign: "הקצה לכולם:",
  import_all_rows: "כל השורות…",
  import_col_skip: "דלג",
  import_col_date: "תאריך",
  import_col_merchant: "ספק",
  import_col_amount: "סכום",
  import_col_category: "קטגוריה",
  import_col_book: "ספר",
  import_col_tags: "תגיות",
  import_auto_hint: "✦ = קובץ אוטומטי מהיסטוריית ספקים",
  import_importing: "מייבא…",
  import_done_title: "הייבוא הושלם!",
  import_another: "ייבא קובץ נוסף",
  import_go_dashboard: "עבור ללוח הבקרה",
  import_desktop_only: "ייבוא CSV זמין במחשב בלבד. פתח דף זה במחשב כדי לייבא עסקאות.",

  recurring_title: "תשלומים קבועים",
  recurring_add: "הוסף תשלום קבוע",
  recurring_no_items: "אין תשלומים קבועים עדיין.",
  recurring_next: "הבא:",
  recurring_edit_title: "עריכת תשלום קבוע",
  recurring_new_title: "תשלום קבוע חדש",
  recurring_expense: "הוצאה",
  recurring_income: "הכנסה",
  recurring_amount: "סכום",
  recurring_cadence: "תדירות",
  recurring_weekly: "שבועי",
  recurring_monthly: "חודשי",
  recurring_yearly: "שנתי",
  recurring_category: "קטגוריה",
  recurring_merchant: "ספק / תיאור",
  recurring_merchant_placeholder: "לדוגמה: Netflix",
  recurring_note: "הערה",
  recurring_note_placeholder: "הערה אופציונלית",
  recurring_amount_placeholder: "0.00",
  recurring_active: "פעיל",
  recurring_cancel: "ביטול",
  recurring_saving: "שומר…",
  recurring_save: "שמור",
  recurring_create: "צור",
  recurring_delete_confirm: "למחוק תשלום קבוע זה?",
  recurring_add_to_transaction: "הוסף לעסקאות",
  recurring_added_to_transaction: "נוסף לעסקאות החודש",
  recurring_add_to_transaction_error: "לא ניתן להוסיף עסקה",

  tasks_title: "משימות",
  tasks_add: "הוסף משימה",
  tasks_no_items: "אין משימות עדיין.",
  tasks_tab_open: "פתוחות",
  tasks_tab_done: "בוצעו",
  tasks_tab_all: "הכל",
  tasks_edit_title: "עריכת משימה",
  tasks_new_title: "משימה חדשה",
  tasks_title_label: "כותרת",
  tasks_title_placeholder: "לדוגמה: העברת כרטיס אשראי לבנק אחר",
  tasks_note: "הערה",
  tasks_note_placeholder: "הערה אופציונלית",
  tasks_end_date: "תאריך סיום",
  tasks_cost_frequency: "תדירות עלות",
  tasks_freq_once: "חד־פעמי",
  tasks_freq_monthly: "חודשי",
  tasks_freq_yearly: "שנתי",
  tasks_possible_savings: "חיסכון אפשרי",
  tasks_projected_yearly: "/שנה",
  tasks_overdue: "באיחור",
  tasks_due: "עד",
  tasks_mark_done: "סמן כבוצע",
  tasks_mark_open: "פתח מחדש",
  tasks_attach_transactions: "צרף עסקאות",
  tasks_search_transactions: "חפש ספק או הערה…",
  tasks_no_matching_transactions: "לא נמצאו עסקאות תואמות.",
  tasks_attached: "מצורפות",
  tasks_cancel: "ביטול",
  tasks_saving: "שומר…",
  tasks_save: "שמור",
  tasks_create: "צור",
  tasks_delete: "מחק",
  tasks_delete_confirm: "למחוק משימה זו?",
  tasks_status_open: "פתוחה",
  tasks_status_done: "בוצעה",

  form_add_title: "הוסף עסקה",
  form_expense: "הוצאה",
  form_income: "הכנסה",
  form_amount: "סכום",
  form_date: "תאריך",
  form_category: "קטגוריה",
  form_merchant: "ספק / תיאור",
  form_merchant_placeholder: "לדוגמה: סופרמרקט",
  form_note: "הערה",
  form_note_placeholder: "הערה אופציונלית…",
  form_tags: "תגיות",
  form_tag_placeholder: "הוסף תגית…",
  form_add_tag: "הוסף",
  form_auto_suggested: "הוצע אוטומטית מהיסטוריית ספקים",
  form_suggested_prefix: "מוצע:",
  form_receipt: "קבלה",
  form_attach_photo: "צרף תמונה",
  form_receipt_attached: "קבלה כבר מצורפת",
  form_cancel: "ביטול",
  form_saving: "שומר…",
  form_save_changes: "שמור שינויים",
  form_add_transaction: "הוסף עסקה",

  picker_placeholder: "בחר קטגוריה…",
  picker_search: "חפש קטגוריות…",
  picker_no_category: "לא נמצאה קטגוריה.",
  picker_pinned: "נעוצות",
  picker_all: "הכל",
  picker_create_new: "צור קטגוריה חדשה",
  picker_new_category_title: "קטגוריה חדשה",
  picker_name: "שם",
  picker_icon: "אייקון",
  picker_color: "צבע",
  picker_name_placeholder: "לדוגמה: חדר כושר",
  picker_cancel: "ביטול",
  picker_create: "צור",

  fab_add_transaction: "הוסף עסקה",

  tags_tab: "תגיות",
  tags_title: "תגיות",
  tags_add: "תגית חדשה",
  tags_no_tags: "אין תגיות עדיין. צור תגית לסימון הוצאות.",
  tags_name: "שם",
  tags_name_placeholder: "לדוגמה: טיול ביוון",
  tags_color: "צבע",
  tags_create_title: "תגית חדשה",
  tags_edit_title: "עריכת תגית",
  tags_create: "צור",
  tags_save: "שמור",
  tags_saving: "שומר…",
  tags_cancel: "ביטול",
  tags_delete_confirm: "עסקאות עם תגית זו לא יימחקו.",
  tags_stats_spent: "סה״כ הוצאה",
  tags_stats_transactions: "עסקאות",
  tags_stats_empty: "אין הוצאות החודש.",
  tags_picker_search: "חפש או צור תגית…",
  tags_picker_no_results: "לא נמצאו תגיות.",
  tags_picker_create: "צור",

  nav_statistics: "סטטיסטיקות",
  stats_title: "סטטיסטיקות",
  stats_date_from: "מתאריך",
  stats_date_to: "עד תאריך",
  stats_preset: "תקופה מוגדרת",
  stats_preset_this_month: "החודש",
  stats_preset_last_month: "חודש שעבר",
  stats_preset_last_3_months: "3 חודשים אחרונים",
  stats_preset_last_6_months: "6 חודשים אחרונים",
  stats_preset_this_year: "השנה",
  stats_preset_custom: "מותאם אישית",
  stats_group_by: "קבץ לפי",
  stats_group_none: "ללא קיבוץ",
  stats_group_category: "קטגוריה",
  stats_group_tag: "תגית",
  stats_group_month: "חודש",
  stats_group_merchant: "ספק",
  stats_col_date: "תאריך",
  stats_col_merchant: "ספק",
  stats_col_category: "קטגוריה",
  stats_col_amount: "סכום",
  stats_col_type: "סוג",
  stats_col_tags: "תגיות",
  stats_col_note: "הערה",
  stats_col_count: "עסקאות",
  stats_col_income: "הכנסות",
  stats_col_expenses: "הוצאות",
  stats_col_net: "נטו",
  stats_col_name: "שם",
  stats_col_month: "חודש",
  stats_summary_income: "סה״כ הכנסות",
  stats_summary_expenses: "סה״כ הוצאות",
  stats_summary_net: "נטו",
  stats_summary_transactions: "עסקאות",
  stats_no_results: "לא נמצאו עסקאות לפי הסינון שנבחר.",
  stats_loading: "טוען…",

  guide_next_step: "הצעד הבא",
  guide_needs_attention: "דורש תשומת לב",
  guide_dismiss_snooze: "תזכיר לי בעוד שבוע",
  guide_bell_title: "הקצב הפיננסי שלך",
  guide_bell_empty: "הכול תקין — אין פריטים ממתינים.",
  guide_suggested: "מוצע",
  guide_looks_good: "נראה טוב",
  guide_looks_good_done: "הקטגוריות אושרו",
  guide_cta: "עבור",
  guide_setup_categories_title: "סקור את הקטגוריות",
  guide_setup_categories_reason: "אשר או התאם את ברירת המחדל כדי שהתקציב יתאים להוצאות שלך.",
  guide_setup_import_title: "ייבא 3 חודשי היסטוריה",
  guide_setup_import_reason: "כמה חודשי עסקאות הופכים תקציבים ותובנות לאמינים.",
  guide_setup_recurring_title: "הוסף הוצאות קבועות",
  guide_setup_recurring_reason: "שכירות, מנויים והוצאות קבועות צריכות להופיע כאן.",
  guide_setup_budget_current_title: "הגדר תקציב לחודש הנוכחי",
  guide_setup_budget_current_reason: "שמור סכומים חיוביים לחודש הנוכחי כדי שהלוח יוכל להנחות אותך.",
  guide_setup_budget_next_title: "הגדר תקציב לחודש הבא",
  guide_setup_budget_next_reason: "תכנן את החודש הבא לפני שהוא מתחיל — במיוחד אם היו חריגות.",
  guide_habit_weekly_activity_title: "רשום או סנכרן השבוע",
  guide_habit_weekly_activity_reason: "שמור על הספרים מעודכנים — הוסף הוצאות או הרץ סנכרון לפחות פעם בשבוע.",
  guide_habit_budget_current_title: "הגדר תקציב לחודש הנוכחי",
  guide_habit_budget_current_reason: "לחודש הזה עדיין אין תקציב שמור.",
  guide_habit_budget_next_title: "הגדר תקציב לחודש הבא",
  guide_habit_budget_next_reason: "סוף החודש קרוב ותקציב החודש הבא עדיין ריק.",
  guide_habit_budget_mismatch_title: "עדכן תקציבים שחרגו",
  guide_habit_budget_mismatch_reason: "{count} קטגוריות חורגות מהתקציב או מתחת להוצאות הקבועות.",
  guide_habit_overdue_tasks_title: "משימות חיסכון באיחור",
  guide_habit_overdue_tasks_reason: "יש לך {count} משימות פתוחות שעברו את תאריך היעד.",
  guide_banner_import: "ייבא מספיק היסטוריה כך שלפחות 3 חודשים יכללו עסקאות.",
  guide_banner_budget: "שמור תקציב לחודש הנוכחי (ולחודש הבא לקראת סוף החודש).",
  guide_banner_recurring: "הוסף לפחות הוצאה קבועה פעילה אחת.",
  settings_alerts_guide_email: "שלח גם תזכורות הקמה ושבועיות באימייל",
};

export const translations: Record<Locale, Translations> = { en, he };

// Module-level locale state for use in non-React utility functions
let _locale: Locale = "en";

export function setModuleLocale(locale: Locale) {
  _locale = locale;
}

export function getModuleLocale(): Locale {
  return _locale;
}

export function getIntlLocale(locale: Locale = _locale): string {
  return locale === "he" ? "he-IL" : "en-US";
}
