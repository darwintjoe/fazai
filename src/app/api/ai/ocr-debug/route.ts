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

/**
 * Diagnostic OCR endpoint.
 * Same logic as /api/ai/ocr but returns the RAW AI response
 * alongside the parsed result, so you can see exactly what the model output.
 *
 * NOT intended for production use — this is a debugging tool.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, lang, accounts, aiConfig } = body as {
      image: string;
      lang: string;
      accounts?: AccountInfo[];
      aiConfig?: AiProviderConfig;
    };

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    if (!aiConfig?.apiKey) {
      if (aiConfig?.provider === 'zai' && process.env.ZAI_API_KEY) {
        aiConfig.apiKey = process.env.ZAI_API_KEY;
      } else {
        throw new Error('AI_API_KEY_NOT_SET');
      }
    }

    // Resolve model — same logic as ocr route
    if (!aiConfig.model) {
      aiConfig.model = 'GLM-4.6V-Flash';
    }
    if (!aiConfig.endpoint) {
      aiConfig.endpoint = AI_PROVIDERS[aiConfig.provider]?.defaultEndpoint || undefined;
    }

    const actualModel = aiConfig.model;

    // Minimal prompt for diagnostic — just extract the text you can see
    const diagnosticPrompt = `You are a receipt OCR diagnostic tool. Analyze this receipt image and:
1. First, describe in plain words what text you can see on this receipt. List every line of text you can read.
2. Then identify the total amount (the FINAL amount to pay).
3. Then identify the merchant/store name.
4. Then identify the date.
5. Then identify the payment method used.

Be thorough and precise. If you cannot see certain text clearly, say so.`;

    // Call 1: diagnostic (plain text response)
    const rawDiagnostic = await visionCompletion(
      {
        provider: aiConfig.provider,
        model: aiConfig.model,
        apiKey: aiConfig.apiKey,
        endpoint: aiConfig.endpoint,
      },
      {
        systemPrompt: diagnosticPrompt,
        userText: 'Read this receipt image carefully. Describe every line of text you can see.',
        imageBase64: image,
      },
    );

    // Call 2: structured JSON extraction (same as production OCR)
    const langName = lang === 'id' ? 'Indonesian' : lang === 'zh' ? 'Chinese' : 'English';
    const incomeAccounts = accounts?.filter(a => a.type === 'income') || [];
    const expenseAccounts = accounts?.filter(a => a.type === 'expense') || [];
    const cashBankAccounts = accounts?.filter(a => a.type === 'cashBank' && a.id !== 'acc-cashbank-root') || [];

    const ocrPrompt = `You are FAZAI, a receipt OCR assistant. Return ONLY a JSON object:
{
  "type": "income" or "expense",
  "amount": <number>,
  "counterparty": "<merchant name>",
  "description": "<brief description in ${langName}>,
  "accountId": "<category account id>",
  "accountName": "<category name>",
  "paymentMethodId": "<cash/bank account id>",
  "paymentMethod": "<payment method label>",
  "date": "<YYYY-MM-DD>",
  "reference": ""
}

Rules: amount is ALWAYS a plain number. Use the TOTAL line. ${langName} response.`;

    const rawJson = await visionCompletion(
      {
        provider: aiConfig.provider,
        model: aiConfig.model,
        apiKey: aiConfig.apiKey,
        endpoint: aiConfig.endpoint,
      },
      {
        systemPrompt: ocrPrompt,
        userText: 'Extract the transaction data from this receipt image.',
        imageBase64: image,
      },
    );

    // Parse JSON
    let parsed: Record<string, unknown> = {};
    try {
      let jsonStr = rawJson.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { _parseError: 'Failed to parse JSON from AI response' };
    }

    return NextResponse.json({
      model: actualModel,
      provider: aiConfig.provider,
      diagnosticResponse: rawDiagnostic,
      structuredRawResponse: rawJson,
      parsed,
      accountsUsed: {
        income: incomeAccounts.length,
        expense: expenseAccounts.length,
        cashBank: cashBankAccounts.length,
      },
    });
  } catch (error: any) {
    console.error('OCR debug error:', error);
    return NextResponse.json(
      { error: 'OCR debug failed', message: error.message },
      { status: 500 },
    );
  }
}
