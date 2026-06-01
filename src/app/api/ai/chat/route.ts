import { NextRequest, NextResponse } from 'next/server';

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
    const { message, lang, accounts } = body as {
      message: string;
      lang: string;
      accounts?: AccountInfo[];
    };

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const ZAi = (await import('z-ai-web-dev-sdk')).default;
    const ai = await ZAi.create();

    const langName = lang === 'id' ? 'Indonesian' : lang === 'zh' ? 'Chinese' : 'English';

    // Build account list for the LLM
    const accountListStr = accounts && accounts.length > 0
      ? accounts
          .filter(a => a.type === 'income' || a.type === 'expense')
          .map(a => {
            const displayName = lang === 'id' && a.nameId ? a.nameId : lang === 'zh' && a.nameZh ? a.nameZh : a.name;
            return `  - id: "${a.id}", name: "${displayName}", type: ${a.type}`;
          })
          .join('\n')
      : '  (no accounts available)';

    const cashBankAccounts = accounts && accounts.length > 0
      ? accounts.filter(a => a.type === 'cashBank' && a.id !== 'acc-cashbank-root')
      : [];

    const defaultCashAccount = cashBankAccounts.length > 0 ? cashBankAccounts[0].id : 'acc-cash';

    const systemPrompt = `You are FAZAI, a helpful financial assistant for a simple cash-basis accounting app. Respond in ${langName}.

You have TWO modes:

**Mode 1 — Transaction Recording (PRIMARY)**
When the user describes a financial event (spending, receiving, buying, selling, income, expense, etc.), you MUST extract it as a transaction.

Examples of transaction inputs:
- "beli makan 5000" → expense 5000, food account
- "terima gaji 1 juta" → income 1000000, salary account  
- "bayar listrik 300ribu" → expense 300000, utilities account
- "got salary 5000" → income 5000, salary account
- "lunch 25k" → expense 25000, food account
- "买饭50" → expense 50, food account

Indonesian slang parsing:
- "juta" = million (1 juta = 1000000, 2.5 juta = 2500000)
- "ribu" / "rb" / "k" = thousand (5 ribu = 5000, 25k = 25000)
- "beli" / "bayar" / "keluar" = expense
- "terima" / "masuk" / "dapat" = income

Available accounts:
${accountListStr}

**Mode 2 — General Chat**
For questions about accounting concepts, budget tips, financial advice, or anything not transaction-related, respond normally.

---

**RESPONSE FORMAT — You MUST return valid JSON:**

\`\`\`json
{
  "text": "Your conversational response to the user",
  "transaction": null
}
\`\`\`

OR when a transaction is detected:

\`\`\`json
{
  "text": "Brief confirmation message",
  "transaction": {
    "type": "expense",
    "amount": 5000,
    "description": "Beli makan",
    "accountId": "acc-food",
    "counterparty": ""
  }
}
\`\`\`

Transaction field rules:
- "type": must be "income" or "expense"
- "amount": MUST be a number (not string). Parse all slang: "1 juta"→1000000, "500ribu"→500000, "25k"→25000, "5rb"→5000
- "description": Brief description of the transaction in the user's language
- "accountId": MUST be one of the account IDs listed above. Pick the best match based on the description. If no good match, use the "Other Income" or "Other Expense" account.
- "counterparty": Person or entity (if mentioned, otherwise empty string "")

IMPORTANT:
- Always return valid JSON, nothing else.
- When in doubt about whether something is a transaction, treat it as a transaction.
- Be concise in the "text" field — just confirm what you understood.
- The "amount" must ALWAYS be the full numeric value, never abbreviated.`;

    const response = await ai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.3,
    });

    const rawContent = response.choices?.[0]?.message?.content || '';

    // Try to parse JSON from the LLM response
    let parsed: { text: string; transaction: null | {
      type: 'income' | 'expense';
      amount: number;
      description: string;
      accountId: string;
      counterparty: string;
    } };

    try {
      // Strip markdown code fences if present
      let jsonStr = rawContent.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, treat the whole response as plain text
      parsed = { text: rawContent, transaction: null };
    }

    // Validate transaction if present
    if (parsed.transaction) {
      const tx = parsed.transaction;
      // Ensure amount is a valid positive number
      if (typeof tx.amount !== 'number' || tx.amount <= 0 || !isFinite(tx.amount)) {
        parsed.transaction = null;
      }
      // Ensure type is valid
      if (tx.type !== 'income' && tx.type !== 'expense') {
        parsed.transaction = null;
      }
      // Validate accountId exists in the provided accounts
      if (accounts && accounts.length > 0) {
        const exists = accounts.some(a => a.id === tx.accountId);
        if (!exists) {
          // Try to find a fallback account
          const fallbackType = tx.type === 'income' ? 'income' : 'expense';
          const fallback = accounts.find(a => a.type === fallbackType && a.id.includes('other'));
          tx.accountId = fallback?.id || '';
          if (!tx.accountId) parsed.transaction = null;
        }
      }
    }

    return NextResponse.json({
      response: parsed.text,
      transaction: parsed.transaction ? {
        ...parsed.transaction,
        opponentAccountId: defaultCashAccount,
      } : null,
    });
  } catch (error: any) {
    console.error('AI Chat error:', error);
    return NextResponse.json(
      { response: 'Sorry, I am currently unavailable. Please try again later.', transaction: null },
      { status: 200 }
    );
  }
}
