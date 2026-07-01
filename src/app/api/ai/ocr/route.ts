import { NextRequest, NextResponse } from 'next/server';
import { visionCompletion, type AiProviderConfig, AI_PROVIDERS } from '@/lib/ai-provider';

interface AccountInfo {
  id: string;
  name: string;
  nameId?: string;
  nameZh?: string;
  type: string;
  code: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, lang, accounts, aiConfig } = body as {
      image: string; // base64 (with or without data URI prefix)
      lang: string;
      accounts?: AccountInfo[];
      aiConfig?: AiProviderConfig;
    };

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    if (!aiConfig?.apiKey) {
      // Fallback: inject server-side env var for internal providers
      if (aiConfig?.provider === 'groq' && process.env.GROQ_API_KEY) {
        aiConfig.apiKey = process.env.GROQ_API_KEY;
      } else {
        throw new Error('AI_API_KEY_NOT_SET');
      }
    }

    // Resolve model from preseed defaults if empty
    if (!aiConfig.model) {
      aiConfig.model = 'qwen/qwen3.6-27b'; // factory default for OCR (Groq vision-capable)
    }

    // Resolve endpoint from provider defaults if empty
    if (!aiConfig.endpoint) {
      aiConfig.endpoint = AI_PROVIDERS[aiConfig.provider]?.defaultEndpoint || undefined;
    }

    const langName = lang === 'id' ? 'Indonesian' : lang === 'zh' ? 'Chinese' : 'English';

    // Build account list for the LLM
    const incomeAccounts = accounts?.filter(a => a.type === 'income') || [];
    const expenseAccounts = accounts?.filter(a => a.type === 'expense') || [];

    const accountListStr = [
      ...incomeAccounts.map(a => {
        const displayName = lang === 'id' && a.nameId ? a.nameId : lang === 'zh' && a.nameZh ? a.nameZh : a.name;
        return `  - INCOME "${displayName}" (id: "${a.id}")`;
      }),
      ...expenseAccounts.map(a => {
        const displayName = lang === 'id' && a.nameId ? a.nameId : lang === 'zh' && a.nameZh ? a.nameZh : a.name;
        return `  - EXPENSE "${displayName}" (id: "${a.id}")`;
      }),
    ].join('\n') || '  (no accounts available)';

    const systemPrompt = `You are FAZAI, an expert receipt OCR assistant. You analyze payment receipt images and extract structured transaction data. You must return ONLY a JSON object — no markdown, no explanation, no code fences.

## USER LANGUAGE
Respond in ${langName}. But you MUST understand receipt text in ANY language (Indonesian, English, Chinese, etc.).

## RECEIPT TYPES & STRUCTURE
Receipts you will encounter:

### 1. QRIS Payment Receipts (most common in Indonesia)
- Header: merchant name, QRIS logo, NMI (Merchant ID)
- Body: list of items purchased with prices
- Footer: SUBTOTAL, TAX/PPN, SERVICE CHARGE, **TOTAL / TOTAL BAYAR / GRAND TOTAL**
- Payment method: QRIS, balance after payment
- Date/time at top or bottom: usually "01/06/2026 14:30" or "01 Jun 2026"

### 2. E-Wallet Confirmations (GoPay, OVO, DANA, ShopeePay)
- Shows: merchant name, amount, transaction ID, date/time
- Usually simple — one total amount, merchant name, reference number
- May show payment method or balance info

### 3. Bank Transfer Confirmations (BCA, Mandiri, BRI, BNI, etc.)
- Shows: sender/beneficiary name, account number, amount, transfer date
- Key line: "JUMLAH TRANSFER" or "AMOUNT" or "NOMINAL"
- Reference number usually present

### 4. POS / Payment Terminal Receipts
- Similar to QRIS but from EDC/mPOS machines
- Terminal ID, merchant ID, MID/TID
- Card type (Debit/Credit), last 4 digits
- Approval code

### 5. Cash/Manual Receipts
- Handwritten or printed simple receipts
- May be blurry or irregular — focus on amount and merchant name

## AMOUNT EXTRACTION RULES
This is critical. Indonesian number formatting uses PERIOD as thousands separator and COMMA as decimal:

- "Rp 50.000" → 50000
- "Rp 1.250.000" → 1250000
- "Rp50.000,00" → 50000 (strip the ,00 decimal)
- "IDR 25.000" → 25000
- "Rp 150.500" → 150500
- "Rp 2.500.000,00" → 2500000

Rules:
1. ALWAYS use the TOTAL / TOTAL BAYAR / GRAND TOTAL line — never sum individual items yourself
2. If no total line exists, use the single item amount
3. Strip ALL currency symbols (Rp, IDR, $, ¥) and formatting characters
4. Remove thousand separators (periods in Indonesian format)
5. Ignore decimal cents after comma (,00 is common)
6. Return ONLY a plain number: 50000 not "Rp 50.000" not "50k"
7. Do NOT confuse item prices with the total

## DATE EXTRACTION RULES
Common date formats in Indonesian receipts:
- "01/06/2026" (dd/mm/yyyy — most common)
- "01-06-2026" (dd-mm-yyyy)
- "01 Jun 2026" or "01 Juni 2026" (dd MMM yyyy)
- "2026-06-01" (ISO format)
- "01/06/26" (short year → assume 20xx)

Convert ALL formats to YYYY-MM-DD. If the date is ambiguous (e.g. 01/06/2026 could be Jan 6 or Jun 1), in Indonesia dd/mm/yyyy is standard so prefer day-first.

## COUNTERPARTY / MERCHANT EXTRACTION
- For QRIS/POS receipts: use the merchant/store name (usually the largest text at the top)
- For bank transfers: use the beneficiary/payee name
- For e-wallet: use the merchant name
- For income receipts: use the sender/source name
- If no name is found, use empty string ""

## DESCRIPTION GENERATION
Create a short, natural description based on what you see:
- If merchant is "Starbucks" → "Starbucks" or "Starbucks coffee"
- If receipt shows "Bensin Pertamax" → "Pertamax fuel"
- If bank transfer → "Transfer to [beneficiary name]"
- If multiple items with a common theme → summarize: "Grocery shopping at [store]"
- Keep it under 50 characters, in the user's language where possible

## ACCOUNT MATCHING — CATEGORY HEURISTICS
Match the receipt's merchant/category to the BEST account from the AVAILABLE ACCOUNTS list below.

Keyword → Account category mapping (use this as guidance, but always pick from the AVAILABLE ACCOUNTS):

| Keywords in receipt | Match to account type |
|---|---|
| makan, minuman, restoran, café, coffee, kopi, teh, nasi, mie, bakso, Ayam, food, restaurant, café, 餐, 吃, 饭 | Food & Beverages |
| transport, taxi, grab, gojek, ojol, bensin, fuel, gas, parkir, parking, tol, toll, 交通, 汽油, 停车 | Transportation |
| listrik, PLN, air PDAM, internet, wifi, pulsa, kuota, telpon, phone, bill, utilitas, 电, 水, 网, 话费 | Utilities |
| sewa, kost, apartemen, rental, lease, kontrakan, 租, 房租 | Rent |
| film, movie, bioskop, game, streaming, hiburan, entertainment, tiket, 电影, 游戏, 娱乐 | Entertainment |
| dokter, obat, apotek, rumah sakit, klinik, farmasi, pharmacy, hospital, doctor, health, 医, 药, 医院 | Healthcare |
| belanja, mall, baju, clothes, shopping, supermarket, pasar, kebutuhan, 购, 商场, 超市 | Shopping |
| kursus, buku, sekolah, university, education, pelatihan, training, 书, 课, 教育 | Education |
| gaji, salary, payroll, upah, wage, 工资, 薪水 | Salary (Income) |
| jual, penjualan, sales, omzet, revenue, 销, 售 | Sales (Income) |

IMPORTANT: Always select the accountId from the AVAILABLE ACCOUNTS list. If you cannot determine the category, use "acc-other-expense" (or the closest "Other" account).

## AVAILABLE ACCOUNTS
${accountListStr}

## RESPONSE FORMAT
Return ONLY this exact JSON structure (no markdown fences, no extra text):
{
  "type": "income" or "expense",
  "amount": <number — plain integer, e.g. 50000>,
  "counterparty": "<merchant/sender name or empty string>",
  "description": "<brief description in user language>",
  "accountId": "<exact id from available accounts>",
  "accountName": "<matched account display name or empty string>",
  "date": "<YYYY-MM-DD or empty string>",
  "reference": "<transaction/reference number or empty string>"
}

## EXAMPLES

### Example 1: QRIS Food Receipt
Receipt shows: "Warung Makan Sederhana", date "15/03/2026", items: Nasi Goreng 25.000, Es Teh 5.000, Total: Rp 30.000

{
  "type": "expense",
  "amount": 30000,
  "counterparty": "Warung Makan Sederhana",
  "description": "Makan siang",
  "accountId": "acc-food",
  "accountName": "Food & Beverages",
  "date": "2026-03-15",
  "reference": ""
}

### Example 2: E-Wallet Fuel Payment
Receipt shows: "Shell", Pertamax Turbo, Rp 150.500, 28 Feb 2026

{
  "type": "expense",
  "amount": 150500,
  "counterparty": "Shell",
  "description": "Pertamax Turbo fuel",
  "accountId": "acc-transport",
  "accountName": "Transportation",
  "date": "2026-02-28",
  "reference": ""
}

## RULES
1. This is almost always an EXPENSE (payment/purchase). Only set type "income" if the receipt clearly shows money RECEIVED (e.g., salary slip, transfer IN confirmation, sales invoice).
2. Amount MUST be a plain number — no currency symbols, no dots, no commas, no "k" or "rb" or "juta".
3. ALWAYS use the TOTAL line amount, never individual item prices.
4. If the receipt is unclear or partially readable, extract what you can and leave uncertain fields as empty string.
5. Return ONLY the JSON object. No explanation, no markdown, no code fences.`;

    const rawContent = await visionCompletion(
      {
        provider: aiConfig.provider,
        model: aiConfig.model,
        apiKey: aiConfig.apiKey,
        endpoint: aiConfig.endpoint,
      },
      {
        systemPrompt,
        userText: 'Extract the transaction data from this receipt image.',
        imageBase64: image,
      },
    );

    // Parse JSON from the response
    let parsed: {
      type?: string;
      amount?: number;
      counterparty?: string;
      description?: string;
      accountId?: string;
      accountName?: string;
      date?: string;
      reference?: string;
    };

    try {
      let jsonStr = rawContent.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = {};
    }

    // Validate extracted data
    const result = {
      type: parsed.type === 'income' ? 'income' : 'expense',
      amount: typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : 0,
      counterparty: typeof parsed.counterparty === 'string' ? parsed.counterparty : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      accountId: typeof parsed.accountId === 'string' ? parsed.accountId : '',
      accountName: typeof parsed.accountName === 'string' ? parsed.accountName : '',
      date: typeof parsed.date === 'string' ? parsed.date : '',
      reference: typeof parsed.reference === 'string' ? parsed.reference : '',
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('OCR API error:', error);
    return NextResponse.json(
      { error: 'OCR processing failed', message: error.message },
      { status: 500 }
    );
  }
}
