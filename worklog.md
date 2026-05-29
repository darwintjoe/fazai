---
Task ID: 1
Agent: Main
Task: Build FAZAI accounting PWA

Work Log:
- Initialized Next.js 16 project with fullstack-dev skill
- Installed additional dependencies: dexie, jspdf, jspdf-autotable, xlsx
- Built complete FAZAI app with all 15+ components and 8 library modules
- Fixed bugs: missing useState import in admin-backup, ZAI SDK instantiation pattern, Dexie boolean query, User isSystem field, dashboard refresh
- Ran ESLint and fixed all issues

Stage Summary:
- Complete FAZAI accounting PWA built and running on port 3000
- All features implemented: PIN login, dashboard, income/expense forms, ledger engine, history, reports, admin panel, AI chat, export/import, i18n, dark mode, PWA
- Lint passes clean with no errors

---
Task ID: 2
Agent: Main
Task: Rebuild missing features for FAZAI (cashBank type, factory reset, report redesign, etc.)

Work Log:
1. **fazai-db.ts** — Added `cashBank` to Account type, updated default accounts (acc-cash/acc-bank now cashBank type with parentId acc-cashbank-root), added acc-cashbank-root and acc-opening-balance accounts, added `deleteAllTransactions()`, `verifyAdminPin()`, `factoryReset()` functions
2. **i18n.ts** — Added `type.cashBank`, `admin.openingBalance`, reset/factory reset keys (12 new keys), `guide.gettingStarted`, `guide.defaultPin`, `guide.factoryReset`, `guide.factoryResetDesc`; removed `guide.close` and `guide.userGuide`
3. **ledger-engine.ts** — Added `createOpeningBalanceTransaction()`, rewrote `generateTrialBalance()` (asOfDate + YTD for income/expense), updated all asset checks to include cashBank (balance sheet, cash flow, ledger isDebitNormal), rewrote `getDashboardSummary()` to derive from account movements (not tx.type)
4. **format.ts** — Added `endOfMonthFor()`, `startOfMonthFor()`, `startOfYearFor()`, `isCurrentMonth()`, `MONTH_LABELS`, `formatMonthYear()`
5. **admin-backup.tsx** — Complete rewrite with Export, Import, Reset Transactions (2-step challenge+PIN), Factory Reset (2-step challenge+PIN) using AlertDialog
6. **report-viewer.tsx** — Redesigned: BS/TB use month-year picker, P&L/CF/Ledger use date range with MTD defaults, added Generate button, imports from format.ts
7. **admin-accounts.tsx** — Added `cashBank` to ACCOUNT_TYPES array
8. **user-guide.tsx** — Added Getting Started section, Factory Reset subsection under Backup, replaced guide.close with common.close, removed guide.userGuide references
9. **transaction-form.tsx** — Updated opponent accounts query to include cashBank type
10. **pin-login.tsx** — Changed guide.userGuide to guide.title
11. **settings.tsx** — Changed guide.userGuide to guide.title
12. **dashboard.tsx** — Updated cash account detection to include cashBank type
13. **history.tsx** — Updated getTxAmount to include cashBank type in asset detection
14. Ran ESLint — passes clean, dev server compiles successfully

Stage Summary:
- All 10 feature rebuilds completed successfully
- cashBank account type integrated across all modules (DB, engine, UI components)
- Factory Reset and Reset Transactions with 2-step safety (challenge code + admin PIN)
- Report Viewer redesigned with month-year picker for BS/TB and MTD defaults for P&L/CF
- Opening Balance equity account and transaction creation function added
- Trial Balance now uses asOfDate with YTD for income/expense accounts
- Dashboard summary derives from account movements (not tx.type)
- All i18n keys added for EN/ID/ZH with proper translations
- Lint passes clean, dev server compiles without errors
