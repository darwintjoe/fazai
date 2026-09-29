import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, type AiProviderConfig, AI_PROVIDERS } from '@/lib/ai-provider';

interface ParsedAccount {
  name: string;
  category: string;
  balance: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, lang, categories, aiConfig } = body as {
      text: string;
      lang: string;
      categories?: Array<{ id: string; name: string; nameId?: string; nameZh?: string; group: string }>;
      aiConfig?: AiProviderConfig;
    };

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!aiConfig?.apiKey) {
      if (aiConfig?.provider === 'zai' && process.env.ZAI_API_KEY) {
        aiConfig.apiKey = process.env.ZAI_API_KEY;
      } else {
        throw new Error('AI_API_KEY_NOT_SET');
      }
    }

    const resolvedModel = aiConfig.model || AI_PROVIDERS[aiConfig.provider]?.defaultModel || '';
    const resolvedEndpoint = aiConfig.endpoint || undefined;
    const langName = lang === 'id' ? 'Indonesian' : lang === 'zh' ? 'Chinese' : 'English';

    const catListStr = (categories || []).map(c => {
      const display = lang === 'id' && c.nameId ? c.nameId : lang === 'zh' && c.nameZh ? c.nameZh : c.name;
      return `  - "${display}" (id: "${c.id}", group: ${c.group})`;
    }).join('\n') || '  (no categories)';

    const systemPrompt = `You are FAZAI, a chart-of-accounts import parser. Extract account rows from messy source text (CSV dump, PDF statement, or OCR output). Respond in ${langName}.

## AVAILABLE CATEGORIES
${catListStr}

## RESPONSE FORMAT
Return ONLY this JSON, no markdown, no fences:
{ "accounts": [ { "name": "Kas Kecil", "category": "cat-cashbank", "balance": 500000 } ] }

## RULES
1. Only "name" is required. If a row has no usable account name, skip it.
2. "category" must be one of the AVAILABLE CATEGORIES ids. Guess from keywords when the source has no category. Use "cat-other-expense" when unsure.
3. "balance" is a plain positive number or null when absent. Strip Rp/IDR, thousand separators, decimals.
4. Ignore titles, headers, footers, totals, page numbers. Never import them as accounts.
5. Column order is free; detect name/category/balance by content, not position.
6. Clean names to Title Case, trim whitespace.`;

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
          { role: 'user', content: `Extract accounts from this source text:\n\n${text}` },
        ],
        temperature: 0.2,
        maxTokens: 8000,
      },
    );

    let parsed: { accounts?: ParsedAccount[] };
    try {
      let jsonStr = rawContent.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { accounts: [] };
    }

    const validCatIds = new Set((categories || []).map(c => c.id));
    const accounts = (parsed.accounts || [])
      .filter(a => typeof a?.name === 'string' && a.name.trim().length > 0)
      .map(a => ({
        name: a.name.trim(),
        category: typeof a.category === 'string' && validCatIds.has(a.category) ? a.category : 'cat-other-expense',
        balance: typeof a.balance === 'number' && a.balance >= 0 ? a.balance : null,
      }));

    return NextResponse.json({ accounts });
  } catch (error: any) {
    if (error?.message === 'AI_API_KEY_NOT_SET') {
      return NextResponse.json({ error: 'AI_API_KEY_NOT_SET', message: 'AI API key is not set.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'AI parsing failed', message: error?.message || 'Unknown error' }, { status: 500 });
  }
}
