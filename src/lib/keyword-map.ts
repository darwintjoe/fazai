/**
 * Shared keyword map and extraction utilities for receipt parsing.
 * Used by:
 *   - /api/ai/chat route (keywordFallback)
 *   - /api/ai/parse-receipt route (local regex fallback)
 */

export interface AccountInfo {
  id: string;
  name: string;
  nameId?: string;
  nameZh?: string;
  type: string;
  code: string;
}

// Keyword → account code mapping
export const keywordMap: Record<string, string> = {
  // Income keywords
  'salary': '4-2000', 'gaji': '4-2000', '工资': '4-2000', 'pay': '4-2000', 'wage': '4-2000',
  'freelance': '4-3000', 'project': '4-3000', 'contract': '4-3000',
  'sales': '4-1000', 'penjualan': '4-1000', '销售': '4-1000', 'sold': '4-1000', 'sell': '4-1000',
  'interest': '4-4000', 'bunga': '4-4000', '利息': '4-4000', 'dividend': '4-4000',
  'other income': '4-9000', 'pendapatan lainnya': '4-9000', '其他收入': '4-9000',
  // Expense keywords
  'cogs': '5-0100', 'hpp': '5-0100', 'harga pokok': '5-0100', '销售成本': '5-0100',
  'food': '5-1100', 'makan': '5-1100', '吃': '5-1100', 'restaurant': '5-1100', 'grocery': '5-1100',
  'coffee': '5-1100', 'lunch': '5-1100', 'dinner': '5-1100', 'breakfast': '5-1100',
  'transport': '5-1200', 'gas': '5-1200', 'fuel': '5-1200', 'taxi': '5-1200', 'uber': '5-1200',
  '交通': '5-1200', 'bensin': '5-1200', 'parking': '5-1200',
  'electricity': '5-1300', 'water': '5-1300', 'internet': '5-1300', 'phone': '5-1300',
  'listrik': '5-1300', 'utilitas': '5-1300', '水费': '5-1300',
  'rent': '5-2100', 'sewa': '5-2100', '租金': '5-2100', 'apartment': '5-2100',
  'movie': '5-1500', 'game': '5-1500', 'entertainment': '5-1500', 'hiburan': '5-1500', '娱乐': '5-1500',
  'doctor': '5-1600', 'medicine': '5-1600', 'hospital': '5-1600', 'health': '5-1600',
  'kesehatan': '5-1600', '医疗': '5-1600', 'pharmacy': '5-1600',
  'shopping': '5-1700', 'clothes': '5-1700', 'belanja': '5-1700', '购物': '5-1700',
  'course': '5-1800', 'school': '5-1800', 'education': '5-1800', 'pendidikan': '5-1800', '教育': '5-1800',
  'book': '5-1800', 'training': '5-1800',
  'depreciation': '5-3100', 'depresiasi': '5-3100', '折旧': '5-3100',
  'other expense': '5-9000', 'pengeluaran lainnya': '5-9000', '其他支出': '5-9000',
  'tax': '5-4100', 'pajak': '5-4100', '税费': '5-4100', 'income tax': '5-4100',
};

// Payment method keyword → opponent account ID
const paymentMethodKeywords: Array<{ keywords: string[]; accountId: string }> = [
  { keywords: ['qris', 'qr payment', 'gopay', 'ovo', 'dana', 'shopeepay', 'linkaja', 'ewallet', 'e-wallet'], accountId: 'acc-qris' },
  { keywords: ['debit', 'edc', 'mpos', 'kartu debit', 'pos terminal'], accountId: 'acc-bank' },
  { keywords: ['credit card', 'kartu kredit', 'visa', 'mastercard', 'cc '], accountId: 'acc-credit-card' },
  { keywords: ['tunai', 'cash'], accountId: 'acc-cash' },
  { keywords: ['transfer', 'bank transfer', 'tf'], accountId: 'acc-bank' },
];

/** Extract amount from text, handling Indonesian formatting and slang. */
export function extractAmountFromText(text: string): { amount: number; amountStr: string } | null {
  const lower = text.toLowerCase();

  // Indonesian slang multipliers
  const jutaMatch = lower.match(/(\d[\d.,]*)\s*juta/);
  const ribuMatch = lower.match(/(\d[\d.,]*)\s*(ribu|rb)\b/);
  const kMatch = lower.match(/(\d[\d.,]*)k\b/);
  const plainMatch = lower.match(/(?:rp\.?|idr)\s*(\d[\d.,]*)/i);
  const numberMatch = lower.match(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?)/) || lower.match(/\b(\d+)\b/);

  let amount = 0;
  let amountStr = '';

  if (jutaMatch) {
    amount = parseFloat(jutaMatch[1].replace(/\./g, '').replace(',', '.')) * 1_000_000;
    amountStr = jutaMatch[0];
  } else if (ribuMatch) {
    amount = parseFloat(ribuMatch[1].replace(/\./g, '').replace(',', '.')) * 1_000;
    amountStr = ribuMatch[0];
  } else if (kMatch) {
    amount = parseFloat(kMatch[1].replace(/\./g, '').replace(',', '.')) * 1_000;
    amountStr = kMatch[0];
  } else if (plainMatch) {
    amount = parseFloat(plainMatch[1].replace(/\./g, '').replace(',', '.'));
    amountStr = plainMatch[0];
  } else if (numberMatch) {
    amount = parseFloat(numberMatch[1].replace(/\./g, '').replace(',', '.'));
    amountStr = numberMatch[0];
  }

  if (!amount || amount <= 0 || !isFinite(amount)) return null;
  return { amount, amountStr };
}

/** Detect transaction type from text keywords. */
export function detectTransactionType(text: string): 'income' | 'expense' | null {
  const lower = text.toLowerCase();

  const expenseHints = ['beli', 'bayar', 'keluar', 'spend', 'buy', 'pay', 'expense', 'cost', '买', '付', '花',
    'total', 'total bayar', 'grand total', 'jumlah', 'payment', 'pembayaran', 'purchase'];
  const incomeHints = ['terima', 'masuk', 'dapat', 'receive', 'income', 'salary', 'gaji', '收', '赚',
    'deposit', 'setor', 'refund', 'pengembalian', 'transfer in'];

  for (const hint of expenseHints) {
    if (lower.includes(hint)) return 'expense';
  }
  for (const hint of incomeHints) {
    if (lower.includes(hint)) return 'income';
  }

  return null;
}

/** Match account category from text keywords. */
export function matchAccountFromText(text: string, accounts: AccountInfo[], txType: 'income' | 'expense'): AccountInfo | null {
  const lower = text.toLowerCase();

  let matchedCode: string | null = null;
  for (const [keyword, code] of Object.entries(keywordMap)) {
    if (lower.includes(keyword)) {
      if (txType === 'income' && code.startsWith('4')) { matchedCode = code; break; }
      if (txType === 'expense' && code.startsWith('5')) { matchedCode = code; break; }
    }
  }

  // Fallback account code
  if (!matchedCode) {
    matchedCode = txType === 'income' ? '4-9000' : '5-9000';
  }

  return accounts.find(a => a.code === matchedCode) || null;
}

/** Detect payment method (opponent account) from text keywords. */
export function detectPaymentMethod(text: string): string {
  const lower = text.toLowerCase();
  for (const method of paymentMethodKeywords) {
    for (const keyword of method.keywords) {
      if (lower.includes(keyword)) {
        return method.accountId;
      }
    }
  }
  return 'acc-cash'; // default
}

/** Extract counterparty / merchant name from receipt text. */
export function extractCounterparty(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);

  // Skip lines that look like totals, dates, or payment info
  // Also skip "Transaksi Berhasil" / "Transaksi Gagal" confirmation headers
  const skipPatterns = /^(total|subtotal|tax|ppn|service|grand|jumlah|rp\.?|idr|date|tanggal|no\.?|ref|trx|payment|bayar|tunai|cash|qris|debit|credit|saldo|balance|transaksi berhasil|transaksi gagal|transaction success|transaction failed|pembayaran berhasil|pembayaran gagal|payment success|payment failed|forwarded|diteruskan|disampaikan|bca mobile|bri mobile|bni mobile|mandiri|bsi mobile|btn mobile|btpn|jenius|neo commerce|bank|dana|gopay|ovo|shopeepay|linkaja|waktu|sumber dana|rekening|berita|keterangan|catatan|note|\d{1,2}[\/\-]\d{1,2}[\/\-])/i;

  for (const line of lines) {
    // Skip very long lines (likely item lists)
    if (line.length > 60) continue;
    // Skip lines that are mostly numbers
    if (/^[\d.,\s]+$/.test(line)) continue;
    // Skip lines matching known patterns
    if (skipPatterns.test(line)) continue;
    // First meaningful short line is likely the merchant name
    if (line.length >= 3 && line.length <= 40) {
      return line;
    }
  }

  return '';
}

/** Extract date from receipt text. Returns ISO date string or empty string. */
export function extractDate(text: string): string {
  // dd/mm/yyyy or dd-mm-yyyy (Indonesian standard)
  const dmyMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1]);
    let month = parseInt(dmyMatch[2]);
    let year = parseInt(dmyMatch[3]);
    if (year < 100) year += 2000;
    // Validate ranges
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try dd Mon yyyy format (e.g., "01 Jun 2026", "01 Juni 2026")
  const months: Record<string, number> = {
    'jan': 1, 'januari': 1, 'feb': 2, 'februari': 2, 'mar': 3, 'maret': 3,
    'apr': 4, 'april': 4, 'may': 5, 'mei': 5, 'jun': 6, 'juni': 6,
    'jul': 7, 'juli': 7, 'aug': 8, 'agustus': 8, 'sep': 9, 'september': 9,
    'okt': 10, 'oktober': 10, 'oct': 10, 'nov': 11, 'november': 11, 'des': 12, 'desember': 12, 'dec': 12,
  };
  const namedMatch = text.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);
  if (namedMatch) {
    const month = months[namedMatch[2].toLowerCase()];
    if (month) {
      const day = parseInt(namedMatch[1]);
      const year = parseInt(namedMatch[3]);
      if (day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }

  // Try ISO format yyyy-mm-dd
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[0];
  }

  return '';
}

// ── Smart amount extraction (4 cascading strategies) ──

/** Total keyword patterns found on Indonesian banking/merchant receipts */
const TOTAL_KEYWORDS = /\b(total\b|total bayar|total pembayaran|grand total|jumlah|nominal|total tagihan|total transfer|besar|jumlah transfer|nominal transfer|pembayaran|biaya|kredit|debit|pendapatan|saldo)\b/i;

/**
 * Parse a monetary string into a plain integer.
 * Auto-detects thousand separator (dot or comma) and strips decimals.
 *
 * Rules:
 * - "1.000.000" → 1000000 (dot = thousand separator)
 * - "1,000,000" → 1000000 (comma = thousand separator)
 * - "1.000,00"  → 1000     (dot = thousand, comma = decimal → strip decimal)
 * - "1,000.00"  → 1000     (comma = thousand, dot = decimal → strip decimal)
 * - "50000"     → 50000    (no separator)
 * - "Rp 50.000" → 50000    (strip currency prefix)
 */
export function parseSmartAmount(str: string): number {
  // Strip trailing ,- (common in Indonesian banking: "Rp 50.000,-")
  let cleaned = str.replace(/[,\\-]+$/, '').trim();

  // Strip currency symbols: "Rp.", "Rp", "IDR", "idr", $, ¥, €, £
  cleaned = cleaned.replace(/(?:[Rr][Pp]\.?|IDR|idr|\$|¥|€|£)\s*/g, '').trim();

  // Strip any remaining whitespace
  cleaned = cleaned.replace(/\s/g, '');
  if (!cleaned) return 0;

  // Detect separator pattern
  const hasDotThousands = /\d\.\d{3}/.test(cleaned);     // e.g., 1.000
  const hasCommaThousands = /\d,\d{3}/.test(cleaned);    // e.g., 1,000
  const hasDotDecimal = /\.\d{2}$/.test(cleaned);         // e.g., .00
  const hasCommaDecimal = /,\d{2}$/.test(cleaned);         // e.g., ,00

  if (hasDotThousands && hasCommaDecimal) {
    // Indonesian format: 1.000,00 → strip ,00
    cleaned = cleaned.replace(/,\d{2}$/, '');
    cleaned = cleaned.replace(/\./g, '');
  } else if (hasCommaThousands && hasDotDecimal) {
    // Western format: 1,000.00 → strip .00
    cleaned = cleaned.replace(/\.\d{2}$/, '');
    cleaned = cleaned.replace(/,/g, '');
  } else if (hasDotThousands) {
    // Indonesian format no decimal: 1.000.000
    cleaned = cleaned.replace(/\./g, '');
  } else if (hasCommaThousands) {
    // Western format no decimal: 1,000,000
    cleaned = cleaned.replace(/,/g, '');
  }

  const parsed = parseFloat(cleaned);
  return (isNaN(parsed) || parsed <= 0 || !isFinite(parsed)) ? 0 : parsed;
}

/**
 * Extract all monetary amounts from a line of text.
 * Returns { amount, rawStr } pairs sorted by amount descending.
 */
function extractAmountsFromLine(line: string): Array<{ amount: number; rawStr: string }> {
  const results: Array<{ amount: number; rawStr: string }> = [];

  // Pattern 1: Rp/IDR prefix + formatted number (possibly with ,-  trailing)
  const rpMatches = line.matchAll(/(?:[Rr][Pp]\.?\s*|IDR\s*)(\d[\d.,]*)/gi);
  for (const m of rpMatches) {
    const amount = parseSmartAmount(m[0]);
    if (amount > 0) results.push({ amount, rawStr: m[0] });
  }

  // Pattern 2: standalone formatted number (not a date, not a phone, not a time)
  // Look for numbers with thousand separators (3+ digits between separators)
  const numMatches = line.matchAll(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?)/g);
  for (const m of numMatches) {
    // Skip if looks like a date (dd/mm or dd-mm with 1-2 digit first group)
    if (/^\d{1,2}[.,]\d{1,2}[.,]/.test(m[1])) continue;
    const amount = parseSmartAmount(m[1]);
    if (amount > 0) results.push({ amount, rawStr: m[1] });
  }

  // Pattern 3: plain large numbers (>= 1000) without separators
  const plainMatches = line.matchAll(/\b(\d{4,})\b/g);
  for (const m of plainMatches) {
    // Skip transaction IDs, phone numbers, account numbers (usually 8-16 digits with no separators)
    if (m[1].length > 15) continue;
    const amount = parseInt(m[1], 10);
    if (amount >= 1000) results.push({ amount, rawStr: m[1] });
  }

  return results.sort((a, b) => b.amount - a.amount);
}

/**
 * Extract the most likely monetary amount from a single line/block.
 * Used when the user taps a recognized text block to assign it as the Amount.
 * Prefers Rp/IDR-prefixed amounts; falls back to the largest formatted number.
 * Returns null when no amount is found.
 */
export function extractFirstAmount(text: string): number | null {
  const rpFirst = extractRpAmountsFromLine(text)[0];
  if (rpFirst) return rpFirst.amount;
  const all = extractAmountsFromLine(text)[0];
  return all ? all.amount : null;
}

/**
 * Extract only Rp/IDR-prefixed amounts from a line.
 * Returns amounts sorted descending.
 */
function extractRpAmountsFromLine(line: string): Array<{ amount: number; rawStr: string }> {
  const results: Array<{ amount: number; rawStr: string }> = [];

  const rpMatches = line.matchAll(/(?:[Rr][Pp]\.?\s*|IDR\s*)(\d[\d.,]*)/gi);
  for (const m of rpMatches) {
    const amount = parseSmartAmount(m[0]);
    if (amount > 0) results.push({ amount, rawStr: m[0] });
  }

  return results.sort((a, b) => b.amount - a.amount);
}

/**
 * Smart amount extraction using 6 cascading strategies.
 * Prioritizes Rp/IDR-prefixed amounts (the undisputable signal).
 */
export function extractAmountSmart(
  text: string,
  blocks: Array<{ text: string; fontSize: number; y: number }>,
): { amount: number; rawStr: string } | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Strategy 1: Rp/IDR-prefixed amounts — scan ALL lines
  // Prefer the largest Rp amount (usually the total).
  // If equal, prefer the last occurrence (bottom of receipt = likely total).
  const allRpAmounts: Array<{ amount: number; rawStr: string; lineIdx: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const rpAmts = extractRpAmountsFromLine(lines[i]);
    for (const a of rpAmts) {
      allRpAmounts.push({ ...a, lineIdx: i });
    }
  }
  if (allRpAmounts.length === 1) {
    return { amount: allRpAmounts[0].amount, rawStr: allRpAmounts[0].rawStr };
  }
  if (allRpAmounts.length > 1) {
    // Sort: largest amount first, then latest line (bottom) first
    allRpAmounts.sort((a, b) => b.amount - a.amount || b.lineIdx - a.lineIdx);
    return { amount: allRpAmounts[0].amount, rawStr: allRpAmounts[0].rawStr };
  }

  // Strategy 2: Total/amount keyword lines — check keyword line AND the next line below
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (TOTAL_KEYWORDS.test(line)) {
      // Check keyword line itself
      let amounts = extractAmountsFromLine(line);
      if (amounts.length > 0) {
        return { amount: amounts[0].amount, rawStr: amounts[0].rawStr };
      }
      // Check the line immediately below the keyword
      if (i + 1 < lines.length) {
        amounts = extractAmountsFromLine(lines[i + 1]);
        if (amounts.length > 0) {
          return { amount: amounts[0].amount, rawStr: amounts[0].rawStr };
        }
      }
    }
  }

  // Strategy 3: Largest font-size Rp/IDR amount (from blocks)
  if (blocks.length > 0) {
    const rpBlocks = blocks
      .map(b => ({ ...b, amounts: extractRpAmountsFromLine(b.text) }))
      .filter(b => b.amounts.length > 0);

    if (rpBlocks.length > 0) {
      const maxFont = Math.max(...rpBlocks.map(b => b.fontSize));
      const threshold = maxFont * 0.8;
      const largeFontRp = rpBlocks.filter(b => b.fontSize >= threshold);
      // Among large-font Rp amounts, pick the one nearest the bottom
      largeFontRp.sort((a, b) => b.y - a.y);
      return { amount: largeFontRp[0].amounts[0].amount, rawStr: largeFontRp[0].amounts[0].rawStr };
    }
  }

  // Strategy 4: Bottom 30% Rp/IDR amount (from blocks)
  if (blocks.length > 0) {
    const maxY = Math.max(...blocks.map(b => b.y));
    const bottomThreshold = maxY * 0.7;

    const bottomRp = blocks
      .filter(b => b.y >= bottomThreshold)
      .flatMap(b => extractRpAmountsFromLine(b.text).map(a => ({ ...a, y: b.y })));

    if (bottomRp.length > 0) {
      bottomRp.sort((a, b) => b.amount - a.amount);
      return { amount: bottomRp[0].amount, rawStr: bottomRp[0].rawStr };
    }
  }

  // Strategy 5: Largest Rp/IDR amount anywhere (covered by Strategy 1)

  // Strategy 6 (fallback): Largest formatted number anywhere on receipt
  const allAmounts: Array<{ amount: number; rawStr: string }> = [];
  for (const line of lines) {
    const amounts = extractAmountsFromLine(line);
    allAmounts.push(...amounts);
  }

  if (allAmounts.length > 0) {
    allAmounts.sort((a, b) => b.amount - a.amount);
    return { amount: allAmounts[0].amount, rawStr: allAmounts[0].rawStr };
  }

  return null;
}

// ── Transaction failed detection ──

/**
 * Detect if receipt shows a failed transaction.
 */
export function detectTransactionFailed(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('transaksi gagal') ||
         lower.includes('transaction failed') ||
         lower.includes('pembayaran gagal') ||
         lower.includes('payment failed') ||
         lower.includes('transfer gagal') ||
         lower.includes('transfer failed');
}

// ── From/To (direction) detection ──

export interface FromToResult {
  direction: 'income' | 'expense' | null;
  from: string;
  to: string;
}

/**
 * Extract from/to (origin/destination) from receipt text.
 */
export function extractFromTo(text: string): FromToResult {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let from = '';
  let to = '';
  let direction: 'income' | 'expense' | null = null;

  const fromLabels = [
    /\b(?:dari|from|pengirim|sender)\s*[:.]?\s*(.+)/i,
    /\b(?:transfer dari|transfer from)\s*[:.]?\s*(.+)/i,
  ];

  const toLabels = [
    /\b(?:ke|to|penerima|receiver|beneficiary)\s*[:.]?\s*(.+)/i,
    /\b(?:transfer ke|transfer to)\s*[:.]?\s*(.+)/i,
  ];

  for (const line of lines) {
    for (const re of fromLabels) {
      const m = line.match(re);
      if (m && !from) from = m[1].trim().substring(0, 50);
    }
    for (const re of toLabels) {
      const m = line.match(re);
      if (m && !to) to = m[1].trim().substring(0, 50);
    }
  }

  if (from && to) {
    const lower = text.toLowerCase();
    if (lower.includes('qris') || lower.includes('pembayaran') || lower.includes('payment') ||
        lower.includes('beli') || lower.includes('bayar') || lower.includes('purchase')) {
      direction = 'expense';
    } else if (lower.includes('terima') || lower.includes('receive') || lower.includes('deposit') ||
               lower.includes('refund') || lower.includes('salary') || lower.includes('gaji')) {
      direction = 'income';
    } else {
      direction = 'expense';
    }
  } else if (from && !to) {
    direction = 'income';
  } else if (!from && to) {
    direction = 'expense';
  }

  return { direction, from, to };
}
