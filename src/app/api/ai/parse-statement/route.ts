import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, type AiProviderConfig, AI_PROVIDERS } from '@/lib/ai-provider';

interface AccountInfo {
  id: string;
  name: string;
  nameId?: string;
  nameZh?: string;
  type: string;
  code: string;
}

interface ParsedTransaction {
  date: string;
  description: string;
  counterparty: string;
  amount: number;
  type: 'income' | 'expense';
  accountId: string;
  accountName: string;
  sourceAccountId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, lang, accounts, aiConfig } = body as {
      text: string;
      lang: string;
      accounts?: AccountInfo[];
      aiConfig?: AiProviderConfig;
    };

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!aiConfig?.apiKey) {
      // Fallback: inject server-side env var for internal providers
      if (aiConfig?.provider === 'zai' && process.env.ZAI_API_KEY) {
        aiConfig.apiKey = process.env.ZAI_API_KEY;
      } else {
        throw new Error('AI_API_KEY_NOT_SET');
      }
    }

    // Resolve model from config (use default if empty)
    const resolvedModel = aiConfig.model || AI_PROVIDERS[aiConfig.provider]?.defaultModel || '';
    const resolvedEndpoint = aiConfig.endpoint || undefined;

    const langName = lang === 'id' ? 'Indonesian' : lang === 'zh' ? 'Chinese' : 'English';

    // Build account list for the LLM
    const incomeAccounts = accounts?.filter(a => a.type === 'income') || [];
    const expenseAccounts = accounts?.filter(a => a.type === 'expense') || [];
    const cashBankAccounts = accounts?.filter(a => a.type === 'cashBank' && a.id !== 'acc-cashbank-root') || [];

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

    const cashBankListStr = [
      ...cashBankAccounts.map(a => {
        const displayName = lang === 'id' && a.nameId ? a.nameId : lang === 'zh' && a.nameZh ? a.nameZh : a.name;
        return `  - "${displayName}" (id: "${a.id}")`;
      }),
    ].join('\n') || '  - "Bank" (id: "acc-bank")';

    const defaultSourceAccount = cashBankAccounts.length > 0 ? cashBankAccounts[0].id : 'acc-bank';

    const systemPrompt = `You are FAZAI, an expert bank statement parser. You analyze raw text extracted from bank e-statements and convert each transaction row into structured JSON. You must return ONLY a JSON object — no markdown, no explanation, no code fences.

## USER LANGUAGE
Respond in ${langName}. But you MUST understand statement text in ANY language (Indonesian, English, Chinese, etc.).

## CRITICAL: CREDIT vs DEBIT RULES
This is the most important rule. Bank statements use Cr/Dr (or equivalent):

- **Cr (Credit) = INCOME** — money coming INTO the account (salary deposit, incoming transfer, interest earned, refunds)
- **Db / Dr (Debit) = EXPENSE** — money going OUT of the account (purchases, transfers out, bill payments, ATM withdrawals, fees)

Indonesian banks may use:
- "KREDIT" or "KR" = Credit/Income
- "DEBET" or "DB" = Debit/Expense
- Some statements show positive amounts for credits and negative for debits

If the statement has separate DB and CR columns, classify each row accordingly.
If the statement only has one amount column, look for the DB/CR indicator on that row.

Amount should ALWAYS be a positive number — the "type" field indicates direction.

## AMOUNT EXTRACTION RULES
Indonesian number formatting:
- "50.000" → 50000 (period = thousands separator)
- "1.250.000" → 1250000
- "50.000,00" → 50000 (strip ,00)
- "Rp 150.500" → 150500

Rules:
1. Strip ALL currency symbols (Rp, IDR) and formatting
2. Remove thousand separators (periods)
3. Ignore decimal cents (,00)
4. Always return a POSITIVE number; use "type" to indicate direction

## DATE EXTRACTION
- Common: "01/06/2026" (dd/mm/yyyy), "01 Jun 2026", "2026-06-01"
- Always convert to YYYY-MM-DD
- In Indonesia, dd/mm/yyyy is standard

## CATEGORY MATCHING
Match each transaction's description to the best category account:

| Keywords | Category |
|---|---|
| makan, minuman, restoran, café, coffee, kopi, nasi, mie, food, restaurant | Food & Beverages |
| transport, taxi, grab, gojek, bensin, fuel, parkir, toll | Transportation |
| listrik, PLN, internet, pulsa, phone, bill, utilitas | Utilities |
| sewa, kost, apartemen, rental | Rent |
| bioskop, game, streaming, hiburan, entertainment, tiket | Entertainment |
| dokter, obat, apotek, rumah sakit, klinik, health | Healthcare |
| belanja, mall, baju, shopping, supermarket | Shopping |
| kursus, buku, sekolah, education | Education |
| gaji, salary, payroll | Salary (Income) |
| jual, penjualan, sales, revenue | Sales (Income) |
| bunga, interest | Interest Income |
| transfer, tf, trf (incoming) | Other Income (or match if sender identifiable) |

Always pick from the AVAILABLE ACCOUNTS. If unsure, use "acc-other-expense" or "acc-other-income".

## SOURCE ACCOUNT
This is the bank account the statement belongs to. All transactions in the statement are from this same source account.
- If the statement clearly shows which bank, try to match. Otherwise use "${defaultSourceAccount}" (Bank).
- Available source accounts: ${cashBankListStr}

## AVAILABLE CATEGORY ACCOUNTS
${accountListStr}

## RESPONSE FORMAT
Return ONLY this exact JSON structure — an array called "transactions":
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "short description from the statement line",
      "counterparty": "merchant or person name, or empty string",
      "amount": 50000,
      "type": "income",
      "accountId": "acc-food",
      "accountName": "Food & Beverages",
      "sourceAccountId": "${defaultSourceAccount}"
    }
  ]
}

## RULES
1. Parse EVERY transaction row in the statement. Do not skip any.
2. Ignore header rows, footer rows, balance summaries, and page numbers.
3. If a row is unclear, make your best guess — don't skip it.
4. Group similar repeated entries (e.g., daily standing charges) but keep each as a separate transaction.
5. Amount MUST always be a positive number.
6. Return ONLY the JSON. No markdown, no explanation, no code fences.`;

    const rawContent = await chatCompletion(
      {
        provider: aiConfig.provider,
        model: resolvedModel,
        apiKey: aiConfig.apiKey,
        endpoint: resolvedEndpoint,
      },
      {
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Parse the following bank statement text into structured transactions:\n\n${text}`,
          },
        ],
        temperature: 0.2,
        maxTokens: 16000,
      },
    );

    // Parse JSON from the response
    let parsed: { transactions?: ParsedTransaction[] };

    try {
      let jsonStr = rawContent.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { transactions: [] };
    }

    // Validate and clean up each transaction
    const validAccountIds = new Set(accounts?.map(a => a.id) || []);
    const validCashBankIds = new Set(cashBankAccounts.map(a => a.id));
    const transactions = (parsed.transactions || []).map((tx) => ({
      date: typeof tx.date === 'string' ? tx.date : '',
      description: typeof tx.description === 'string' ? tx.description : '',
      counterparty: typeof tx.counterparty === 'string' ? tx.counterparty : '',
      amount: typeof tx.amount === 'number' && tx.amount > 0 ? tx.amount : 0,
      type: tx.type === 'income' ? 'income' as const : 'expense' as const,
      accountId: typeof tx.accountId === 'string' && validAccountIds.has(tx.accountId) ? tx.accountId : 'acc-other-expense',
      accountName: typeof tx.accountName === 'string' ? tx.accountName : '',
      sourceAccountId: typeof tx.sourceAccountId === 'string' && validCashBankIds.has(tx.sourceAccountId) ? tx.sourceAccountId : defaultSourceAccount,
    })).filter(tx => tx.amount > 0 && tx.date);

    return NextResponse.json({ transactions });
  } catch (error: any) {
    console.error('Statement parsing error:', error);
    return NextResponse.json(
      { error: 'Statement parsing failed', message: error.message },
      { status: 500 },
    );
  }
}
