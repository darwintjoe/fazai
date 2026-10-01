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
  'dash.mtd': string;
  'dash.lastMonth': string;
  'dash.recentTransactions': string;
  'dash.noTransactions': string;
  'dash.scanReceipt': string;

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
  'rep.contacts': string;
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
  'rep.customer': string;
  'rep.paid': string;
  'rep.unpaid': string;
  'rep.aging': string;
  'rep.outstandingTxns': string;
  'rep.noOutstanding': string;
  'contact.title': string;
  'contact.search': string;
  'contact.add': string;
  'contact.edit': string;
  'contact.name': string;
  'contact.company': string;
  'contact.phone': string;
  'contact.save': string;
  'contact.noFound': string;
  'contact.deactivate': string;
  'contact.activate': string;

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
  'admin.pos': string;
  'admin.addPosConn': string;
  'admin.editPosConn': string;
  'admin.posReportMethod': string;
  'admin.posIncomeAccount': string;
  'admin.posPaymentMap': string;
  'admin.posImportTitle': string;
  'admin.posPickFile': string;
  'admin.posImportDone': string;
  'admin.posSample': string;
  'admin.posEmpty': string;
  'admin.posDeleteConfirm': string;
  'admin.posDevGuide': string;
  'admin.posDownloadSample': string;

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
  'nav.contacts': string;
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

  // Account categories
  'cat.cashbank': string;
  'cat.ar': string;
  'cat.inventory': string;
  'cat.fixedasset': string;
  'cat.accumdepr': string;
  'cat.ap': string;
  'cat.taxpayable': string;
  'cat.taxreceivable': string;
  'cat.otherliability': string;
  'cat.equity': string;
  'cat.income': string;
  'cat.cogs': string;
  'cat.expenses': string;
  'cat.rent': string;
  'cat.depreciation-expense': string;
  'cat.other-income': string;
  'cat.other-expense': string;
  'cat.tax-expense': string;

  // P&L report labels
  'pl.revenue': string;
  'pl.totalRevenue': string;
  'pl.grossProfit': string;
  'pl.totalOpEx': string;
  'pl.ebitdar': string;
  'pl.ebitda': string;
  'pl.depreciation': string;
  'pl.ebt': string;
  'pl.tax': string;
  'pl.cogs': string;
  'pl.opEx': string;
  'pl.rent': string;
  'pl.otherIncomeExpense': string;

  // Guide — intention flow, short user POV
  'guide.title': string;
  'guide.first': string;
  'guide.first.desc': string;
  'guide.setup': string;
  'guide.setup.desc': string;
  'guide.daily': string;
  'guide.daily.desc': string;
  'guide.check': string;
  'guide.check.desc': string;
  'guide.safe': string;
  'guide.safe.desc': string;
  'guide.fix': string;
  'guide.fix.desc': string;

  // Welcome Setup
  'setup.welcomeTitle': string;
  'setup.ownerCaption': string;
  'setup.ownerDesc': string;
  'setup.ownerPlaceholder': string;
  'setup.setPin': string;

  // Receipt / Share Target
  'receipt.title': string;
  'receipt.processing': string;
  'receipt.scanning': string;
  'receipt.parsing': string;
  'receipt.extracted': string;
  'receipt.noImage': string;
  'receipt.aiNotConfigured': string;
  'receipt.fromReceipt': string;
  'receipt.record': string;
  'receipt.error': string;
  'receipt.retry': string;
  'receipt.scanFailed': string;
  'receipt.parseFailed': string;
  'receipt.payWith': string;
  'receipt.type': string;
  'receipt.reference': string;
  'receipt.pickGallery': string;
  'receipt.transactionFailed': string;
  'receipt.transactionFailedHint': string;
  'receipt.recognizedText': string;
  'receipt.tapHint': string;
  'receipt.fieldAmount': string;
  'receipt.fieldDate': string;
  'receipt.fieldCounterparty': string;
  'receipt.fieldDescription': string;
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
  'dash.mtd': 'MTD',
  'dash.lastMonth': 'Last Month',
  'dash.recentTransactions': 'Recent Transactions',
  'dash.noTransactions': 'No transactions yet',
  'dash.scanReceipt': 'Scan Receipt',
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
  'rep.contacts': 'Contacts',
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
  'rep.customer': 'Customer',
  'rep.paid': 'Total Paid',
  'rep.unpaid': 'Total Unpaid',
  'rep.aging': 'Aging',
  'rep.outstandingTxns': 'Outstanding transactions',
  'rep.noOutstanding': 'No outstanding transactions.',
  'contact.title': 'Contacts',
  'contact.search': 'Search name, company, phone',
  'contact.add': 'Add',
  'contact.edit': 'Edit contact',
  'contact.name': 'Name',
  'contact.company': 'Company (optional)',
  'contact.phone': 'Phone (optional)',
  'contact.save': 'Save',
  'contact.noFound': 'No contacts found',
  'contact.deactivate': 'Deactivate',
  'contact.activate': 'Activate',
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
  'admin.pos': 'POS',
  'admin.addPosConn': 'Add POS',
  'admin.editPosConn': 'Edit POS',
  'admin.posReportMethod': 'Report Method',
  'admin.posIncomeAccount': 'Income Account',
  'admin.posPaymentMap': 'Payment Mapping',
  'admin.posImportTitle': 'Import POS Sales',
  'admin.posPickFile': 'Select JSON file',
  'admin.posImportDone': 'Import complete',
  'admin.posSample': 'Sample',
  'admin.posEmpty': 'No POS connections yet. Add one to start importing sales.',
  'admin.posDeleteConfirm': 'Delete this POS connection and all its import history? The recorded transactions stay.',
  'admin.posDevGuide': 'Dev Guide',
  'admin.posDownloadSample': 'Download sample file',
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
  'nav.contacts': 'Contacts',
  'nav.admin': 'Admin',
  'nav.settings': 'Settings',
  'nav.logout': 'Logout',
  'type.asset': 'Asset',
  'type.cashBank': 'Cash & Bank',
  'type.liability': 'Liability',
  'type.equity': 'Equity',
  'type.income': 'Income',
  'type.expense': 'Expense',
  'cat.cashbank': 'Cash & Bank',
  'cat.ar': 'Accounts Receivable',
  'cat.inventory': 'Inventory',
  'cat.fixedasset': 'Fixed Asset',
  'cat.accumdepr': 'Accumulated Depreciation',
  'cat.ap': 'Accounts Payable',
  'cat.taxpayable': 'Tax Payable',
  'cat.taxreceivable': 'Tax Receivable',
  'cat.otherliability': 'Other Liabilities',
  'cat.equity': 'Equity',
  'cat.income': 'Income',
  'cat.cogs': 'Cost of Goods Sold',
  'cat.expenses': 'Operating Expenses',
  'cat.rent': 'Rent',
  'cat.depreciation-expense': 'Depreciation Expense',
  'cat.other-income': 'Other Income',
  'cat.other-expense': 'Other Expense',
  'cat.tax-expense': 'Tax Expense',
  'pl.revenue': 'Revenue',
  'pl.totalRevenue': 'Total Revenue',
  'pl.grossProfit': 'Gross Profit',
  'pl.totalOpEx': 'Total Operating Expenses',
  'pl.ebitdar': 'EBITDAR',
  'pl.ebitda': 'EBITDA',
  'pl.depreciation': 'Depreciation',
  'pl.ebt': 'Earnings Before Tax',
  'pl.tax': 'Tax Expense',
  'pl.cogs': 'Cost of Goods Sold',
  'pl.opEx': 'Operating Expenses',
  'pl.rent': 'Rent',
  'pl.otherIncomeExpense': 'Other Income & Expense',
  'guide.title': 'User Guide',
  'guide.first': '1. First Time Open',
  'guide.first.desc': '1. Install as app for best use: tap Install on the dashboard or Settings. Works offline.\n2. Enter your name / business name — it prints on reports.\n3. Set your 6-digit PIN. You can reuse your old PIN.\n4. Log in with PIN. Change it later in Settings.',
  'guide.setup': '2. Set Up Your Books',
  'guide.setup.desc': 'Admin only.\n1. Accounts: add what you need, turn off what you don\'t use.\n2. Users: Admin manages everything. User only records.\n3. Have an old list? Import CSV, PDF, or photo (max 5MB). For best result: one name per row, with balance. Check the type before Save.',
  'guide.daily': '3. Daily Record',
  'guide.daily.desc': 'Tap red Income or gray Expense. Or tap the chat bubble in the balance card and type like "lunch 25k".\nFrom / To = who: type a name to find a saved contact, or save as new with company + phone.\nAccount = what kind. Cash/Bank = which wallet.\nAsk Admin to set the AI key once in Admin → AI Settings.',
  'guide.check': '4. Check Your Money',
  'guide.check.desc': 'Dashboard shows this month + last month.\nHistory: search and fix one entry.\nContacts → Statement: see who still owes.\nReports → Export PDF / XLSX to share.',
  'guide.safe': '5. Keep Data Safe',
  'guide.safe.desc': 'Every week: Admin → Backup → Export. Save the file to Drive, email, or chat to yourself.\nMove phone: Import that file on the new device.\nNever clear browser site data — it erases everything.',
  'guide.fix': '6. Fix Problems',
  'guide.fix.desc': 'Delete one: entry turns gray, excluded from totals.\nReset Transactions: deletes all records, keeps accounts + users.\nFactory Reset: erases everything. Needs code + Admin PIN.\nBack up first before any reset.',
  'setup.welcomeTitle': 'Welcome to FAZAI',
  'setup.ownerCaption': 'This Database belongs to',
  'setup.ownerDesc': 'Owner name will be used when print Report',
  'setup.ownerPlaceholder': 'Enter owner name',
  'setup.setPin': 'Set your PIN',
  'receipt.title': 'Receipt Scanner',
  'receipt.processing': 'Reading receipt...',
  'receipt.scanning': 'Scanning receipt...',
  'receipt.parsing': 'Processing receipt data...',
  'receipt.extracted': 'Extracted from receipt',
  'receipt.noImage': 'No image received. Please share an image to scan.',
  'receipt.aiNotConfigured': 'AI is not configured. Please go to Admin → AI Settings to set up an API key first.',
  'receipt.fromReceipt': 'Pre-filled from receipt scan',
  'receipt.record': 'Record Transaction',
  'receipt.error': 'Failed to read receipt',
  'receipt.retry': 'Retry',
  'receipt.scanFailed': 'Could not read text from receipt. Try a clearer photo.',
  'receipt.parseFailed': 'Could not parse receipt data. You can fill in the details manually.',
  'receipt.type': 'Type',
  'receipt.reference': 'Reference',
  'receipt.pickGallery': 'Pick from Gallery',
  'receipt.payWith': 'Pay with',
  'receipt.transactionFailed': 'This receipt shows "Transaction Failed"',
  'receipt.transactionFailedHint': 'The payment did not go through. No transaction was recorded.',
  'receipt.recognizedText': 'Recognized text',
  'receipt.tapHint': 'Tap a line, then choose a field to fill',
  'receipt.fieldAmount': 'Amount',
  'receipt.fieldDate': 'Date',
  'receipt.fieldCounterparty': 'Name',
  'receipt.fieldDescription': 'Description',
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
  'dash.mtd': 'Bulan Ini',
  'dash.lastMonth': 'Bulan Lalu',
  'dash.recentTransactions': 'Transaksi Terakhir',
  'dash.noTransactions': 'Belum ada transaksi',
  'dash.scanReceipt': 'Pindai Struk',
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
  'rep.contacts': 'Kontak',
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
  'rep.customer': 'Pelanggan',
  'rep.paid': 'Total Dibayar',
  'rep.unpaid': 'Total Belum Dibayar',
  'rep.aging': 'Umur',
  'rep.outstandingTxns': 'Transaksi belum dibayar',
  'rep.noOutstanding': 'Tidak ada transaksi belum dibayar.',
  'contact.title': 'Kontak',
  'contact.search': 'Cari nama, perusahaan, telepon',
  'contact.add': 'Tambah',
  'contact.edit': 'Edit kontak',
  'contact.name': 'Nama',
  'contact.company': 'Perusahaan (opsional)',
  'contact.phone': 'Telepon (opsional)',
  'contact.save': 'Simpan',
  'contact.noFound': 'Tidak ada kontak',
  'contact.deactivate': 'Nonaktifkan',
  'contact.activate': 'Aktifkan',
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
  'admin.pos': 'POS',
  'admin.addPosConn': 'Tambah POS',
  'admin.editPosConn': 'Edit POS',
  'admin.posReportMethod': 'Metode Laporan',
  'admin.posIncomeAccount': 'Akun Pendapatan',
  'admin.posPaymentMap': 'Pemetaan Pembayaran',
  'admin.posImportTitle': 'Impor Penjualan POS',
  'admin.posPickFile': 'Pilih file JSON',
  'admin.posImportDone': 'Impor selesai',
  'admin.posSample': 'Contoh',
  'admin.posEmpty': 'Belum ada koneksi POS. Tambahkan satu untuk mulai mengimpor penjualan.',
  'admin.posDeleteConfirm': 'Hapus koneksi POS ini beserta riwayat impornya? Transaksi yang sudah dicatat tetap utuh.',
  'admin.posDevGuide': 'Panduan Dev',
  'admin.posDownloadSample': 'Unduh file contoh',
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
  'nav.contacts': 'Kontak',
  'nav.admin': 'Admin',
  'nav.settings': 'Pengaturan',
  'nav.logout': 'Keluar',
  'type.asset': 'Aset',
  'type.cashBank': 'Kas & Bank',
  'type.liability': 'Kewajiban',
  'type.equity': 'Modal',
  'type.income': 'Pendapatan',
  'type.expense': 'Pengeluaran',
  'cat.cashbank': 'Kas & Bank',
  'cat.ar': 'Piutang Usaha',
  'cat.inventory': 'Persediaan',
  'cat.fixedasset': 'Aset Tetap',
  'cat.accumdepr': 'Akumulasi Depresiasi',
  'cat.ap': 'Utang Usaha',
  'cat.taxpayable': 'Pajak Harus Dibayar',
  'cat.taxreceivable': 'Pajak Dibayar Dimuka',
  'cat.otherliability': 'Kewajiban Lainnya',
  'cat.equity': 'Modal',
  'cat.income': 'Pendapatan',
  'cat.cogs': 'Harga Pokok Penjualan',
  'cat.expenses': 'Biaya Operasional',
  'cat.rent': 'Sewa',
  'cat.depreciation-expense': 'Biaya Depresiasi',
  'cat.other-income': 'Pendapatan Lainnya',
  'cat.other-expense': 'Pengeluaran Lainnya',
  'cat.tax-expense': 'Beban Pajak',
  'pl.revenue': 'Pendapatan',
  'pl.totalRevenue': 'Total Pendapatan',
  'pl.grossProfit': 'Laba Kotor',
  'pl.totalOpEx': 'Total Biaya Operasional',
  'pl.ebitdar': 'EBITDAR',
  'pl.ebitda': 'EBITDA',
  'pl.depreciation': 'Depresiasi',
  'pl.ebt': 'Laba Sebelum Pajak',
  'pl.tax': 'Beban Pajak',
  'pl.cogs': 'Harga Pokok Penjualan',
  'pl.opEx': 'Biaya Operasional',
  'pl.rent': 'Sewa',
  'pl.otherIncomeExpense': 'Pendapatan & Beban Lain',
  'guide.title': 'Panduan Pengguna',
  'guide.first': '1. Pertama Kali Buka',
  'guide.first.desc': '1. Instal sebagai aplikasi: ketuk Instal di dasbor atau Pengaturan. Bisa offline.\n2. Isi nama / usaha — tercetak di laporan.\n3. Atur PIN 6 digit. Boleh pakai PIN lama.\n4. Masuk dengan PIN. Ubah lagi nanti di Pengaturan.',
  'guide.setup': '2. Siapkan Pembukuan',
  'guide.setup.desc': 'Khusus Admin.\n1. Akun: tambah yang perlu, matikan yang tidak dipakai.\n2. Pengguna: Admin mengatur semua. Pengguna hanya mencatat.\n3. Punya daftar lama? Impor CSV, PDF, atau foto (maks 5MB). Agar berhasil: satu nama per baris + saldo. Periksa jenis sebelum Simpan.',
  'guide.daily': '3. Catat Harian',
  'guide.daily.desc': 'Ketuk Pendapatan merah atau Pengeluaran abu-abu. Atau ketuk gelembung chat di kartu saldo, ketik misal "makan 25rb".\nDari / Ke = siapa: ketik nama untuk cari kontak, atau simpan baru + perusahaan / telepon.\nAkun = jenis apa. Kas/Bank = dompet mana.\nMinta Admin isi kunci AI sekali di Admin → Pengaturan AI.',
  'guide.check': '4. Cek Keuangan',
  'guide.check.desc': 'Dasbor tampilkan total bulan ini + bulan lalu.\nRiwayat: cari dan perbaiki satu entri.\nKontak → Pernyataan: lihat siapa belum bayar.\nLaporan → Ekspor PDF / XLSX untuk bagikan.',
  'guide.safe': '5. Jaga Data Aman',
  'guide.safe.desc': 'Tiap minggu: Admin → Cadangan → Ekspor. Simpan ke Drive, email, atau chat sendiri.\nPindah HP: Impor file itu di perangkat baru.\nJangan hapus data situs browser — semua hilang.',
  'guide.fix': '6. Atasi Masalah',
  'guide.fix.desc': 'Hapus satu: entri jadi abu-abu, tidak dihitung.\nReset Transaksi: hapus semua catatan, akun + pengguna tetap.\nReset Pabrik: hapus semua. Perlu kode + PIN Admin.\nCadangkan dulu sebelum reset.',
  'setup.welcomeTitle': 'Selamat Datang di FAZAI',
  'setup.ownerCaption': 'Database ini milik',
  'setup.ownerDesc': 'Nama pemilik akan digunakan saat cetak Laporan',
  'setup.ownerPlaceholder': 'Masukkan nama pemilik',
  'setup.setPin': 'Atur PIN Anda',
  'receipt.title': 'Pemindai Struk',
  'receipt.processing': 'Membaca struk...',
  'receipt.scanning': 'Memindai struk...',
  'receipt.parsing': 'Memproses data struk...',
  'receipt.extracted': 'Diekstrak dari struk',
  'receipt.noImage': 'Tidak ada gambar diterima. Silakan bagikan gambar untuk dipindai.',
  'receipt.aiNotConfigured': 'AI belum dikonfigurasi. Silakan buka Admin → Pengaturan AI untuk mengatur API key terlebih dahulu.',
  'receipt.fromReceipt': 'Prasiswa dari pemindaian struk',
  'receipt.record': 'Catat Transaksi',
  'receipt.error': 'Gagal membaca struk',
  'receipt.retry': 'Coba Lagi',
  'receipt.scanFailed': 'Tidak dapat membaca teks dari struk. Coba foto yang lebih jelas.',
  'receipt.parseFailed': 'Tidak dapat memproses data struk. Anda dapat mengisi detail secara manual.',
  'receipt.type': 'Jenis',
  'receipt.reference': 'Referensi',
  'receipt.pickGallery': 'Pilih dari Galeri',
  'receipt.payWith': 'Bayar dengan',
  'receipt.transactionFailed': 'Struk ini menunjukkan "Transaksi Gagal"',
  'receipt.transactionFailedHint': 'Pembayaran tidak berhasil. Tidak ada transaksi yang tercatat.',
  'receipt.recognizedText': 'Teks yang dikenali',
  'receipt.tapHint': 'Ketuk satu baris, lalu pilih kolom untuk diisi',
  'receipt.fieldAmount': 'Jumlah',
  'receipt.fieldDate': 'Tanggal',
  'receipt.fieldCounterparty': 'Nama',
  'receipt.fieldDescription': 'Keterangan',
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
  'dash.mtd': '本月',
  'dash.lastMonth': '上月',
  'dash.recentTransactions': '最近交易',
  'dash.noTransactions': '暂无交易记录',
  'dash.scanReceipt': '扫描收据',
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
  'rep.contacts': '联系人',
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
  'rep.customer': '客户',
  'rep.paid': '已付总额',
  'rep.unpaid': '未付总额',
  'rep.aging': '账龄',
  'rep.outstandingTxns': '未结交易',
  'rep.noOutstanding': '无未结交易。',
  'contact.title': '联系人',
  'contact.search': '搜索名称、公司、电话',
  'contact.add': '添加',
  'contact.edit': '编辑联系人',
  'contact.name': '名称',
  'contact.company': '公司（可选）',
  'contact.phone': '电话（可选）',
  'contact.save': '保存',
  'contact.noFound': '未找到联系人',
  'contact.deactivate': '停用',
  'contact.activate': '启用',
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
  'admin.pos': 'POS',
  'admin.addPosConn': '添加POS',
  'admin.editPosConn': '编辑POS',
  'admin.posReportMethod': '报告方式',
  'admin.posIncomeAccount': '收入账户',
  'admin.posPaymentMap': '付款映射',
  'admin.posImportTitle': '导入POS销售',
  'admin.posPickFile': '选择JSON文件',
  'admin.posImportDone': '导入完成',
  'admin.posSample': '示例',
  'admin.posEmpty': '暂无POS连接。添加一个即可开始导入销售。',
  'admin.posDeleteConfirm': '删除此POS连接及其所有导入记录？已记录的交易将保留。',
  'admin.posDevGuide': '开发指南',
  'admin.posDownloadSample': '下载示例文件',
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
  'nav.contacts': '联系人',
  'nav.admin': '管理',
  'nav.settings': '设置',
  'nav.logout': '退出',
  'type.asset': '资产',
  'type.cashBank': '现金与银行',
  'type.liability': '负债',
  'type.equity': '权益',
  'type.income': '收入',
  'type.expense': '支出',
  'cat.cashbank': '现金与银行',
  'cat.ar': '应收账款',
  'cat.inventory': '库存',
  'cat.fixedasset': '固定资产',
  'cat.accumdepr': '累计折旧',
  'cat.ap': '应付账款',
  'cat.taxpayable': '应付税款',
  'cat.taxreceivable': '应收税款',
  'cat.otherliability': '其他负债',
  'cat.equity': '权益',
  'cat.income': '收入',
  'cat.cogs': '销售成本',
  'cat.expenses': '运营费用',
  'cat.rent': '租金',
  'cat.depreciation-expense': '折旧费用',
  'cat.other-income': '其他收入',
  'cat.other-expense': '其他支出',
  'cat.tax-expense': '税费',
  'pl.revenue': '收入',
  'pl.totalRevenue': '总收入',
  'pl.grossProfit': '毛利润',
  'pl.totalOpEx': '运营费用合计',
  'pl.ebitdar': 'EBITDAR',
  'pl.ebitda': 'EBITDA',
  'pl.depreciation': '折旧',
  'pl.ebt': '税前利润',
  'pl.tax': '税费',
  'pl.cogs': '销售成本',
  'pl.opEx': '运营费用',
  'pl.rent': '租金',
  'pl.otherIncomeExpense': '其他收入与费用',
  'guide.title': '用户指南',
  'guide.first': '1. 首次打开',
  'guide.first.desc': '1. 安装为应用最好用：在首页或设置点安装。可离线使用。\n2. 输入名字 / 店名 — 会印在报表上。\n3. 设置6位PIN，可用旧PIN。\n4. 用PIN登录，之后可在设置更改。',
  'guide.setup': '2. 设置账本',
  'guide.setup.desc': '仅管理员。\n1. 科目：添加需要的，关闭不用的。\n2. 用户：管理员管理全部，普通用户只记账。\n3. 有旧清单？导入CSV、PDF或照片（最大5MB）。建议：一行一个名称+余额，保存前核对分类。',
  'guide.daily': '3. 日常记账',
  'guide.daily.desc': '点红色收入或灰色支出。或点余额卡片里的聊天气泡，输入如“午饭50”。\n来自 / 付给 = 谁：输入名字查找，或新建并加公司/电话。\n科目 = 哪类，现金/银行 = 哪个钱包。\n让管理员在 管理→AI设置 填一次API密钥。',
  'guide.check': '4. 查看账目',
  'guide.check.desc': '首页显示本月+上月合计。\n历史：搜索并修改一笔。\n联系人→对账单：看谁还没付。\n报表→导出PDF / XLSX分享。',
  'guide.safe': '5. 保护数据',
  'guide.safe.desc': '每周一次：管理→备份→导出。存到云盘、邮箱或发给自己。\n换手机：在新设备导入该文件。\n不要清除浏览器网站数据 — 会全部删除。',
  'guide.fix': '6. 解决问题',
  'guide.fix.desc': '删除一笔：变灰，不计入合计。\n重置交易：删除全部记录，保留科目+用户。\n恢复出厂：删除全部，需验证码+管理员PIN。\n重置前先备份。',
  'setup.welcomeTitle': '欢迎使用 FAZAI',
  'setup.ownerCaption': '此数据库属于',
  'setup.ownerDesc': '所有者姓名将用于打印报表时显示',
  'setup.ownerPlaceholder': '请输入所有者姓名',
  'setup.setPin': '设置您的PIN码',
  'receipt.title': '收据扫描',
  'receipt.processing': '正在读取收据...',
  'receipt.scanning': '正在扫描收据...',
  'receipt.parsing': '正在处理收据数据...',
  'receipt.extracted': '从收据提取',
  'receipt.noImage': '未收到图片。请分享图片进行扫描。',
  'receipt.aiNotConfigured': 'AI未配置。请前往管理→AI设置配置API密钥。',
  'receipt.fromReceipt': '从收据扫描预填',
  'receipt.record': '记录交易',
  'receipt.error': '读取收据失败',
  'receipt.retry': '重试',
  'receipt.scanFailed': '无法读取收据文字。请尝试更清晰的照片。',
  'receipt.parseFailed': '无法处理收据数据。您可以手动填写详细信息。',
  'receipt.type': '类型',
  'receipt.reference': '参考号',
  'receipt.pickGallery': '从相册选择',
  'receipt.payWith': '支付方式',
  'receipt.transactionFailed': '此收据显示"交易失败"',
  'receipt.transactionFailedHint': '支付未成功。未记录任何交易。',
  'receipt.recognizedText': '识别文字',
  'receipt.tapHint': '点击一行，然后选择要填入的字段',
  'receipt.fieldAmount': '金额',
  'receipt.fieldDate': '日期',
  'receipt.fieldCounterparty': '名称',
  'receipt.fieldDescription': '备注',
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
