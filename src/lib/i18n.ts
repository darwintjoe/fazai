export type Lang = 'en' | 'id' | 'zh';

type TranslationKeys = {
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

  // History
  'hist.title': string;
  'hist.search': string;
  'hist.filter': string;
  'hist.all': string;
  'hist.noResults': string;
  'hist.detail': string;
  'hist.debit': string;
  'hist.credit': string;

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

  // AI
  'ai.title': string;
  'ai.placeholder': string;
  'ai.thinking': string;

  // Nav
  'nav.home': string;
  'nav.reports': string;
  'nav.history': string;
  'nav.admin': string;
  'nav.settings': string;

  // Account types
  'type.asset': string;
  'type.liability': string;
  'type.equity': string;
  'type.income': string;
  'type.expense': string;
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
  'hist.title': 'Transaction History',
  'hist.search': 'Search...',
  'hist.filter': 'Filter',
  'hist.all': 'All',
  'hist.noResults': 'No transactions found',
  'hist.detail': 'Transaction Detail',
  'hist.debit': 'Debit',
  'hist.credit': 'Credit',
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
  'ai.title': 'AI Assistant',
  'ai.placeholder': 'Ask about your finances...',
  'ai.thinking': 'Thinking...',
  'nav.home': 'Home',
  'nav.reports': 'Reports',
  'nav.history': 'History',
  'nav.admin': 'Admin',
  'nav.settings': 'Settings',
  'type.asset': 'Asset',
  'type.liability': 'Liability',
  'type.equity': 'Equity',
  'type.income': 'Income',
  'type.expense': 'Expense',
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
  'hist.title': 'Riwayat Transaksi',
  'hist.search': 'Cari...',
  'hist.filter': 'Filter',
  'hist.all': 'Semua',
  'hist.noResults': 'Tidak ada transaksi ditemukan',
  'hist.detail': 'Detail Transaksi',
  'hist.debit': 'Debit',
  'hist.credit': 'Kredit',
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
  'ai.title': 'Asisten AI',
  'ai.placeholder': 'Tanya tentang keuangan Anda...',
  'ai.thinking': 'Berpikir...',
  'nav.home': 'Beranda',
  'nav.reports': 'Laporan',
  'nav.history': 'Riwayat',
  'nav.admin': 'Admin',
  'nav.settings': 'Pengaturan',
  'type.asset': 'Aset',
  'type.liability': 'Kewajiban',
  'type.equity': 'Modal',
  'type.income': 'Pendapatan',
  'type.expense': 'Pengeluaran',
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
  'hist.title': '交易历史',
  'hist.search': '搜索...',
  'hist.filter': '筛选',
  'hist.all': '全部',
  'hist.noResults': '未找到交易记录',
  'hist.detail': '交易详情',
  'hist.debit': '借方',
  'hist.credit': '贷方',
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
  'ai.title': 'AI助手',
  'ai.placeholder': '询问您的财务状况...',
  'ai.thinking': '思考中...',
  'nav.home': '首页',
  'nav.reports': '报表',
  'nav.history': '历史',
  'nav.admin': '管理',
  'nav.settings': '设置',
  'type.asset': '资产',
  'type.liability': '负债',
  'type.equity': '权益',
  'type.income': '收入',
  'type.expense': '支出',
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
