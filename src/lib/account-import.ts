import { parseSmartAmount } from './keyword-map';
import type { Account, AccountCategory } from './fazai-db';

export interface ParsedAccountRow {
  id: string;
  name: string;
  categoryId: string | null;
  categoryGuessed: boolean;
  balance: number | null;
  needsCategoryConfirm: boolean;
  raw: string[];
}

export interface ColumnMap {
  name: number;
  category: number | null;
  balance: number | null;
}

const NAME_KEYS = ['account name', 'account', 'name', 'nama akun', 'nama', 'nama account', 'akun', '账户', '科目', '名称', '户名'];
const CAT_KEYS = ['category', 'kategori', 'type', 'tipe', 'jenis', 'group', '分类', '类别'];
const BAL_KEYS = ['balance', 'saldo', 'amount', 'nominal', 'opening', 'saldo awal', 'opening balance', '余额', '金额', 'nilai'];

const FOOTER_RE = /^(total|page|halaman|end of|catatan|note|printed|tanggal cetak|dicetak|grand total|jumlah)\b/i;

const CAT_KEYWORDS: Array<{ re: RegExp; cat: string }> = [
  { re: /cash|bank|kas/i, cat: 'cat-cashbank' },
  { re: /receivable|piutang/i, cat: 'cat-ar' },
  { re: /invent|persedia/i, cat: 'cat-inventory' },
  { re: /accum|akumul.*depres|akum.*dep/i, cat: 'cat-accumdepr' },
  { re: /payable.*tax|pajak.*bayar|ppn keluaran|pph/i, cat: 'cat-taxpayable' },
  { re: /payable|utang dagang|utang usaha/i, cat: 'cat-ap' },
  { re: /tax receiv|pajak dibayar|ppn masukan/i, cat: 'cat-taxreceivable' },
  { re: /liabilit|kewajiban|utang lain/i, cat: 'cat-otherliability' },
  { re: /equit|modal|ekuitas/i, cat: 'cat-equity' },
  { re: /cogs|hpp|harga pokok|销售成本/i, cat: 'cat-cogs' },
  { re: /rent|sewa|租金/i, cat: 'cat-rent' },
  { re: /depreciation expense|biaya depresiasi|beban.*depresiasi/i, cat: 'cat-depreciation-expense' },
  { re: /other income|pendapatan lain/i, cat: 'cat-other-income' },
  { re: /other expense|pengeluaran lain|beban lain/i, cat: 'cat-other-expense' },
  { re: /tax expense|beban pajak/i, cat: 'cat-tax-expense' },
  { re: /income|pendapatan|penjualan|sales|revenue/i, cat: 'cat-income' },
  { re: /expense|biaya|beban|operasional/i, cat: 'cat-expenses' },
  { re: /fixed|tetap|equipment|peralatan|furniture|kendaraan|aset/i, cat: 'cat-fixedasset' },
];

export function toTitleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => (w.length === 0 ? w : w[0].toLocaleUpperCase() + w.slice(1)))
    .join(' ');
}

export function normalizeName(s: string): string {
  return s.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function matchCategoryCell(cell: string, categories: AccountCategory[]): string | null {
  const n = normalizeName(cell);
  if (!n) return null;
  for (const c of categories) {
    const candidates = [c.id, c.id.replace(/^cat-/, ''), c.name, c.nameId ?? '', c.nameZh ?? ''].map(x => normalizeName(x));
    if (candidates.includes(n)) return c.id;
  }
  for (const { re, cat } of CAT_KEYWORDS) {
    if (re.test(cell) && categories.some(c => c.id === cat)) return cat;
  }
  // substring fallback against category names
  for (const c of categories) {
    const names = [c.name, c.nameId ?? '', c.nameZh ?? ''].map(x => normalizeName(x)).filter(Boolean);
    if (names.some(x => x.length > 3 && (n.includes(x) || x.includes(n)))) return c.id;
  }
  return null;
}

function scoreHeaderCell(cell: string, keys: string[]): boolean {
  const n = normalizeName(cell);
  return keys.some(k => n === k || n.includes(k));
}

export function findHeaderRow(rows: string[][]): { index: number; map: ColumnMap } | null {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i].map(c => c.trim()).filter(c => c.length > 0);
    if (cells.length < 1) continue;
    const single = cells.length === 1;
    const match = (cell: string, keys: string[]) => {
      const n = normalizeName(cell);
      // Single-cell title rows ("PT Maju - Chart of Accounts" contains "account")
      // must match exactly, otherwise any title with "account" becomes a header.
      if (single) return keys.some(k => n === k);
      return keys.some(k => n === k || n.includes(k));
    };
    let name = -1;
    let cat: number | null = null;
    let bal: number | null = null;
    rows[i].forEach((c, idx) => {
      if (name === -1 && match(c, NAME_KEYS)) name = idx;
      else if (cat === null && match(c, CAT_KEYS)) cat = idx;
      else if (bal === null && match(c, BAL_KEYS)) bal = idx;
    });
    if (name !== -1) return { index: i, map: { name, category: cat, balance: bal } };
  }
  return null;
}

function hasDigit(s: string): boolean {
  return /\d/.test(s);
}

export function parseBalanceCell(cell: string): number | null {
  if (!cell || !cell.trim()) return null;
  if (!hasDigit(cell)) return null;
  const v = parseSmartAmount(cell);
  // parseSmartAmount returns 0 on failure; distinguish "0" from garbage
  if (v === 0) {
    return /^[\sRpIDR.,0-]+$/i.test(cell.trim()) ? 0 : null;
  }
  return v;
}

/** Split a free-text line (PDF/OCR) into cells. */
export function splitLineToCells(line: string): string[] {
  const t = line.trim();
  if (!t) return [];
  if (t.includes('\t')) return t.split('\t').map(s => s.trim());
  if (t.includes('|')) return t.split('|').map(s => s.trim());
  if (/ {2,}/.test(t)) return t.split(/ {2,}/).map(s => s.trim());
  if (t.includes(';')) return t.split(';').map(s => s.trim());
  // comma only if it looks tabular (3+ commas or header keywords present)
  const commas = (t.match(/,/g) || []).length;
  if (commas >= 2) return t.split(',').map(s => s.trim());
  return [t];
}

export function textToRows(text: string): string[][] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(splitLineToCells)
    .filter(cells => cells.length > 0 && cells.some(c => c.length > 0));
}

function guessPositionalMap(cells: string[]): ColumnMap {
  if (cells.length === 1) return { name: 0, category: null, balance: null };
  const numericIdx = cells.map((c, i) => ({ c, i })).filter(({ c }) => hasDigit(c)).map(({ i }) => i);
  if (cells.length === 2) {
    if (numericIdx.length === 1) {
      const bal = numericIdx[0];
      return { name: bal === 0 ? 1 : 0, category: null, balance: bal };
    }
    return { name: 0, category: 1, balance: null };
  }
  // 3+ cells: name = first non-numeric, balance = last numeric, category = other text
  const nonNumeric = cells.map((c, i) => ({ c, i })).filter(({ c }) => !hasDigit(c)).map(({ i }) => i);
  const name = nonNumeric[0] ?? 0;
  const balance = numericIdx.length > 0 ? numericIdx[numericIdx.length - 1] : null;
  let category: number | null = null;
  for (const i of nonNumeric) {
    if (i !== name) {
      category = i;
      break;
    }
  }
  return { name, category, balance };
}

export function rowsToAccounts(
  rows: string[][],
  categories: AccountCategory[],
  fallbackCategoryId = 'cat-other-expense',
): ParsedAccountRow[] {
  const header = findHeaderRow(rows);
  const startIdx = header ? header.index + 1 : 0;
  const out: ParsedAccountRow[] = [];
  let uid = 0;

  for (let r = startIdx; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.every(c => !c.trim())) continue;
    const joined = cells.join(' ').trim();
    if (!joined || FOOTER_RE.test(joined)) continue;
    // skip repeated header rows
    if (header && r !== header.index) {
      const map = header.map;
      const nameCell = (cells[map.name] ?? '').trim();
      if (scoreHeaderCell(nameCell, NAME_KEYS)) continue;
    }

    const map: ColumnMap = header ? header.map : guessPositionalMap(cells);
    const rawName = (cells[map.name] ?? '').trim();
    if (!rawName || FOOTER_RE.test(rawName)) continue;
    // name cell that is purely numeric is not an account
    if (/^[\d.,\sRp-]+$/i.test(rawName) && rawName.replace(/[\d.,\sRp-]/gi, '').length === 0) continue;

    const catCell = map.category !== null ? (cells[map.category] ?? '').trim() : '';
    const balCell = map.balance !== null ? (cells[map.balance] ?? '').trim() : '';

    let categoryId: string | null = catCell ? matchCategoryCell(catCell, categories) : null;
    let guessed = false;
    if (!categoryId && catCell) {
      // free-text category: keyword guess already failed -> leave null, will fallback below
      guessed = true;
    }
    if (!categoryId && !catCell) {
      categoryId = matchCategoryCell(rawName, categories);
      if (categoryId) guessed = true;
    }
    const needsConfirm = !categoryId || guessed;
    if (!categoryId) categoryId = fallbackCategoryId;

    out.push({
      id: `parsed-${uid++}`,
      name: toTitleCase(rawName),
      categoryId,
      categoryGuessed: needsConfirm,
      balance: parseBalanceCell(balCell),
      needsCategoryConfirm: needsConfirm,
      raw: cells,
    });
  }
  return out;
}

export interface ExistingMatch {
  account: Account;
  sameCategory: boolean;
}

export function matchExisting(name: string, accounts: Account[]): ExistingMatch | null {
  const n = normalizeName(name);
  if (!n) return null;
  for (const a of accounts) {
    const candidates = [a.name, a.nameId ?? '', a.nameZh ?? ''].map(normalizeName);
    if (candidates.includes(n)) return { account: a, sameCategory: true };
  }
  return null;
}

/** Fuzzy dup: normalized match OR one contains the other (min 4 chars). */
export function matchExistingFuzzy(name: string, accounts: Account[]): Account | null {
  const n = normalizeName(name);
  if (!n) return null;
  for (const a of accounts) {
    const candidates = [a.name, a.nameId ?? '', a.nameZh ?? ''].map(normalizeName).filter(Boolean);
    for (const c of candidates) {
      if (c === n) return a;
      if (c.length >= 4 && n.length >= 4 && (c.includes(n) || n.includes(c))) return a;
    }
  }
  return null;
}
