import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, type AiProviderConfig, AI_PROVIDERS } from '@/lib/ai-provider';
import {
  extractAmountFromText,
  detectTransactionType,
  matchAccountFromText,
  detectPaymentMethod,
  extractCounterparty,
  extractDate,
  type AccountInfo,
} from '@/lib/keyword-map';

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

    const paymentMethodListStr = [
      ...cashBankAccounts.map(a => {
        const displayName = lang === 'id' && a.nameId ? a.nameId : lang === 'zh' && a.nameZh ? a.nameZh : a.name;
        return `  - "${displayName}" (id: "${a.id}")`;
      }),
    ].join('\n') || '  - "Cash" (id: "acc-cash")';

    // Try AI parsing if API key is available
    if (aiConfig?.apiKey || (aiConfig?.provider === 'zai' && process.env.ZAI_API_KEY)) {
      try {
        // Inject server-side env var for Z.Ai
        if (!aiConfig.apiKey && aiConfig.provider === 'zai' && process.env.ZAI_API_KEY) {
          aiConfig.apiKey = process.env.ZAI_API_KEY;
        }

        const resolvedModel = aiConfig.model || AI_PROVIDERS[aiConfig.provider]?.defaultModel || '';
        const resolvedEndpoint = aiConfig.endpoint || undefined;

        const systemPrompt = `You are FAZAI, an expert receipt text parser. You analyze OCR-extracted text from payment receipts and extract structured transaction data. You must return ONLY a JSON object — no markdown, no explanation, no code fences.

## USER LANGUAGE
Respond in ${langName}. But you MUST understand receipt text in ANY language (Indonesian, English, Chinese, etc.).

## CRITICAL RULES
1. You MUST extract ALL fields. Never leave amount, counterparty, date, or payment method empty if the text is readable.
2. If text is visible, the total amount is ALWAYS present somewhere. Look carefully for TOTAL, TOTAL BAYAR, GRAND TOTAL, JUMLAH, or similar.
3. First determine if this is INCOME (money received) or EXPENSE (money spent):
   - EXPENSE: purchase receipts, payment confirmations, QRIS payments, POS receipts, cash payments
   - INCOME: salary slips, transfer-in confirmations, sales invoices, refund receipts, deposit confirmations
4. Amount MUST be a plain number — no currency symbols, no dots, no commas, no "k" or "rb" or "juta".
5. ALWAYS use the TOTAL line amount, never individual item prices.
6. Return ONLY the JSON object. No explanation, no markdown, no code fences.

## AMOUNT EXTRACTION RULES
Indonesian number formatting uses PERIOD as thousands separator and COMMA as decimal:
- "Rp 50.000" → 50000
- "Rp 1.250.000" → 1250000
- "Rp50.000,00" → 50000 (strip the ,00 decimal)
- "IDR 25.000" → 25000
Rules:
1. ALWAYS use the TOTAL / TOTAL BAYAR / GRAND TOTAL line
2. Strip ALL currency symbols (Rp, IDR, $, ¥) and formatting characters
3. Remove thousand separators (periods in Indonesian format)
4. Ignore decimal cents after comma (,00 is common)
5. Return ONLY a plain number

## DATE EXTRACTION RULES
Common formats: dd/mm/yyyy, dd-mm-yyyy, dd MMM yyyy, yyyy-mm-dd
Convert ALL formats to YYYY-MM-DD. In Indonesia dd/mm/yyyy is standard so prefer day-first.

## COUNTERPARTY / MERCHANT EXTRACTION
- For QRIS/POS receipts: merchant/store name (usually the largest text at the top)
- For bank transfers: beneficiary/payee name
- For e-wallet: merchant name
- For income receipts: sender/source name
- If no name is found, use empty string ""

## DESCRIPTION GENERATION
Create a short, natural description based on what you see. Keep it under 50 characters, in the user's language.

## PAYMENT METHOD DETECTION
| Sign in text | Payment Method ID | Label |
|---|---|---|
| QRIS logo, "QRIS", "QR Payment" | acc-qris | QRIS |
| "Debit", card digits, EDC/mPOS terminal | acc-bank | Bank |
| "Kartu Kredit", "Credit Card", "Visa", "Mastercard" | acc-credit-card | Credit Card |
| "GoPay", "OVO", "DANA", "ShopeePay", "LinkAja" | acc-qris | QRIS |
| "Tunai", "Cash" | acc-cash | Cash |
| Bank transfer confirmation | acc-bank | Bank |
| Salary credit to bank account | acc-bank | Bank |
| No payment method visible | acc-cash | Cash |

Available payment method accounts:
${paymentMethodListStr}

## ACCOUNT MATCHING — CATEGORY HEURISTICS
| Keywords in text | Match to account type |
|---|---|
| makan, minuman, restoran, café, coffee, kopi, teh, nasi, mie, food, restaurant, 餐, 吃 | Food & Beverages |
| transport, taxi, grab, gojek, bensin, fuel, gas, parkir, 交通, 汽油 | Transportation |
| listrik, PLN, air PDAM, internet, wifi, pulsa, phone, bill, 电, 水, 网 | Utilities |
| sewa, kost, apartemen, rental, 租, 房租 | Rent |
| film, movie, bioskop, game, streaming, hiburan, entertainment, 电影, 游戏 | Entertainment |
| dokter, obat, apotek, rumah sakit, hospital, doctor, health, 医, 药 | Healthcare |
| belanja, mall, baju, clothes, shopping, supermarket, 购, 超市 | Shopping |
| kursus, buku, sekolah, education, 书, 课, 教育 | Education |
| gaji, salary, payroll, 工资 | Salary (Income) |
| jual, penjualan, sales, 销, 售 | Sales (Income) |

IMPORTANT: Always select the accountId from the AVAILABLE ACCOUNTS list.

## AVAILABLE ACCOUNTS
${accountListStr}

## RESPONSE FORMAT
Return ONLY this exact JSON structure (no markdown fences, no extra text):
{
  "text": "Brief confirmation message",
  "suggestedType": "income" or "expense",
  "suggestedAccountId": "<exact id from available category accounts>",
  "suggestedAccountName": "<matched category account display name>",
  "suggestedOpponentAccountId": "<exact id from payment method accounts>",
  "amount": <number>,
  "date": "<YYYY-MM-DD or empty string>",
  "counterparty": "<merchant/sender name or empty string>",
  "description": "<brief description in user language>",
  "paymentMethod": "<payment method label, e.g. QRIS, Bank, Cash, Credit Card>"
}`;

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
              { role: 'user', content: `Parse the following receipt OCR text into structured transaction data:\n\n${text}` },
            ],
            temperature: 0.3,
            maxTokens: 1024,
          },
        );

        // Parse JSON from the response
        let parsed: any;
        try {
          let jsonStr = rawContent.trim();
          const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
          if (fenceMatch) jsonStr = fenceMatch[1].trim();
          parsed = JSON.parse(jsonStr);
        } catch {
          parsed = {};
        }

        // Validate payment method ID
        const validPaymentIds = new Set(cashBankAccounts.map(a => a.id));
        const paymentMethodId = typeof parsed.suggestedOpponentAccountId === 'string' && validPaymentIds.has(parsed.suggestedOpponentAccountId)
          ? parsed.suggestedOpponentAccountId
          : detectPaymentMethod(text);

        const paymentMethodName = typeof parsed.paymentMethod === 'string' && parsed.paymentMethod
          ? parsed.paymentMethod
          : paymentMethodId === 'acc-qris' ? 'QRIS'
            : paymentMethodId === 'acc-bank' ? 'Bank'
              : paymentMethodId === 'acc-credit-card' ? 'Credit Card'
                : 'Cash';

        const result = {
          text: typeof parsed.text === 'string' ? parsed.text : '',
          suggestedType: parsed.suggestedType === 'income' ? 'income' : 'expense',
          suggestedAccountId: typeof parsed.suggestedAccountId === 'string' ? parsed.suggestedAccountId : '',
          suggestedAccountName: typeof parsed.suggestedAccountName === 'string' ? parsed.suggestedAccountName : '',
          suggestedOpponentAccountId: paymentMethodId,
          amount: typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : 0,
          date: typeof parsed.date === 'string' ? parsed.date : '',
          counterparty: typeof parsed.counterparty === 'string' ? parsed.counterparty : '',
          description: typeof parsed.description === 'string' ? parsed.description : '',
          paymentMethod: paymentMethodName,
          source: 'ai' as const,
        };

        return NextResponse.json(result);
      } catch (aiError: any) {
        console.error('AI receipt parsing failed, falling back to local:', aiError.message);
        // Fall through to local regex parsing
      }
    }

    // Local regex fallback (no AI available)
    const amountResult = extractAmountFromText(text);
    const txType = detectTransactionType(text) || 'expense';
    const matchedAccount = accounts ? matchAccountFromText(text, accounts, txType) : null;
    const opponentId = detectPaymentMethod(text);
    const counterparty = extractCounterparty(text);
    const date = extractDate(text);

    // Get opponent account display name
    const opponentAcc = cashBankAccounts.find(a => a.id === opponentId);
    const paymentMethodName = opponentAcc
      ? (lang === 'id' && opponentAcc.nameId ? opponentAcc.nameId : lang === 'zh' && opponentAcc.nameZh ? opponentAcc.nameZh : opponentAcc.name)
      : 'Cash';

    const result = {
      text: '',
      suggestedType: txType,
      suggestedAccountId: matchedAccount?.id || '',
      suggestedAccountName: matchedAccount
        ? (lang === 'id' && matchedAccount.nameId ? matchedAccount.nameId : lang === 'zh' && matchedAccount.nameZh ? matchedAccount.nameZh : matchedAccount.name)
        : '',
      suggestedOpponentAccountId: opponentId,
      amount: amountResult?.amount || 0,
      date,
      counterparty,
      description: counterparty || '',
      paymentMethod: paymentMethodName,
      source: 'local' as const,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Parse receipt error:', error);
    return NextResponse.json(
      { error: 'Receipt parsing failed', message: error.message },
      { status: 500 }
    );
  }
}
