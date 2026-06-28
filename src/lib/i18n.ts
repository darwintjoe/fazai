export type Lang = 'en' | 'id' | 'zh';

export type TranslationKeys = {
  // Login
  'login.title': string;
  'login.enterPin': string;
  'login.unlock': string;
  'login.selectLanguage': string;
  'login.wrongPin': string;

  // Dashboard
  'dash.balance': string;
  'dash.today': string;
  'dash.income': string;
  'dash.expense': string;
  'dash.recentTransactions': string;
  'dash.noTransactions': string;

  // Forms
  'form.amount': string;
  'form.from': string;
  'form.to': string;
  'form.account': string;
  'form.description': string;
  'form.date': string;
  'form.save': string;
  'form.cancel': string;
  'form.createAccount': string;
  'form.newAccount': string;
  'form.opponentAccount': string;
  'form.aiSuggestion': string;
  'form.searchAccount': string;
  'form.createCashBank': string;
  'form.newCashBank': string;
  'form.openingBalance': string;
  'form.setOpeningBalance': string;

  // History
  'hist.title': string;
  'hist.search': string;
  'hist.filter': string;
  'hist.all': string;
  'hist.noResults': string;
  'hist.detail': string;
  'hist.debit': string;
  'hist.credit': string;
  'hist.editTransaction': string;
  'hist.editTransactionDesc': string;
  'hist.deletedNote': string;
  'hist.editedNote': string;
  'hist.deletedConfirmDesc': string;
  'hist.editSuccess': string;

  // Reports
  'rep.title': string;
  'rep.trialBalance': string;
  'rep.balanceSheet': string;
  'rep.profitLoss': string;
  'rep.cashFlow': string;
  'rep.ledger': string;
  'rep.dateRange': string;
  'rep.from': string;
  'rep.to': string;
  'rep.generate': string;
  'rep.exportPdf': string;
  'rep.exportXlsx': string;
  'rep.total': string;
  'rep.account': string;
  'rep.debit': string;
  'rep.credit': string;
  'rep.balance': string;
  'rep.assets': string;
  'rep.liabilities': string;
  'rep.equity': string;
  'rep.netProfit': string;
  'rep.retainedEarnings': string;
  'rep.inflows': string;
  'rep.outflows': string;
  'rep.netChange': string;
  'rep.beginning': string;
  'rep.ending': string;
  'rep.selectAccount': string;
  'rep.description': string;
  'rep.noData': string;

  // Admin
  'admin.title': string;
  'admin.users': string;
  'admin.accounts': string;
  'admin.customTransaction': string;
  'admin.settings': string;
  'admin.backup': string;
  'admin.addUser': string;
  'admin.editUser': string;
  'admin.deleteUser': string;
  'admin.name': string;
  'admin.pin': string;
  'admin.role': string;
  'admin.adminRole': string;
  'admin.userRole': string;
  'admin.addAccount': string;
  'admin.editAccount': string;
  'admin.deactivate': string;
  'admin.activate': string;
  'admin.code': string;
  'admin.type': string;
  'admin.active': string;
  'admin.debitAccount': string;
  'admin.creditAccount': string;
  'admin.balance': string;
  'admin.addRow': string;
  'admin.removeRow': string;
  'admin.autoBalance': string;
  'admin.notBalanced': string;
  'admin.journalEntry': string;
  'admin.changePin': string;
  'admin.oldPin': string;
  'admin.newPin': string;
  'admin.confirmPin': string;
  'admin.language': string;
  'admin.theme': string;
  'admin.light': string;
  'admin.dark': string;
  'admin.exportData': string;
  'admin.importData': string;
  'admin.confirmImport': string;
  'admin.importWarning': string;
  'admin.openingBalance': string;
  'admin.resetTransactions': string;
  'admin.resetTransactionsDesc': string;
  'admin.resetTransactionsWarning': string;
  'admin.fullFactoryReset': string;
  'admin.fullFactoryResetDesc': string;
  'admin.fullResetWarning': string;
  'admin.typeToConfirm': string;
  'admin.enterAdminPin': string;
  'admin.confirmReset': string;
  'admin.proceedReset': string;
  'admin.challengeMismatch': string;
  'admin.wrongPin': string;
  'admin.aiSettings': string;

  // Common
  'common.cancel': string;
  'common.confirm': string;
  'common.delete': string;
  'common.edit': string;
  'common.search': string;
  'common.export': string;
  'common.import': string;
  'common.save': string;
  'common.close': string;
  'common.back': string;
  'common.success': string;
  'common.error': string;
  'common.loading': string;
  'common.noData': string;
  'common.confirmDelete': string;
  'common.cannotUndo': string;
  'common.edited': string;
  'common.deleted': string;

  // AI
  'ai.title': string;
  'ai.placeholder': string;
  'ai.thinking': string;
  'ai.ledger': string;
  'ai.debit': string;
  'ai.credit': string;
  'ai.changeAccount': string;
  'ai.keywordFallback': string;
  'ai.verifyAccount': string;
  'ai.notConfigured': string;
  'ai.editAmount': string;
  'ai.editAmountPrompt': string;
  'ai.editConfirm': string;
  'ai.editChangeAmount': string;
  'ai.editTo': string;
  'ai.editSuccess': string;

  // Nav
  'nav.home': string;
  'nav.reports': string;
  'nav.history': string;
  'nav.admin': string;
  'nav.settings': string;
  'nav.logout': string;

  // Account types
  'type.asset': string;
  'type.cashBank': string;
  'type.liability': string;
  'type.equity': string;
  'type.income': string;
  'type.expense': string;

  // Guide
  'guide.title': string;
  'guide.gettingStarted': string;
  'guide.defaultPin': string;
  'guide.overview': string;
  'guide.overview.desc': string;
  'guide.login': string;
  'guide.login.desc': string;
  'guide.dashboard': string;
  'guide.dashboard.desc': string;
  'guide.incomeExpense': string;
  'guide.incomeExpense.desc': string;
  'guide.accounts': string;
  'guide.accounts.desc': string;
  'guide.reports': string;
  'guide.reports.desc': string;
  'guide.reports.bs': string;
  'guide.reports.tb': string;
  'guide.reports.pl': string;
  'guide.reports.cf': string;
  'guide.reports.ledger': string;
  'guide.admin': string;
  'guide.admin.desc': string;
  'guide.backup': string;
  'guide.backup.desc': string;
  'guide.factoryReset': string;
  'guide.factoryResetDesc': string;
  'guide.ai': string;
  'guide.ai.desc': string;
  'guide.tips': string;
  'guide.tips.desc': string;

  // Migration guide
  'guide.migration': string;
  'guide.migration.desc': string;

  // Receipt / Share Target
  'receipt.title': string;
  'receipt.processing': string;
  'receipt.extracted': string;
  'receipt.noImage': string;
  'receipt.aiNotConfigured': string;
  'receipt.fromReceipt': string;
  'receipt.record': string;
  'receipt.error': string;
  'receipt.retry': string;
  'receipt.type': string;
  'receipt.reference': string;
};

const en: TranslationKeys = {
  'login.title': 'FAZAI',
  'login.enterPin': 'Enter PIN',
  'login.unlock': 'Unlock',
  'login.selectLanguage': 'Language',
  'login.wrongPin': 'Wrong PIN',
  'dash.balance': 'Balance',
  'dash.today': 'Today',
  'dash.income': 'Income',
  'dash.expense': 'Expense',
  'dash.recentTransactions': 'Recent Transactions',
  'dash.noTransactions': 'No transactions yet',
  'form.amount': 'Amount',
  'form.from': 'From',
  'form.to': 'To',
  'form.account': 'Account',
  'form.description': 'Description',
  'form.date': 'Date',
  'form.save': 'Save',
  'form.cancel': 'Cancel',
  'form.createAccount': 'Create',
  'form.newAccount': 'New Account',
  'form.opponentAccount': 'Cash/Bank Account',
  'form.aiSuggestion': 'AI Suggestion',
  'form.searchAccount': 'Search account...',
  'form.createCashBank': 'Create Cash/Bank',
  'form.newCashBank': 'New Cash/Bank Account',
  'form.openingBalance': 'Opening Balance',
  'form.setOpeningBalance': 'Set Opening Balance',
  'hist.title': 'Transaction History',
  'hist.search': 'Search...',
  'hist.filter': 'Filter',
  'hist.all': 'All',
  'hist.noResults': 'No transactions found',
  'hist.detail': 'Transaction Detail',
  'hist.debit': 'Debit',
  'hist.credit': 'Credit',
  'hist.editTransaction': 'Edit Transaction',
  'hist.editTransactionDesc': 'Update the transaction details below.',
  'hist.deletedNote': 'Deleted · {time}',
  'hist.editedNote': 'Edited · {time}',
  'hist.deletedConfirmDesc': 'The transaction will be greyed out and kept as a record, but excluded from your totals.',
  'hist.editSuccess': 'Transaction updated',
  'rep.title': 'Reports',
  'rep.trialBalance': 'Trial Balance',
  'rep.balanceSheet': 'Balance Sheet',
  'rep.profitLoss': 'Profit & Loss',
  'rep.cashFlow': 'Cash Flow',
  'rep.ledger': 'Ledger',
  'rep.dateRange': 'Date Range',
  'rep.from': 'From',
  'rep.to': 'To',
  'rep.generate': 'Generate',
  'rep.exportPdf': 'Export PDF',
  'rep.exportXlsx': 'Export XLSX',
  'rep.total': 'Total',
  'rep.account': 'Account',
  'rep.debit': 'Debit',
  'rep.credit': 'Credit',
  'rep.balance': 'Balance',
  'rep.assets': 'Assets',
  'rep.liabilities': 'Liabilities',
  'rep.equity': 'Equity',
  'rep.netProfit': 'Net Profit',
  'rep.retainedEarnings': 'Retained Earnings',
  'rep.inflows': 'Cash Inflows',
  'rep.outflows': 'Cash Outflows',
  'rep.netChange': 'Net Change',
  'rep.beginning': 'Beginning Balance',
  'rep.ending': 'Ending Balance',
  'rep.selectAccount': 'Select Account',
  'rep.description': 'Description',
  'rep.noData': 'No data for this period',
  'admin.title': 'Admin Panel',
  'admin.users': 'Users',
  'admin.accounts': 'Accounts',
  'admin.customTransaction': 'Custom Entry',
  'admin.settings': 'Settings',
  'admin.backup': 'Backup',
  'admin.addUser': 'Add User',
  'admin.editUser': 'Edit User',
  'admin.deleteUser': 'Delete User',
  'admin.name': 'Name',
  'admin.pin': 'PIN',
  'admin.role': 'Role',
  'admin.adminRole': 'Admin',
  'admin.userRole': 'User',
  'admin.addAccount': 'Add Account',
  'admin.editAccount': 'Edit Account',
  'admin.deactivate': 'Deactivate',
  'admin.activate': 'Activate',
  'admin.code': 'Code',
  'admin.type': 'Type',
  'admin.active': 'Active',
  'admin.debitAccount': 'Debit Account',
  'admin.creditAccount': 'Credit Account',
  'admin.balance': 'Balance',
  'admin.addRow': 'Add Row',
  'admin.removeRow': 'Remove',
  'admin.autoBalance': 'Auto Balance',
  'admin.notBalanced': 'Debits and Credits must balance',
  'admin.journalEntry': 'Journal Entry',
  'admin.changePin': 'Change PIN',
  'admin.oldPin': 'Current PIN',
  'admin.newPin': 'New PIN',
  'admin.confirmPin': 'Confirm PIN',
  'admin.language': 'Language',
  'admin.theme': 'Theme',
  'admin.light': 'Light',
  'admin.dark': 'Dark',
  'admin.exportData': 'Export Data',
  'admin.importData': 'Import Data',
  'admin.confirmImport': 'Confirm Import',
  'admin.importWarning': 'This will replace all existing data. This action cannot be undone.',
  'admin.openingBalance': 'Opening Balance',
  'admin.resetTransactions': 'Reset Transactions',
  'admin.resetTransactionsDesc': 'Delete all transactions while keeping accounts and users',
  'admin.resetTransactionsWarning': 'This will permanently delete ALL transactions. This action cannot be undone.',
  'admin.fullFactoryReset': 'Factory Reset',
  'admin.fullFactoryResetDesc': 'Delete ALL data and restore to factory defaults',
  'admin.fullResetWarning': 'This will permanently delete ALL data including users, accounts, and transactions. You will need to set up the app again from scratch.',
  'admin.typeToConfirm': 'Type the code to confirm',
  'admin.enterAdminPin': 'Enter Admin PIN',
  'admin.confirmReset': 'Confirm Reset',
  'admin.proceedReset': 'Proceed with Reset',
  'admin.challengeMismatch': 'Confirmation code does not match',
  'admin.wrongPin': 'Incorrect Admin PIN',
  'admin.aiSettings': 'AI Settings',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.search': 'Search',
  'common.export': 'Export',
  'common.import': 'Import',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.back': 'Back',
  'common.success': 'Success',
  'common.error': 'Error',
  'common.loading': 'Loading...',
  'common.noData': 'No data',
  'common.confirmDelete': 'Are you sure you want to delete?',
  'common.cannotUndo': 'This action cannot be undone.',
  'common.edited': 'Edited',
  'common.deleted': 'Deleted',
  'ai.title': 'AI Assistant',
  'ai.placeholder': 'Ask about your finances...',
  'ai.thinking': 'Thinking...',
  'ai.ledger': 'Ledger Entry',
  'ai.debit': 'Debit',
  'ai.credit': 'Credit',
  'ai.changeAccount': 'Change account',
  'ai.keywordFallback': 'Keyword match',
  'ai.verifyAccount': 'AI offline — verify account before confirming',
  'ai.notConfigured': 'AI not configured — go to Admin → AI Settings to set up your API key',
  'ai.editAmount': 'Edit Amount',
  'ai.editAmountPrompt': '🗑️ "Change my last transaction to 50k"',
  'ai.editConfirm': 'Update amount',
  'ai.editChangeAmount': 'Change amount to',
  'ai.editTo': 'to',
  'ai.editSuccess': '✓ Amount updated successfully!',
  'nav.home': 'Home',
  'nav.reports': 'Reports',
  'nav.history': 'History',
  'nav.admin': 'Admin',
  'nav.settings': 'Settings',
  'nav.logout': 'Logout',
  'type.asset': 'Asset',
  'type.cashBank': 'Cash & Bank',
  'type.liability': 'Liability',
  'type.equity': 'Equity',
  'type.income': 'Income',
  'type.expense': 'Expense',
  'guide.title': 'User Guide',
  'guide.gettingStarted': 'Getting Started',
  'guide.defaultPin': 'Default PINs: Admin = 000000, User = 111111',
  'guide.overview': 'Overview',
  'guide.overview.desc': 'FAZAI is a simple cash-basis accounting app with a double-entry ledger engine running behind a clean Income/Expense interface. All data is stored locally on your device using IndexedDB — nothing is sent to any server. Your financial information stays completely private and secure on your device. The app works offline and can be installed as a Progressive Web App (PWA) for quick access from your home screen.',
  'guide.login': 'Login & PIN',
  'guide.login.desc': 'Enter your 6-digit PIN to unlock the app. Default PINs: Admin = 000000, User = 111111. Each user has a role (Admin or User) that controls access to features. Admins can access the Admin Panel for managing users, accounts, and backups. You can change your PIN anytime from Settings after logging in.',
  'guide.dashboard': 'Dashboard',
  'guide.dashboard.desc': 'The dashboard shows your current total balance, today\'s income and expense totals, and a list of recent transactions. Use the red Income and gray Expense buttons to quickly add new transactions. Tap any recent transaction to view its details in the History page.',
  'guide.incomeExpense': 'Income & Expense',
  'guide.incomeExpense.desc': 'Behind the simple form, FAZAI creates proper double-entry journal entries. For Income: the income account is credited and your Cash/Bank account is debited. For Expense: the expense account is debited and your Cash/Bank account is credited. This ensures your books always balance while keeping the interface simple and intuitive.',
  'guide.accounts': 'Accounts',
  'guide.accounts.desc': 'FAZAI uses 6 account types: Asset, Cash/Bank, Liability, Equity, Income, and Expense. Cash/Bank accounts are a special sub-type of Asset used for transaction entry. Opening Balance is tracked as a child of Equity. When creating a new account, you choose its type and an optional parent account for hierarchical grouping.',
  'guide.reports': 'Reports',
  'guide.reports.desc': 'All reports derive from account movements and entries — the source of truth is always the ledger, not the transaction type.',
  'guide.reports.bs': 'Balance Sheet — Shows assets, liabilities, and equity as of a specific month-end date. Select the month and year to generate.',
  'guide.reports.tb': 'Trial Balance — Lists all active accounts with their debit/credit balances as of a specific date. Income and Expense accounts show Year-to-Date (YTD) figures.',
  'guide.reports.pl': 'Profit & Loss — Shows income and expense categories for a selected period. Defaults to Month-to-Date (MTD). Select custom start and end dates as needed.',
  'guide.reports.cf': 'Cash Flow — Displays cash inflows and outflows from Cash/Bank accounts for a selected period. Defaults to MTD. Helps you understand where your cash is coming from and going to.',
  'guide.reports.ledger': 'Ledger — Shows all entries for a specific account in chronological order. Select an account and date range to view its transaction history with running balances.',
  'guide.admin': 'Admin Panel',
  'guide.admin.desc': 'Only accessible by Admin users. Manage Users: add, edit, or delete user accounts and assign roles. Manage Accounts: create, edit, activate/deactivate accounts, organize by type. Custom Entry: create manual double-entry journal entries with specific debit and credit accounts. Settings: configure app preferences.',
  'guide.backup': 'Backup & Restore',
  'guide.backup.desc': 'Export all your data as a JSON file for safekeeping. Import a previously exported backup to restore your data. Factory Reset: permanently deletes ALL data. For safety, you must type a randomly generated challenge code and enter the Admin PIN to confirm. This prevents accidental resets.',
  'guide.factoryReset': 'Factory Reset',
  'guide.factoryResetDesc': 'Factory Reset permanently deletes ALL data. A random challenge code must be typed and Admin PIN entered to confirm, preventing accidental resets.',
  'guide.ai': 'AI Assistant',
  'guide.ai.desc': 'The floating AI chat button lets you record transactions and query your finances using everyday language! Type things like "lunch 25k", "terima gaji 1 juta", or "how much did I spend this month?" and the AI will respond. To use the AI, you need to configure an API key first: go to Admin Panel → AI Settings, select your provider (OpenAI, Anthropic, Google, Groq, DeepSeek, Qwen, Kimi, or Z.Ai), enter your API key, and test the connection. Your API key is stored locally on your device and never sent anywhere except your chosen provider. If the AI is unavailable, a keyword-based fallback will still work for simple transactions.',
  'guide.tips': 'Tips & Notes',
  'guide.tips.desc': 'All data is stored locally on your device — back up regularly using the Export function! Avoid clearing site data in browser settings, as this will erase all your accounting records. Keep your Admin PIN secure — it\'s required for factory reset protection. The app works best in portrait mode on mobile devices. Install as a PWA for the best experience with offline support.',
  'guide.migration': 'Migrate Guide',
  'guide.migration.desc': 'Follow these steps to set up FAZAI from your existing balance sheet:\n\n1. Prepare your latest balance sheet — gather your most recent balance sheet document as reference.\n\n2. Login as Admin — use the Admin PIN (default: 000000) to access the Admin Panel.\n\n3. Go to Accounts section — add all accounts following your latest balance sheet. For each account, select the correct account type (Asset, Cash/Bank, Liability, Equity, Income, or Expense) and enter the current balance.\n\n4. Review all accounts — double-check each account\'s type and balance. You may disable any unused pre-created accounts by toggling them off.\n\n5. Go to Reports → Balance Sheet — verify that all figures match your original balance sheet. The total assets should equal liabilities plus equity.\n\n6. That\'s all — FAZAI is ready to use! Start recording your daily income and expenses.',
  'receipt.title': 'Receipt Scanner',
  'receipt.processing': 'Reading receipt...',
  'receipt.extracted': 'Extracted from receipt',
  'receipt.noImage': 'No image received. Please share an image to scan.',
  'receipt.aiNotConfigured': 'AI is not configured. Please go to Admin → AI Settings to set up an API key first.',
  'receipt.fromReceipt': 'Pre-filled from receipt scan',
  'receipt.record': 'Record Transaction',
  'receipt.error': 'Failed to read receipt',
  'receipt.retry': 'Retry',
  'receipt.type': 'Type',
  'receipt.reference': 'Reference',
};

const id: TranslationKeys = {
  'login.title': 'FAZAI',
  'login.enterPin': 'Masukkan PIN',
  'login.unlock': 'Buka',
  'login.selectLanguage': 'Bahasa',
  'login.wrongPin': 'PIN salah',
  'dash.balance': 'Saldo',
  'dash.today': 'Hari Ini',
  'dash.income': 'Pendapatan',
  'dash.expense': 'Pengeluaran',
  'dash.recentTransactions': 'Transaksi Terakhir',
  'dash.noTransactions': 'Belum ada transaksi',
  'form.amount': 'Jumlah',
  'form.from': 'Dari',
  'form.to': 'Kepada',
  'form.account': 'Akun',
  'form.description': 'Keterangan',
  'form.date': 'Tanggal',
  'form.save': 'Simpan',
  'form.cancel': 'Batal',
  'form.createAccount': 'Buat',
  'form.newAccount': 'Akun Baru',
  'form.opponentAccount': 'Akun Kas/Bank',
  'form.aiSuggestion': 'Saran AI',
  'form.searchAccount': 'Cari akun...',
  'form.createCashBank': 'Buat Kas/Bank',
  'form.newCashBank': 'Akun Kas/Bank Baru',
  'form.openingBalance': 'Saldo Awal',
  'form.setOpeningBalance': 'Atur Saldo Awal',
  'hist.title': 'Riwayat Transaksi',
  'hist.search': 'Cari...',
  'hist.filter': 'Filter',
  'hist.all': 'Semua',
  'hist.noResults': 'Tidak ada transaksi ditemukan',
  'hist.detail': 'Detail Transaksi',
  'hist.debit': 'Debit',
  'hist.credit': 'Kredit',
  'hist.editTransaction': 'Edit Transaksi',
  'hist.editTransactionDesc': 'Perbarui detail transaksi di bawah ini.',
  'hist.deletedNote': 'Dihapus · {time}',
  'hist.editedNote': 'Diedit · {time}',
  'hist.deletedConfirmDesc': 'Transaksi akan menjadi abu-abu dan disimpan sebagai catatan, tetapi dikecualikan dari total Anda.',
  'hist.editSuccess': 'Transaksi diperbarui',
  'rep.title': 'Laporan',
  'rep.trialBalance': 'Neraca Saldo',
  'rep.balanceSheet': 'Neraca',
  'rep.profitLoss': 'Laba Rugi',
  'rep.cashFlow': 'Arus Kas',
  'rep.ledger': 'Buku Besar',
  'rep.dateRange': 'Rentang Tanggal',
  'rep.from': 'Dari',
  'rep.to': 'Sampai',
  'rep.generate': 'Buat',
  'rep.exportPdf': 'Ekspor PDF',
  'rep.exportXlsx': 'Ekspor XLSX',
  'rep.total': 'Total',
  'rep.account': 'Akun',
  'rep.debit': 'Debit',
  'rep.credit': 'Kredit',
  'rep.balance': 'Saldo',
  'rep.assets': 'Aset',
  'rep.liabilities': 'Kewajiban',
  'rep.equity': 'Modal',
  'rep.netProfit': 'Laba Bersih',
  'rep.retainedEarnings': 'Laba Ditahan',
  'rep.inflows': 'Arus Kas Masuk',
  'rep.outflows': 'Arus Kas Keluar',
  'rep.netChange': 'Perubahan Bersih',
  'rep.beginning': 'Saldo Awal',
  'rep.ending': 'Saldo Akhir',
  'rep.selectAccount': 'Pilih Akun',
  'rep.description': 'Keterangan',
  'rep.noData': 'Tidak ada data untuk periode ini',
  'admin.title': 'Panel Admin',
  'admin.users': 'Pengguna',
  'admin.accounts': 'Akun',
  'admin.customTransaction': 'Entri Kustom',
  'admin.settings': 'Pengaturan',
  'admin.backup': 'Cadangan',
  'admin.addUser': 'Tambah Pengguna',
  'admin.editUser': 'Edit Pengguna',
  'admin.deleteUser': 'Hapus Pengguna',
  'admin.name': 'Nama',
  'admin.pin': 'PIN',
  'admin.role': 'Peran',
  'admin.adminRole': 'Admin',
  'admin.userRole': 'Pengguna',
  'admin.addAccount': 'Tambah Akun',
  'admin.editAccount': 'Edit Akun',
  'admin.deactivate': 'Nonaktifkan',
  'admin.activate': 'Aktifkan',
  'admin.code': 'Kode',
  'admin.type': 'Jenis',
  'admin.active': 'Aktif',
  'admin.debitAccount': 'Akun Debit',
  'admin.creditAccount': 'Akun Kredit',
  'admin.balance': 'Saldo',
  'admin.addRow': 'Tambah Baris',
  'admin.removeRow': 'Hapus',
  'admin.autoBalance': 'Otomatis Seimbang',
  'admin.notBalanced': 'Debit dan Kredit harus seimbang',
  'admin.journalEntry': 'Entri Jurnal',
  'admin.changePin': 'Ubah PIN',
  'admin.oldPin': 'PIN Saat Ini',
  'admin.newPin': 'PIN Baru',
  'admin.confirmPin': 'Konfirmasi PIN',
  'admin.language': 'Bahasa',
  'admin.theme': 'Tema',
  'admin.light': 'Terang',
  'admin.dark': 'Gelap',
  'admin.exportData': 'Ekspor Data',
  'admin.importData': 'Impor Data',
  'admin.confirmImport': 'Konfirmasi Impor',
  'admin.importWarning': 'Ini akan mengganti semua data yang ada. Tindakan ini tidak dapat dibatalkan.',
  'admin.openingBalance': 'Saldo Awal',
  'admin.resetTransactions': 'Reset Transaksi',
  'admin.resetTransactionsDesc': 'Hapus semua transaksi dengan tetap menyimpan akun dan pengguna',
  'admin.resetTransactionsWarning': 'Ini akan menghapus semua transaksi secara permanen. Tindakan ini tidak dapat dibatalkan.',
  'admin.fullFactoryReset': 'Reset Pabrik',
  'admin.fullFactoryResetDesc': 'Hapus semua data dan kembalikan ke pengaturan pabrik',
  'admin.fullResetWarning': 'Ini akan menghapus semua data secara permanen termasuk pengguna, akun, dan transaksi. Anda perlu mengatur ulang aplikasi dari awal.',
  'admin.typeToConfirm': 'Ketik kode untuk mengkonfirmasi',
  'admin.enterAdminPin': 'Masukkan PIN Admin',
  'admin.confirmReset': 'Konfirmasi Reset',
  'admin.proceedReset': 'Lanjutkan Reset',
  'admin.challengeMismatch': 'Kode konfirmasi tidak cocok',
  'admin.wrongPin': 'PIN Admin salah',
  'admin.aiSettings': 'Pengaturan AI',
  'common.cancel': 'Batal',
  'common.confirm': 'Konfirmasi',
  'common.delete': 'Hapus',
  'common.edit': 'Edit',
  'common.search': 'Cari',
  'common.export': 'Ekspor',
  'common.import': 'Impor',
  'common.save': 'Simpan',
  'common.close': 'Tutup',
  'common.back': 'Kembali',
  'common.success': 'Berhasil',
  'common.error': 'Kesalahan',
  'common.loading': 'Memuat...',
  'common.noData': 'Tidak ada data',
  'common.confirmDelete': 'Apakah Anda yakin ingin menghapus?',
  'common.cannotUndo': 'Tindakan ini tidak dapat dibatalkan.',
  'common.edited': 'Diedit',
  'common.deleted': 'Dihapus',
  'ai.title': 'Asisten AI',
  'ai.placeholder': 'Tanya tentang keuangan Anda...',
  'ai.thinking': 'Berpikir...',
  'ai.ledger': 'Entri Buku Besar',
  'ai.debit': 'Debit',
  'ai.credit': 'Kredit',
  'ai.changeAccount': 'Ubah akun',
  'ai.keywordFallback': 'Cocokan kata kunci',
  'ai.verifyAccount': 'AI offline — periksa akun sebelum mengkonfirmasi',
  'ai.notConfigured': 'AI belum dikonfigurasi — buka Admin → Pengaturan AI untuk mengatur API key',
  'ai.editAmount': 'Edit Jumlah',
  'ai.editAmountPrompt': '🗑️ "Ubah transaksi terakhir menjadi 50 ribu"',
  'ai.editConfirm': 'Perbarui jumlah',
  'ai.editChangeAmount': 'Ubah jumlah menjadi',
  'ai.editTo': 'menjadi',
  'ai.editSuccess': '✓ Jumlah berhasil diperbarui!',
  'nav.home': 'Beranda',
  'nav.reports': 'Laporan',
  'nav.history': 'Riwayat',
  'nav.admin': 'Admin',
  'nav.settings': 'Pengaturan',
  'nav.logout': 'Keluar',
  'type.asset': 'Aset',
  'type.cashBank': 'Kas & Bank',
  'type.liability': 'Kewajiban',
  'type.equity': 'Modal',
  'type.income': 'Pendapatan',
  'type.expense': 'Pengeluaran',
  'guide.title': 'Panduan Pengguna',
  'guide.gettingStarted': 'Memulai',
  'guide.defaultPin': 'PIN default: Admin = 000000, Pengguna = 111111',
  'guide.overview': 'Tentang FAZAI',
  'guide.overview.desc': 'FAZAI adalah aplikasi akuntansi berbasis kas sederhana dengan mesin buku besar entri ganda yang berjalan di balik antarmukaan Pendapatan/Pengeluaran yang bersih. Semua data disimpan secara lokal di perangkat Anda menggunakan IndexedDB — tidak ada yang dikirim ke server mana pun. Informasi keuangan Anda tetap sepenuhnya pribadi dan aman di perangkat Anda. Aplikasi ini berfungsi offline dan dapat diinstal sebagai Progressive Web App (PWA) untuk akses cepat dari layar beranda.',
  'guide.login': 'Login & PIN',
  'guide.login.desc': 'Masukkan PIN 6 digit Anda untuk membuka aplikasi. PIN default: Admin = 000000, Pengguna = 111111. Setiap pengguna memiliki peran (Admin atau Pengguna) yang mengontrol akses ke fitur. Admin dapat mengakses Panel Admin untuk mengelola pengguna, akun, dan cadangan. Anda dapat mengubah PIN kapan saja dari Pengaturan setelah masuk.',
  'guide.dashboard': 'Dasbor',
  'guide.dashboard.desc': 'Dasbor menampilkan saldo total Anda saat ini, total pendapatan dan pengeluaran hari ini, dan daftar transaksi terbaru. Gunakan tombol Pendapatan hijau dan Pengeluaran merah untuk menambahkan transaksi baru dengan cepat. Ketuk transaksi terbaru untuk melihat detailnya di halaman Riwayat.',
  'guide.incomeExpense': 'Pendapatan & Pengeluaran',
  'guide.incomeExpense.desc': 'Di balik formulir sederhana, FAZAI membuat entri jurnal entri ganda yang benar. Untuk Pendapatan: akun pendapatan dikredit dan akun Kas/Bank Anda didebit. Untuk Pengeluaran: akun pengeluaran didebit dan akun Kas/Bank Anda dikredit. Ini memastikan buku Anda selalu seimbang sambil menjaga antarmuka tetap sederhana dan intuitif.',
  'guide.accounts': 'Akun',
  'guide.accounts.desc': 'FAZAI menggunakan 6 jenis akun: Aset, Kas/Bank, Kewajiban, Modal, Pendapatan, dan Pengeluaran. Akun Kas/Bank adalah sub-jenis khusus dari Aset yang digunakan untuk entri transaksi. Saldo Awal dilacak sebagai anak dari Modal. Saat membuat akun baru, Anda memilih jenisnya dan akun induk opsional untuk pengelompokan hierarkis.',
  'guide.reports': 'Laporan',
  'guide.reports.desc': 'Semua laporan berasal dari pergerakan akun dan entri — sumber kebenaran selalu buku besar, bukan jenis transaksi.',
  'guide.reports.bs': 'Neraca — Menampilkan aset, kewajiban, dan modal pada tanggal akhir bulan tertentu. Pilih bulan dan tahun untuk menghasilkan.',
  'guide.reports.tb': 'Neraca Saldo — Mendaftar semua akun aktif dengan saldo debit/kredit pada tanggal tertentu. Akun Pendapatan dan Pengeluaran menampilkan angka Tahun-berjalan (YTD).',
  'guide.reports.pl': 'Laba Rugi — Menampilkan kategori pendapatan dan pengeluaran untuk periode yang dipilih. Default ke Bulan-berjalan (MTD). Pilih tanggal mulai dan akhir kustom sesuai kebutuhan.',
  'guide.reports.cf': 'Arus Kas — Menampilkan arus kas masuk dan keluar dari akun Kas/Bank untuk periode yang dipilih. Default ke MTD. Membantu Anda memahami dari mana kas Anda berasal dan ke mana perginya.',
  'guide.reports.ledger': 'Buku Besar — Menampilkan semua entri untuk akun tertentu secara kronologis. Pilih akun dan rentang tanggal untuk melihat riwayat transaksinya dengan saldo berjalan.',
  'guide.admin': 'Panel Admin',
  'guide.admin.desc': 'Hanya dapat diakses oleh pengguna Admin. Kelola Pengguna: tambah, edit, atau hapus akun pengguna dan tetapkan peran. Kelola Akun: buat, edit, aktifkan/nonaktifkan akun, atur berdasarkan jenis. Entri Kustom: buat entri jurnal entri ganda manual dengan akun debit dan kredit tertentu. Pengaturan: konfigurasi preferensi aplikasi.',
  'guide.backup': 'Cadangan & Pemulihan',
  'guide.backup.desc': 'Ekspor semua data Anda sebagai file JSON untuk penyimpanan aman. Impor cadangan yang diekspor sebelumnya untuk memulihkan data Anda. Reset Pabrik: menghapus semua data secara permanen. Untuk keamanan, Anda harus mengetik kode tantangan yang dihasilkan secara acak dan memasukkan PIN Admin untuk mengkonfirmasi. Ini mencegah reset yang tidak disengaja.',
  'guide.factoryReset': 'Reset Pabrik',
  'guide.factoryResetDesc': 'Reset Pabrik menghapus semua data secara permanen. Kode tantangan acak harus diketik dan PIN Admin dimasukkan untuk mengkonfirmasi, mencegah reset yang tidak disengaja.',
  'guide.ai': 'Asisten AI',
  'guide.ai.desc': 'Tombol obrolan AI mengambang memungkinkan Anda mencatat transaksi dan menanyakan keuangan menggunakan bahasa sehari-hari! Ketik seperti "beli makan 5000", "terima gaji 1 juta", atau "berapa pengeluaran bulan ini?" dan AI akan merespons. Untuk menggunakan AI, Anda perlu mengonfigurasi API key terlebih dahulu: buka Panel Admin → Pengaturan AI, pilih provider (OpenAI, Anthropic, Google, Groq, DeepSeek, Qwen, Kimi, atau Z.Ai), masukkan API key Anda, dan uji koneksi. API key Anda disimpan secara lokal di perangkat dan hanya dikirim ke provider yang Anda pilih. Jika AI tidak tersedia, fallback berbasis kata kunci tetap berfungsi untuk transaksi sederhana.',
  'guide.tips': 'Tips & Catatan',
  'guide.tips.desc': 'Semua data disimpan secara lokal di perangkat Anda — cadangkan secara teratur menggunakan fungsi Ekspor! Jangan hapus data situs di pengaturan browser, karena ini akan menghapus semua catatan akuntansi Anda. Jaga keamanan PIN Admin Anda — diperlukan untuk perlindungan reset pabrik. Aplikasi ini bekerja paling baik dalam mode potret di perangkat seluler. Instal sebagai PWA untuk pengalaman terbaik dengan dukungan offline.',
  'guide.migration': 'Panduan Migrasi',
  'guide.migration.desc': 'Ikuti langkah-langkah berikut untuk menyiapkan FAZAI dari neraca yang ada:\n\n1. Siapkan neraca terbaru Anda — kumpulkan dokumen neraca terbaru sebagai referensi.\n\n2. Login sebagai Admin — gunakan PIN Admin (default: 000000) untuk mengakses Panel Admin.\n\n3. Buka bagian Akun — tambahkan semua akun sesuai neraca terbaru Anda. Untuk setiap akun, pilih jenis akun yang benar (Aset, Kas/Bank, Kewajiban, Modal, Pendapatan, atau Pengeluaran) dan masukkan saldo saat ini.\n\n4. Periksa semua akun — periksa kembali jenis dan saldo setiap akun. Anda dapat menonaktifkan akun bawaan yang tidak digunakan.\n\n5. Buka Laporan → Neraca — verifikasi bahwa semua angka sesuai dengan neraca asli Anda. Total aset harus sama dengan kewajiban ditambah modal.\n\n6. Selesai — FAZAI siap digunakan! Mulai catat pendapatan dan pengeluaran harian Anda.',
  'receipt.title': 'Pemindai Struk',
  'receipt.processing': 'Membaca struk...',
  'receipt.extracted': 'Diekstrak dari struk',
  'receipt.noImage': 'Tidak ada gambar diterima. Silakan bagikan gambar untuk dipindai.',
  'receipt.aiNotConfigured': 'AI belum dikonfigurasi. Silakan buka Admin → Pengaturan AI untuk mengatur API key terlebih dahulu.',
  'receipt.fromReceipt': 'Prasiswa dari pemindaian struk',
  'receipt.record': 'Catat Transaksi',
  'receipt.error': 'Gagal membaca struk',
  'receipt.retry': 'Coba Lagi',
  'receipt.type': 'Jenis',
  'receipt.reference': 'Referensi',
};

const zh: TranslationKeys = {
  'login.title': 'FAZAI',
  'login.enterPin': '输入PIN',
  'login.unlock': '解锁',
  'login.selectLanguage': '语言',
  'login.wrongPin': 'PIN码错误',
  'dash.balance': '余额',
  'dash.today': '今日',
  'dash.income': '收入',
  'dash.expense': '支出',
  'dash.recentTransactions': '最近交易',
  'dash.noTransactions': '暂无交易记录',
  'form.amount': '金额',
  'form.from': '来自',
  'form.to': '付给',
  'form.account': '账户',
  'form.description': '描述',
  'form.date': '日期',
  'form.save': '保存',
  'form.cancel': '取消',
  'form.createAccount': '创建',
  'form.newAccount': '新建账户',
  'form.opponentAccount': '现金/银行账户',
  'form.aiSuggestion': 'AI建议',
  'form.searchAccount': '搜索账户...',
  'form.createCashBank': '创建现金/银行',
  'form.newCashBank': '新建现金/银行账户',
  'form.openingBalance': '期初余额',
  'form.setOpeningBalance': '设置期初余额',
  'hist.title': '交易历史',
  'hist.search': '搜索...',
  'hist.filter': '筛选',
  'hist.all': '全部',
  'hist.noResults': '未找到交易记录',
  'hist.detail': '交易详情',
  'hist.debit': '借方',
  'hist.credit': '贷方',
  'hist.editTransaction': '编辑交易',
  'hist.editTransactionDesc': '请在下方更新交易详情。',
  'hist.deletedNote': '已删除 · {time}',
  'hist.editedNote': '已编辑 · {time}',
  'hist.deletedConfirmDesc': '该交易将变灰并保留为记录，但会从您的总计中排除。',
  'hist.editSuccess': '交易已更新',
  'rep.title': '报表',
  'rep.trialBalance': '试算平衡表',
  'rep.balanceSheet': '资产负债表',
  'rep.profitLoss': '利润表',
  'rep.cashFlow': '现金流量表',
  'rep.ledger': '分类账',
  'rep.dateRange': '日期范围',
  'rep.from': '从',
  'rep.to': '至',
  'rep.generate': '生成',
  'rep.exportPdf': '导出PDF',
  'rep.exportXlsx': '导出XLSX',
  'rep.total': '合计',
  'rep.account': '账户',
  'rep.debit': '借方',
  'rep.credit': '贷方',
  'rep.balance': '余额',
  'rep.assets': '资产',
  'rep.liabilities': '负债',
  'rep.equity': '权益',
  'rep.netProfit': '净利润',
  'rep.retainedEarnings': '留存收益',
  'rep.inflows': '现金流入',
  'rep.outflows': '现金流出',
  'rep.netChange': '净变动',
  'rep.beginning': '期初余额',
  'rep.ending': '期末余额',
  'rep.selectAccount': '选择账户',
  'rep.description': '描述',
  'rep.noData': '此期间无数据',
  'admin.title': '管理面板',
  'admin.users': '用户',
  'admin.accounts': '账户',
  'admin.customTransaction': '自定义分录',
  'admin.settings': '设置',
  'admin.backup': '备份',
  'admin.addUser': '添加用户',
  'admin.editUser': '编辑用户',
  'admin.deleteUser': '删除用户',
  'admin.name': '姓名',
  'admin.pin': 'PIN',
  'admin.role': '角色',
  'admin.adminRole': '管理员',
  'admin.userRole': '用户',
  'admin.addAccount': '添加账户',
  'admin.editAccount': '编辑账户',
  'admin.deactivate': '停用',
  'admin.activate': '启用',
  'admin.code': '编码',
  'admin.type': '类型',
  'admin.active': '启用',
  'admin.debitAccount': '借方账户',
  'admin.creditAccount': '贷方账户',
  'admin.balance': '余额',
  'admin.addRow': '添加行',
  'admin.removeRow': '删除',
  'admin.autoBalance': '自动平衡',
  'admin.notBalanced': '借贷必须平衡',
  'admin.journalEntry': '日记账分录',
  'admin.changePin': '修改PIN',
  'admin.oldPin': '当前PIN',
  'admin.newPin': '新PIN',
  'admin.confirmPin': '确认PIN',
  'admin.language': '语言',
  'admin.theme': '主题',
  'admin.light': '浅色',
  'admin.dark': '深色',
  'admin.exportData': '导出数据',
  'admin.importData': '导入数据',
  'admin.confirmImport': '确认导入',
  'admin.importWarning': '这将替换所有现有数据，此操作不可撤销。',
  'admin.openingBalance': '期初余额',
  'admin.resetTransactions': '重置交易',
  'admin.resetTransactionsDesc': '删除所有交易，保留账户和用户',
  'admin.resetTransactionsWarning': '这将永久删除所有交易。此操作不可撤销。',
  'admin.fullFactoryReset': '恢复出厂设置',
  'admin.fullFactoryResetDesc': '删除所有数据并恢复出厂默认值',
  'admin.fullResetWarning': '这将永久删除所有数据，包括用户、账户和交易。您需要从头开始重新设置应用。',
  'admin.typeToConfirm': '输入代码以确认',
  'admin.enterAdminPin': '输入管理员PIN',
  'admin.confirmReset': '确认重置',
  'admin.proceedReset': '继续重置',
  'admin.challengeMismatch': '确认代码不匹配',
  'admin.wrongPin': '管理员PIN码错误',
  'admin.aiSettings': 'AI设置',
  'common.cancel': '取消',
  'common.confirm': '确认',
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.search': '搜索',
  'common.export': '导出',
  'common.import': '导入',
  'common.save': '保存',
  'common.close': '关闭',
  'common.back': '返回',
  'common.success': '成功',
  'common.error': '错误',
  'common.loading': '加载中...',
  'common.noData': '暂无数据',
  'common.confirmDelete': '确定要删除吗？',
  'common.cannotUndo': '此操作不可撤销。',
  'common.edited': '已编辑',
  'common.deleted': '已删除',
  'ai.title': 'AI助手',
  'ai.placeholder': '询问您的财务状况...',
  'ai.thinking': '思考中...',
  'ai.ledger': '分录',
  'ai.debit': '借方',
  'ai.credit': '贷方',
  'ai.changeAccount': '更改账户',
  'ai.keywordFallback': '关键词匹配',
  'ai.verifyAccount': 'AI离线 — 确认前请核对账户',
  'ai.notConfigured': 'AI未配置 — 请前往管理→AI设置配置API密钥',
  'ai.editAmount': '编辑金额',
  'ai.editAmountPrompt': '🗑️ "把最后一笔交易改成5万"',
  'ai.editConfirm': '更新金额',
  'ai.editChangeAmount': '将金额改为',
  'ai.editTo': '为',
  'ai.editSuccess': '✓ 金额更新成功！',
  'nav.home': '首页',
  'nav.reports': '报表',
  'nav.history': '历史',
  'nav.admin': '管理',
  'nav.settings': '设置',
  'nav.logout': '退出',
  'type.asset': '资产',
  'type.cashBank': '现金与银行',
  'type.liability': '负债',
  'type.equity': '权益',
  'type.income': '收入',
  'type.expense': '支出',
  'guide.title': '用户指南',
  'guide.gettingStarted': '入门指南',
  'guide.defaultPin': '默认PIN码：管理员 = 000000，用户 = 111111',
  'guide.overview': '概述',
  'guide.overview.desc': 'FAZAI 是一款简单的收付实现制会计应用，在简洁的收入/支出界面背后运行着复式记账引擎。所有数据使用 IndexedDB 存储在您的设备本地——不会发送到任何服务器。您的财务信息完全保密且安全地保存在您的设备上。该应用可离线使用，并可作为渐进式网络应用（PWA）安装，方便从主屏幕快速访问。',
  'guide.login': '登录与PIN码',
  'guide.login.desc': '输入6位PIN码解锁应用。默认PIN码：管理员 = 000000，用户 = 111111。每个用户都有角色（管理员或用户），控制功能访问权限。管理员可以访问管理面板来管理用户、账户和备份。登录后您可以随时在设置中更改PIN码。',
  'guide.dashboard': '仪表盘',
  'guide.dashboard.desc': '仪表盘显示您当前的余额总计、今日收入和支出总额，以及最近的交易列表。使用绿色的收入按钮和红色的支出按钮快速添加新交易。点击最近的交易可在历史页面查看详情。',
  'guide.incomeExpense': '收入与支出',
  'guide.incomeExpense.desc': '在简洁的表单背后，FAZAI 创建了正确的复式记账分录。对于收入：收入账户贷记，现金/银行账户借记。对于支出：支出账户借记，现金/银行账户贷记。这确保您的账簿始终保持平衡，同时保持界面简单直观。',
  'guide.accounts': '账户',
  'guide.accounts.desc': 'FAZAI 使用6种账户类型：资产、现金/银行、负债、权益、收入和支出。现金/银行账户是资产的特殊子类型，用于交易录入。期初余额作为权益的子项追踪。创建新账户时，您可以选择类型和可选的父账户进行层级分组。',
  'guide.reports': '报表',
  'guide.reports.desc': '所有报表均源自账户变动和分录——数据来源始终是分类账，而非交易类型。',
  'guide.reports.bs': '资产负债表——显示特定月末日期的资产、负债和权益。选择月份和年份生成。',
  'guide.reports.tb': '试算平衡表——列出所有活动账户在特定日期的借贷余额。收入和支出账户显示年初至今（YTD）数据。',
  'guide.reports.pl': '利润表——显示选定期间的收入和支出类别。默认为本月至今（MTD）。可根据需要选择自定义起止日期。',
  'guide.reports.cf': '现金流量表——显示现金/银行账户在选定期间的现金流入和流出。默认为MTD。帮助您了解现金的来源和去向。',
  'guide.reports.ledger': '分类账——按时间顺序显示特定账户的所有分录。选择账户和日期范围查看其交易历史和余额。',
  'guide.admin': '管理面板',
  'guide.admin.desc': '仅管理员用户可访问。管理用户：添加、编辑或删除用户账户并分配角色。管理账户：创建、编辑、启用/停用账户，按类型组织。自定义分录：创建具有特定借方和贷方账户的手动复式记账分录。设置：配置应用偏好。',
  'guide.backup': '备份与恢复',
  'guide.backup.desc': '将所有数据导出为JSON文件以安全保存。导入之前导出的备份以恢复数据。恢复出厂设置：永久删除所有数据。为安全起见，您必须输入随机生成的验证码和管理员PIN码才能确认。这可以防止意外重置。',
  'guide.factoryReset': '恢复出厂设置',
  'guide.factoryResetDesc': '恢复出厂设置将永久删除所有数据。必须输入随机验证码和管理员PIN码才能确认，防止意外重置。',
  'guide.ai': 'AI助手',
  'guide.ai.desc': '浮动的AI聊天按钮让您可以用日常语言记录交易和查询财务！只需输入"买饭50"、"收到工资1万"或"这个月花了多少？"AI就会回应。使用AI前，您需要先配置API密钥：前往管理面板→AI设置，选择提供商（OpenAI、Anthropic、Google、Groq、DeepSeek、Qwen、Kimi或Z.Ai），输入您的API密钥，然后测试连接。您的API密钥仅保存在设备本地，仅发送到您选择的提供商。如果AI不可用，基于关键词的备用方案仍可处理简单交易。',
  'guide.tips': '提示与说明',
  'guide.tips.desc': '所有数据存储在您的设备本地——请定期使用导出功能备份！请勿在浏览器设置中清除网站数据，这会删除您所有的会计记录。保管好您的管理员PIN码——这是恢复出厂设置保护的必要条件。应用在移动设备的竖屏模式下效果最佳。安装为PWA可获得最佳体验和离线支持。',
  'guide.migration': '迁移指南',
  'guide.migration.desc': '按照以下步骤从现有资产负债表设置 FAZAI：\n\n1. 准备最新资产负债表 — 收集最近的资产负债表文件作为参考。\n\n2. 以管理员身份登录 — 使用管理员 PIN 码（默认：000000）访问管理面板。\n\n3. 前往账户部分 — 按照最新资产负债表添加所有账户。为每个账户选择正确的账户类型（资产、现金/银行、负债、权益、收入或支出）并输入当前余额。\n\n4. 核对所有账户 — 仔细核对每个账户的类型和余额。您可以关闭任何未使用的预创建账户。\n\n5. 前往报表 → 资产负债表 — 验证所有数据是否与原始资产负债表一致。总资产应等于负债加权益。\n\n6. 完成 — FAZAI 已准备就绪！开始记录日常收入和支出。',
  'receipt.title': '收据扫描',
  'receipt.processing': '正在读取收据...',
  'receipt.extracted': '从收据提取',
  'receipt.noImage': '未收到图片。请分享图片进行扫描。',
  'receipt.aiNotConfigured': 'AI未配置。请前往管理→AI设置配置API密钥。',
  'receipt.fromReceipt': '从收据扫描预填',
  'receipt.record': '记录交易',
  'receipt.error': '读取收据失败',
  'receipt.retry': '重试',
  'receipt.type': '类型',
  'receipt.reference': '参考号',
};

const translations: Record<Lang, TranslationKeys> = { en, id, zh };

export function t(key: keyof TranslationKeys, lang: Lang): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}

export function getAccountName(account: { name: string; nameId?: string; nameZh?: string }, lang: Lang): string {
  if (lang === 'id' && account.nameId) return account.nameId;
  if (lang === 'zh' && account.nameZh) return account.nameZh;
  return account.name;
}

export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  id: 'Bahasa',
  zh: '中文',
};
