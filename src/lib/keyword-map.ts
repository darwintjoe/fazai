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
  'salary': '4-1000', 'gaji': '4-1000', '工资': '4-1000', 'pay': '4-1000', 'wage': '4-1000',
  'freelance': '4-2000', 'project': '4-2000', 'contract': '4-2000',
  'sales': '4-3000', 'penjualan': '4-3000', '销售': '4-3000', 'sold': '4-3000', 'sell': '4-3000',
  'interest': '4-4000', 'bunga': '4-4000', '利息': '4-4000', 'dividend': '4-4000',
  // Expense keywords
  'food': '5-1000', 'makan': '5-1000', '吃': '5-1000', 'restaurant': '5-1000', 'grocery': '5-1000',
  'coffee': '5-1000', 'lunch': '5-1000', 'dinner': '5-1000', 'breakfast': '5-1000',
  'transport': '5-2000', 'gas': '5-2000', 'fuel': '5-2000', 'taxi': '5-2000', 'uber': '5-2000',
  '交通': '5-2000', 'bensin': '5-2000', 'parking': '5-2000',
  'electricity': '5-3000', 'water': '5-3000', 'internet': '5-3000', 'phone': '5-3000',
  'listrik': '5-3000', 'utilitas': '5-3000', '水费': '5-3000',
  'rent': '5-4000', 'sewa': '5-4000', '租金': '5-4000', 'apartment': '5-4000',
  'movie': '5-5000', 'game': '5-5000', 'entertainment': '5-5000', 'hiburan': '5-5000', '娱乐': '5-5000',
  'doctor': '5-6000', 'medicine': '5-6000', 'hospital': '5-6000', 'health': '5-6000',
  'kesehatan': '5-6000', '医疗': '5-6000', 'pharmacy': '5-6000',
  'shopping': '5-7000', 'clothes': '5-7000', 'belanja': '5-7000', '购物': '5-7000',
  'course': '5-8000', 'school': '5-8000', 'education': '5-8000', 'pendidikan': '5-8000', '教育': '5-8000',
  'book': '5-8000', 'training': '5-8000',
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
  const skipPatterns = /^(total|subtotal|tax|ppn|service|grand|jumlah|rp\.?|idr|date|tanggal|no\.?|ref|trx|payment|bayar|tunai|cash|qris|debit|credit|saldo|balance|transaksi berhasil|transaksi gagal|transaction success|transaction failed|pembayaran berhasil|pembayaran gagal|payment success|payment failed|\d{1,2}[\/\-]\d{1,2}[\/\-])/i;

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

/** Total keyword patterns found on Indonesian receipts */
const TOTAL_KEYWORDS = /\b(total\b|total bayar|total pembayaran|grand total|jumlah|nominal|total tagihan)\b/i;

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
  // Strip currency symbols and whitespace
  let cleaned = str.replace(/[RpRpIDRidr$¥€£\s]/g, '').trim();
  if (!cleaned) return 0;

  // Detect separator pattern
  const hasDotThousands = /\d\.\d{3}/.test(cleaned);     // e.g., 1.000
  const hasCommaThousands = /\d,\d{3}/.test(cleaned);    // e.g., 1,000
  const hasDotDecimal = /\.\d{2}$/.test(cleaned);         // e.g., ,00
  const hasCommaDecimal = /,\d{2}$/.test(cleaned);         // e.g., .00

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

  // Pattern: Rp/IDR prefix + formatted number (possibly with decimal)
  const rpMatches = line.matchAll(/(?:Rp\.?|IDR)\s*(\d[\d.,]*)/gi);
  for (const m of rpMatches) {
    const amount = parseSmartAmount(m[0]);
    if (amount > 0) results.push({ amount, rawStr: m[0] });
  }

  // Pattern: standalone formatted number (not a date, not a phone, not a time)
  // Look for numbers with thousand separators (3+ digits between separators)
  const numMatches = line.matchAll(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?)/g);
  for (const m of numMatches) {
    // Skip if looks like a date (dd/mm or dd-mm with 1-2 digit first group)
    if (/^\d{1,2}[.,]\d{1,2}[.,]/.test(m[1])) continue;
    const amount = parseSmartAmount(m[1]);
    if (amount > 0) results.push({ amount, rawStr: m[1] });
  }

  // Pattern: plain large numbers (>= 1000) without separators
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
 * Smart amount extraction using 4 cascading strategies.
 * Requires both raw text and block data (for font size and position).
 */
export function extractAmountSmart(
  text: string,
  blocks: Array<{ text: string; fontSize: number; y: number }>,
): { amount: number; rawStr: string } | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Strategy 1: Total keyword lines
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (TOTAL_KEYWORDS.test(line)) {
      const amounts = extractAmountsFromLine(line);
      if (amounts.length > 0) {
        return { amount: amounts[0].amount, rawStr: amounts[0].rawStr };
      }
    }
  }

  // Strategy 2: Largest font-size number
  if (blocks.length > 0) {
    const maxFontSize = Math.max(...blocks.filter(b => /\d/.test(b.text)).map(b => b.fontSize));
    const largeFontThreshold = maxFontSize * 0.8;
    const largeFontAmounts: Array<{ amount: number; rawStr: string; y: number }> = [];

    for (const block of blocks) {
      if (block.fontSize < largeFontThreshold) continue;
      const amounts = extractAmountsFromLine(block.text);
      if (amounts.length > 0) {
        largeFontAmounts.push({ ...amounts[0], y: block.y });
      }
    }

    if (largeFontAmounts.length > 0) {
      largeFontAmounts.sort((a, b) => b.y - a.y);
      return { amount: largeFontAmounts[0].amount, rawStr: largeFontAmounts[0].rawStr };
    }
  }

  // Strategy 3: Bottom 30% position — largest number
  if (blocks.length > 0) {
    const maxY = Math.max(...blocks.map(b => b.y));
    const bottomThreshold = maxY * 0.7;

    const bottomAmounts: Array<{ amount: number; rawStr: string }> = [];
    for (const block of blocks) {
      if (block.y < bottomThreshold) continue;
      const amounts = extractAmountsFromLine(block.text);
      if (amounts.length > 0) {
        bottomAmounts.push(amounts[0]);
      }
    }

    if (bottomAmounts.length > 0) {
      bottomAmounts.sort((a, b) => b.amount - a.amount);
      return { amount: bottomAmounts[0].amount, rawStr: bottomAmounts[0].rawStr };
    }
  }

  // Strategy 4: Largest number anywhere on receipt
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
