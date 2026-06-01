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
    const { message, lang, accounts, financialContext } = body as {
      message: string;
      lang: string;
      accounts?: AccountInfo[];
      financialContext?: string;
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

    const contextBlock = financialContext
      ? `\n\n=== USER'S FINANCIAL DATA (REAL-TIME) ===\n${financialContext}\n=== END FINANCIAL DATA ===\n`
      : '';

    const systemPrompt = `You are FAZAI, a smart financial assistant for a cash-basis accounting app. Respond in ${langName}.

You have FULL ACCESS to the user's real-time financial data below. Use it to answer questions accurately with real numbers.

${contextBlock}

## YOUR CAPABILITIES

### 1. Transaction Recording
When the user describes a financial event (spending, receiving, buying, selling, etc.), extract it as a transaction.

Indonesian slang parsing:
- "juta" = million (1 juta = 1000000, 2.5 juta = 2500000)
- "ribu" / "rb" / "k" = thousand (5 ribu = 5000, 25k = 25000)
- "beli" / "bayar" / "keluar" = expense
- "terima" / "masuk" / "dapat" = income

Available accounts:
${accountListStr}

### 2. Financial Queries (USE THE FINANCIAL DATA ABOVE!)
You CAN and SHOULD answer these using the real data provided:
- "How much is my balance?" → Report the Cash & Bank Balance from the data
- "How much did I spend this month?" → Sum up expense categories from This Month data
- "Total income this month" → Sum up income categories from This Month data
- "What's my biggest expense?" → Analyze expense categories and identify the largest
- "Show my recent transactions" → List them from the Recent Transactions data
- "Compare this month vs last month" → Use This Month vs Last Month data
- "How much did I spend on food?" → Find the food category amount
- "Am I saving money?" → Compare income vs expenses
- Any question about the user's finances → USE THE DATA!

### 3. Delete Last Transaction
When the user says "delete last", "cancel last", "remove last transaction", etc.:
- Find the most recent transaction ID from the data
- Return a delete action with that transaction ID
- Confirm what will be deleted before proceeding

### 4. Financial Insights & Advice
Based on the real data, provide:
- Spending pattern analysis
- Savings rate calculation
- Budget recommendations
- Category-by-category breakdowns
- Month-over-month trend analysis
- Unusual spending alerts

### 5. General Financial Knowledge
Accounting concepts, budget tips, tax basics, etc.

---

## RESPONSE FORMAT — You MUST return valid JSON:

For a **transaction recording**:
\`\`\`json
{
  "text": "Brief confirmation message",
  "action": {
    "type": "transaction",
    "data": {
      "type": "expense",
      "amount": 5000,
      "description": "Beli makan",
      "accountId": "acc-food",
      "counterparty": ""
    }
  }
}
\`\`\`

For a **delete request**:
\`\`\`json
{
  "text": "I'll delete the last transaction: [description] for [amount]",
  "action": {
    "type": "delete",
    "data": {
      "transactionId": "the-tx-id-from-data"
    }
  }
}
\`\`\`

For **all other responses** (queries, insights, advice, general chat):
\`\`\`json
{
  "text": "Your detailed response using real financial data. Include specific numbers, calculations, and percentages.",
  "action": null
}
\`\`\`

## IMPORTANT RULES:
1. ALWAYS return valid JSON, nothing else.
2. When answering financial queries, USE THE REAL NUMBERS from the financial data above. Be specific and precise.
3. For financial queries, break down numbers clearly (e.g., "Your total expense this month is Rp 2,500,000, broken down as: Food Rp 1,000,000, Transport Rp 500,000...").
4. When calculating totals, sum up ALL relevant categories from the data.
5. For comparisons, calculate percentage changes (e.g., "Expense increased 25% from last month").
6. For delete actions, always reference the specific transaction so the user can confirm.
7. Be concise but informative. Use bullet points for breakdowns.
8. The "amount" in transaction actions must ALWAYS be the full numeric value, never abbreviated.
9. When in doubt about whether something is a transaction, treat it as a transaction.
10. NEVER say you don't have access to data — you DO have the data above!`;

    const response = await ai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.3,
    });

    const rawContent = response.choices?.[0]?.message?.content || '';

    // Try to parse JSON from the LLM response
    let parsed: {
      text: string;
      action: null | {
        type: 'transaction' | 'delete';
        data: any;
      };
    };

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
      parsed = { text: rawContent, action: null };
    }

    // Validate and process action
    if (parsed.action) {
      const action = parsed.action;

      if (action.type === 'transaction' && action.data) {
        const tx = action.data;
        // Ensure amount is a valid positive number
        if (typeof tx.amount !== 'number' || tx.amount <= 0 || !isFinite(tx.amount)) {
          parsed.action = null;
        }
        // Ensure type is valid
        if (tx.type !== 'income' && tx.type !== 'expense') {
          parsed.action = null;
        }
        // Validate accountId exists in the provided accounts
        if (accounts && accounts.length > 0) {
          const exists = accounts.some(a => a.id === tx.accountId);
          if (!exists) {
            const fallbackType = tx.type === 'income' ? 'income' : 'expense';
            const fallback = accounts.find(a => a.type === fallbackType && a.id.includes('other'));
            tx.accountId = fallback?.id || '';
            if (!tx.accountId) parsed.action = null;
          }
        }
      }

      if (action.type === 'delete' && action.data) {
        // Validate transactionId is present
        if (!action.data.transactionId) {
          parsed.action = null;
        }
      }
    }

    // Build response
    const result: any = {
      response: parsed.text,
      transaction: null,
      deleteAction: null,
    };

    // Extract transaction action (backward compatible)
    if (parsed.action?.type === 'transaction' && parsed.action.data) {
      result.transaction = {
        ...parsed.action.data,
        opponentAccountId: defaultCashAccount,
      };
    }

    // Extract delete action
    if (parsed.action?.type === 'delete' && parsed.action.data) {
      result.deleteAction = parsed.action.data;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('AI Chat error:', error);
    return NextResponse.json(
      { response: 'Sorry, I am currently unavailable. Please try again later.', transaction: null, deleteAction: null },
      { status: 200 }
    );
  }
}
