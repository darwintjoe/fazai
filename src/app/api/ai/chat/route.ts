import { NextRequest, NextResponse } from 'next/server';

interface AccountInfo {
  id: string;
  name: string;
  nameId?: string;
  nameZh?: string;
  type: string;
  code: string;
}

// Keyword map shared with /api/ai/suggest for fallback matching
const keywordMap: Record<string, string> = {
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

/** Try keyword-based fallback when AI is unavailable.
 *  Parses the message for an amount and type hint, then matches keywords. */
function keywordFallback(message: string, accounts?: AccountInfo[]): {
  response: string;
  transaction: null | {
    type: 'income' | 'expense';
    amount: number;
    description: string;
    accountId: string;
    counterparty: string;
    opponentAccountId: string;
  };
  deleteAction: null;
  fallback: boolean;
} | null {
  const lower = message.toLowerCase();

  // Try to extract amount from message
  let amount = 0;
  let amountStr = '';

  // Indonesian slang: juta, ribu, rb, k
  const jutaMatch = lower.match(/(\d[\d.,]*)\s*juta/);
  const ribuMatch = lower.match(/(\d[\d.,]*)\s*(ribu|rb)\b/);
  const kMatch = lower.match(/(\d[\d.,]*)k\b/);
  const plainMatch = lower.match(/(?:rp\.?|idr)\s*(\d[\d.,]*)/i);
  // Match formatted numbers (1.000.000 or 1,000,000) OR plain integers (5000, 100000)
  const numberMatch = lower.match(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?)/) || lower.match(/\b(\d+)\b/);

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

  // Determine transaction type from keywords
  const expenseHints = ['beli', 'bayar', 'keluar', 'spend', 'buy', 'pay', 'expense', 'cost', '买', '付', '花'];
  const incomeHints = ['terima', 'masuk', 'dapat', 'receive', 'income', 'salary', 'gaji', '收', '赚'];

  let txType: 'income' | 'expense' = 'expense'; // default to expense
  let hasTypeHint = false;
  for (const hint of expenseHints) {
    if (lower.includes(hint)) { txType = 'expense'; hasTypeHint = true; break; }
  }
  if (!hasTypeHint) {
    for (const hint of incomeHints) {
      if (lower.includes(hint)) { txType = 'income'; hasTypeHint = true; break; }
    }
  }

  // Keyword match for account
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

  // Resolve account ID from code
  const matchedAccount = accounts?.find(a => a.code === matchedCode);
  if (!matchedAccount) return null;

  // Build description from message (remove the amount part)
  const description = message.replace(new RegExp(amountStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim().substring(0, 100) || message.substring(0, 100);

  // Default cash account
  const cashBankAccounts = accounts?.filter(a => a.type === 'cashBank' && a.id !== 'acc-cashbank-root') || [];
  const defaultCashAccount = cashBankAccounts.length > 0 ? cashBankAccounts[0].id : 'acc-cash';

  return {
    response: `I recorded this using keyword matching (AI is currently offline). Please verify the account is correct before confirming.`,
    transaction: {
      type: txType,
      amount,
      description,
      accountId: matchedAccount.id,
      counterparty: '',
      opponentAccountId: defaultCashAccount,
    },
    deleteAction: null,
    fallback: true,
  };
}

export async function POST(request: NextRequest) {
  let message = '';
  let accounts: AccountInfo[] | undefined;

  try {
    const body = await request.json();
    const bodyData = body as {
      message: string;
      lang: string;
      accounts?: AccountInfo[];
      financialContext?: string;
    };
    message = bodyData.message;
    accounts = bodyData.accounts;
    const { lang, financialContext } = bodyData;

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

    // Try keyword-based fallback
    const fallback = keywordFallback(message, accounts);
    if (fallback) {
      return NextResponse.json(fallback, { status: 200 });
    }

    return NextResponse.json(
      { response: 'Sorry, I am currently unavailable. Please try again later.', transaction: null, deleteAction: null },
      { status: 200 }
    );
  }
}
