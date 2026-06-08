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
  nav_settings: string;
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
  dashboard_recurring_uncheck_confirm: string;
  dashboard_no_category_transactions: string;
  dashboard_income_wrong_category: string;
  dashboard_income_missing_category: string;

  // Transactions page
  transactions_title: string;
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

  // Login page
  login_title: string;
  login_sign_in_description: string;
  login_sign_up_description: string;
  login_google: string;
  login_or: string;
  login_name: string;
  login_email: string;
  login_password: string;
  login_name_placeholder: string;
  login_email_placeholder: string;
  login_password_signup_placeholder: string;
  login_password_signin_placeholder: string;
  login_signing_in: string;
  login_creating: string;
  login_sign_in: string;
  login_create_account: string;
  login_no_account: string;
  login_create_one: string;
  login_have_account: string;
  login_sign_in_link: string;
  login_error_invalid_email: string;
  login_error_wrong_password: string;
  login_error_email_exists: string;
  login_error_weak_password: string;
  login_error_too_many_requests: string;
  login_error_popup_closed: string;
  login_error_generic: string;

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
  nav_settings: "Settings",
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
  dashboard_recurring_uncheck_confirm: "Remove this month's booking for this recurring payment?",
  dashboard_no_category_transactions: "No transactions in this category this month.",
  dashboard_income_wrong_category: "Assigned to expense category",
  dashboard_income_missing_category: "Missing category",

  transactions_title: "Transactions",
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

  login_title: "FinanceApp",
  login_sign_in_description: "Sign in to your account",
  login_sign_up_description: "Create your account",
  login_google: "Continue with Google",
  login_or: "or",
  login_name: "Name",
  login_email: "Email",
  login_password: "Password",
  login_name_placeholder: "Your name",
  login_email_placeholder: "you@example.com",
  login_password_signup_placeholder: "At least 6 characters",
  login_password_signin_placeholder: "••••••••",
  login_signing_in: "Signing in…",
  login_creating: "Creating account…",
  login_sign_in: "Sign in",
  login_create_account: "Create account",
  login_no_account: "No account?",
  login_create_one: "Create one",
  login_have_account: "Already have an account?",
  login_sign_in_link: "Sign in",
  login_error_invalid_email: "Invalid email address.",
  login_error_wrong_password: "Incorrect email or password.",
  login_error_email_exists: "An account with this email already exists.",
  login_error_weak_password: "Password must be at least 6 characters.",
  login_error_too_many_requests: "Too many attempts — please try again later.",
  login_error_popup_closed: "Sign-in popup was closed. Please try again.",
  login_error_generic: "Something went wrong. Please try again.",

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
  nav_settings: "הגדרות",
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
  dashboard_recurring_uncheck_confirm: "להסיר את הרישום החודשי עבור תשלום קבוע זה?",
  dashboard_no_category_transactions: "אין עסקאות בקטגוריה זו החודש.",
  dashboard_income_wrong_category: "משויך לקטגוריית הוצאה",
  dashboard_income_missing_category: "קטגוריה חסרה",

  transactions_title: "עסקאות",
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

  login_title: "FinanceApp",
  login_sign_in_description: "התחבר לחשבונך",
  login_sign_up_description: "צור את חשבונך",
  login_google: "המשך עם Google",
  login_or: "או",
  login_name: "שם",
  login_email: "אימייל",
  login_password: "סיסמה",
  login_name_placeholder: "שמך",
  login_email_placeholder: "you@example.com",
  login_password_signup_placeholder: "לפחות 6 תווים",
  login_password_signin_placeholder: "••••••••",
  login_signing_in: "מתחבר…",
  login_creating: "יוצר חשבון…",
  login_sign_in: "התחבר",
  login_create_account: "צור חשבון",
  login_no_account: "אין חשבון?",
  login_create_one: "צור חשבון",
  login_have_account: "יש לך כבר חשבון?",
  login_sign_in_link: "התחבר",
  login_error_invalid_email: "כתובת אימייל לא תקינה.",
  login_error_wrong_password: "אימייל או סיסמה שגויים.",
  login_error_email_exists: "חשבון עם אימייל זה כבר קיים.",
  login_error_weak_password: "הסיסמה חייבת להכיל לפחות 6 תווים.",
  login_error_too_many_requests: "יותר מדי ניסיונות — נסה שוב מאוחר יותר.",
  login_error_popup_closed: "חלון הכניסה נסגר. נסה שוב.",
  login_error_generic: "משהו השתבש. נסה שוב.",

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
