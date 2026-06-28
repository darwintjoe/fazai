import { NextRequest, NextResponse } from 'next/server';
import { visionCompletion, type AiProviderConfig } from '@/lib/ai-provider';

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
        return NextResponse.json({ error: 'AI_API_KEY_NOT_SET' }, { status: 200 });
      }
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

    const systemPrompt = `You are FAZAI, a smart financial assistant. You analyze payment receipt images and extract transaction data. Respond in ${langName}.

## YOUR TASK
Analyze the receipt image and extract transaction information. Receipts may be from:
- QRIS payments (Indonesian QR payment standard)
- Bank transfer confirmations
- Cash receipts
- E-wallet payment confirmations
- POS/payment terminal receipts

## AVAILABLE ACCOUNTS
${accountListStr}

## RESPONSE FORMAT
Return ONLY valid JSON (no markdown, no code fences):
{
  "type": "income" or "expense",
  "amount": <number, full value e.g. 50000 not 50k>,
  "counterparty": "<merchant or sender name, empty string if not found>",
  "description": "<brief description of the transaction>",
  "accountId": "<id from available accounts that best matches, or empty string>",
  "accountName": "<matched account name or empty string>",
  "date": "<YYYY-MM-DD if found, or empty string>",
  "reference": "<transaction/reference number if found, or empty string>"
}

## RULES
1. This is usually an EXPENSE (payment). Only mark as INCOME if the receipt clearly shows money received.
2. Match the account to the most relevant category from the available accounts.
3. Amount must be a plain number (e.g. 50000), never abbreviated.
4. If unsure about any field, use empty string or 0.
5. Return ONLY the JSON object, nothing else.`;

    const rawContent = await visionCompletion(
      {
        provider: aiConfig.provider,
        model: aiConfig.model || '',
        apiKey: aiConfig.apiKey,
        endpoint: aiConfig.endpoint || undefined,
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
