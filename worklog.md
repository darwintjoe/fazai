---
Task ID: 1
Agent: Main Agent
Task: Replace all green/emerald/teal color components with FAZAI logo theme (Red, White, Black, Gold)

Work Log:
- Audited all FAZAI component files for green/emerald/teal references
- Found 40+ references across 12 files
- Defined color mapping: Red=Income/Active, White/Gray=Expense, Black=Text, Gold/Amber=Accent/Confirmed
- Updated dashboard.tsx: "view all" link from emerald to red
- Updated bottom-nav.tsx: active nav item from emerald-600 to red-600
- Updated history.tsx: filter pills, income icons/amounts from green/emerald to red, expense from red to gray
- Updated admin-panel.tsx: active tab pills from emerald to red
- Updated admin-settings.tsx: language/theme pills from emerald to red
- Updated settings.tsx: guide card border/bg, language/theme pills from emerald to red
- Updated transaction-form.tsx: account selection bg, pills, AI suggestion, new account links from emerald to red
- Updated admin-custom-entry.tsx: "Add New" text, balanced indicator (amber), save button gradient from emerald/teal to red
- Updated admin-accounts.tsx: active toggle icon from emerald to red
- Updated reports.tsx: P&L card gradient from emerald/teal to red/amber
- Updated user-guide.tsx: header icon, section icons, close button from emerald to red
- Updated ai-chat.tsx: confirmed card border/bg and "Recorded" badge from emerald to amber/gold
- Updated report-viewer.tsx: table headers from emerald to red, balance sheet color from emerald to red, P&L/cash-flow income headers from green to red, PDF export header/table colors from emerald/green RGB to red
- Updated globals.css: chart colors and ring from neutral/blue to red/amber/amber theme, sidebar-primary from blue to red
- Updated i18n.ts: English guide text from "green Income" to "red Income"

Stage Summary:
- All 40+ green/emerald/teal references replaced across 14 files
- Zero green/emerald/teal references remain in src/components/fazai/ and src/app/
- Build passes successfully
- Color theme now aligned: Red=Income/Active/Primary, White/Gray=Expense, Black=Text, Gold/Amber=Accent/Confirmed
