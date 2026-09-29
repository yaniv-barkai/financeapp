# Release Notes

Newest first. Format: `vMAJOR.MINOR` (two-digit minor). See `.cursor/rules/versioning.mdc`.

## v1.08 — 2026-09-29

- You can now connect AI assistants (Claude Desktop, Cursor, LM Studio and other MCP apps) to your finances. In Settings → "AI assistants (MCP)", create a personal access token and paste the ready-made config snippet into your assistant.
- Assistants can look up your books, categories and transactions, get a monthly summary with budget vs. actual, and see your recurring items, debts with the pay-off plan, and tasks.
- Choose "Read only" or "Read + Write" per token. Write tokens can add transactions, change a transaction's category, note or tags, and create or complete tasks. They can't delete anything. You can revoke a token at any time, and it stops working right away.
- ChatGPT and Claude.ai web connectors need OAuth sign-in, which isn't supported yet. Use a desktop app for now.

## v1.07 — 2026-09-27

- The Debts page now opens with your total debt (sum of open balances, number of debts, and total monthly payments), with the interest totals right under it. The list is in pay-off order — #1 is the first debt to close. The suggested order is "Pay first" debts, then debts with interest (smallest first), then interest-free debts (smallest first).
- You can change the pay-off order on the Debts page by dragging a debt by its handle (the grip next to its number), with mouse, touch or keyboard. Debts marked "Pay first" always stay on top. Your order is saved, and the Simulation pays debts in exactly that order; new debts join at the end. "Reset to suggested order" brings back the default. Once you've saved a plan in Simulation, each debt also shows when it closes (e.g. "Closes: month 4 · Jan 2027").
- Optional "Pay by" date on each debt (fines, loans from friends or family). The list shows the date, highlights debts due within 30 days, and marks overdue ones in red; the Simulation warns when your plan would pay a debt off after its date.
- Adding a debt is quicker: the "Attach transactions" picker is now at the top of the form, and picking a transaction fills in the debt name and monthly payment for you. Anything you've typed yourself is never overwritten.
- Debts now have an annual interest rate: either a fixed rate, or Prime ± a margin (Israeli prime, currently 4.75%, is built in and the form shows your resulting rate). The Debts page shows how much interest each debt will cost if you pay only the monthly payment, plus a total for all open debts. Debts with no end date (no monthly payment, like an overdraft, or a payment that doesn't cover the interest) show their ongoing interest per month and per year, with their own total.
- The pay-off plan in Simulation follows the same order: step 1 is "Pay first" debts, step 2 the emergency fund (renamed from "cushion"; in Hebrew "קרן לשעת חירום"), step 3 the rest of your debts. The order is fixed from the start (it no longer reshuffles month to month), and the per-debt list is numbered in the same order as the Debts page.
- The pay-off plan in Simulation now charges interest every month, so timelines are realistic, and it shows the total interest you'll pay under your plan (and per debt).
- Redesigned Simulation → "Pay off debts". The top card shows the month and year you'll be debt-free (e.g. "Debt-free by December 2027 — in 15 months"), with your total debt today, the total interest you'll pay, and the emergency fund target. Below it is a timeline showing the month and year each debt gets paid off (plus when the emergency fund fills up), from today to "Debt-free!". Each debt shows its balance, interest and any "Pay by" warning. The plan steps now show a colored progress bar and when each step ends ("until Apr 2027"). "Your numbers" is tidier, and on wide screens it sits next to the results.
- Fixed: the pay-off plan was wasting money. Each month, money left over after one step (paying off "Pay first" debts, or filling the emergency fund) was thrown away instead of moving on to the next step. So a big one-time amount or a big monthly amount barely changed the timeline. Leftover money now moves on to the next step in the same month, so extra money shortens the plan as you'd expect. A step that finishes within the same month as the step before it now says "Same month". Amounts typed with commas (e.g. 100,000) are now read correctly; before, they were read as 100.
- One-time money now has a month and year picker (e.g. "January 2027") instead of the confusing "After months" number. The date you pick is saved as that calendar month, so it doesn't shift as time passes. Plans you saved before are moved to the month they pointed to, and if that month has already passed you'll see a note asking you to pick a new one.
- The Recurring list is now sorted by amount, highest first, with monthly debt payments grouped at the end (also highest first).
- Fixed: deleting a debt left its monthly payment behind in Recurring (switched off, but still listed). Deleting a debt now removes its payment too, and leftover payments from debts you already deleted are cleaned up automatically when you open Recurring.
- The monthly budget (Categories page) now includes income: each income category (salary, etc.) has its own row with its recurring amount, last month, 3-month average, what you've received so far this month, and a planned amount. The Income total at the top is now the sum of those rows and can't be typed over, so Income, Budgeted and Left always add up. Months saved before this start with your recurring income per category.
- New "Copy from simulation" button on the monthly budget: fills this month's income and expense budgets from your saved Simulation (what-if rows are skipped because they aren't real categories). Review the numbers, then Save.
- Fixed: clearing a category's budget and saving didn't always remove it — the old amount could come back next time you opened the month. Saving now stores exactly what's on screen.
- Fixed: saving in Simulation didn't always keep your changes. Amounts you cleared or set to 0 (on both tabs) came back after reopening; setting the emergency fund to 0 months jumped back to 3; switching from "Pay off debts" to "Budget" and back threw away changes you hadn't saved yet; and the one-time amount field wouldn't accept decimals or a leading 0 while typing. Saving now stores exactly what's on screen.
- Fixed: MAX card purchases were dated on the day the card is billed (usually the 10th of the next month), so late-month purchases showed up as next month's spending — e.g. September purchases appeared as "already spent" in October while you were still planning it. Regular purchases now count in the month you made them. Installment payments ("תשלום 2 מתוך 3") still land in the month each payment is billed, so they show up in future months as planned spending. Transactions already imported are moved to their purchase date with a one-time repair, keeping their categories.
- See the math behind the pay-off plan: tap "Show month-by-month calculation", any step's number of months, or a debt's "Month N" to open a month-by-month breakdown. Each month shows the money coming in, interest added, what was paid to each debt (start → + interest → − paid → left), what went into the emergency fund, and when each debt gets paid off.

## v1.06 — 2026-09-27

- Fixed: the Simulation page was showing a copy of the Dashboard instead of the simulation. It now opens the budget simulation again, with "Budget" and "Pay off debts" tabs (the debt pay-off planner uses the net from the budget simulation).

## v1.05 — 2026-09-26

- Recurring suggestions are stricter: only the same business, exact same amount, and day of month within ±3 days — and it must appear in all of the last 3 months — so one-off purchases are no longer suggested.

## v1.04 — 2026-09-26

- Mobile navigation redesigned: primary tabs (Dashboard, Transactions, Budget, Debts) plus a More sheet for the rest, so labels no longer overflow or collide on small screens.
- Tighter mobile chrome (book switcher, headers, padding) and horizontal overflow guardrails so content stays within the viewport.
- Simulation page respects Hebrew RTL (including the recurring / last month / 3-month avg lines).

## v1.03 — 2026-09-26

- Full-screen celebration when you mark a debt as paid (confetti + big “Debt paid off!” moment).

## v1.02 — 2026-09-26

- Debts page is debt tracking only (balances, monthly payments → recurring, attach transactions).
- Pay-off planner moved to Simulation → “Pay off debts” / “סגירת חובות”, with plain-language fields (available each month, emergency cushion) — no “snowball” or “nominal” wording.

## v1.01 — 2026-09-26

- New Debts page: track real obligations (bank loans, family loans, unpaid bills) with balance and optional monthly payment.
- Monthly payments sync automatically to recurring expenses; attach transactions so merchants are recognized on future imports.
- Debt pay-off simulator with three steps: small debts first, emergency cushion, then remaining debts (freed monthly payments roll into the next debt).

## v1.00 — 2026-09-26

- Baseline release: versioning and release notes tracking starts here.
- Future features and fixes will bump the version and add an entry above this one.
