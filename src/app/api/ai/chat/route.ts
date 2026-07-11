import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, type AiProviderConfig, AI_PROVIDERS } from '@/lib/ai-provider';
import { keywordMap, extractAmountFromText, matchAccountFromText, type AccountInfo } from '@/lib/keyword-map';

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
  editAction: null;
  fallback: boolean;
} | null {
  const amountResult = extractAmountFromText(message);
  if (!amountResult) return null;

  const { amount, amountStr } = amountResult;
  const lower = message.toLowerCase();

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
    editAction: null,
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
      aiConfig?: AiProviderConfig;
    };
    message = bodyData.message;
    accounts = bodyData.accounts;
    const { lang, financialContext, aiConfig } = bodyData;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Check if AI is configured
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

### 3. Edit Transaction Amount
When the user asks to change/correct/update a transaction's amount (e.g. "change my last transaction to 50k", "update the last one to 50000", "correct last transaction amount to 25k"):
- Identify the target transaction (default: the most recent one) from the Recent Transactions data and copy its exact "id"
- Parse the new amount (apply the same Indonesian slang rules: "juta"/"ribu"/"rb"/"k")
- Return an edit action with the transactionId, the new amount, and the original amount (oldAmount) from the data
- Deletion is NOT supported — never return a delete action; tell the user to use the History screen if they ask to delete

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

For an **edit amount request**:
\`\`\`json
{
  "text": "I'll update [description] from [oldAmount] to [amount]",
  "action": {
    "type": "edit",
    "data": {
      "transactionId": "the-exact-tx-id-from-data",
      "amount": 50000,
      "oldAmount": 30000,
      "description": "the transaction description from data"
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
6. For edit actions, always reference the specific transaction and show old → new amount so the user can confirm.
7. Be concise but informative. Use bullet points for breakdowns.
8. The "amount" in transaction actions must ALWAYS be the full numeric value, never abbreviated.
9. When in doubt about whether something is a transaction, treat it as a transaction.
10. NEVER say you don't have access to data — you DO have the data above!`;

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
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        maxTokens: 1024,
      },
    );

    // Try to parse JSON from the LLM response
    let parsed: {
      text: string;
      action: null | {
        type: 'transaction' | 'edit';
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

      if (action.type === 'edit' && action.data) {
        // Validate transactionId + positive amount
        if (!action.data.transactionId ||
            typeof action.data.amount !== 'number' ||
            action.data.amount <= 0 ||
            !isFinite(action.data.amount)) {
          parsed.action = null;
        }
      }
    }

    // Build response
    const result: any = {
      response: parsed.text,
      transaction: null,
      editAction: null,
    };

    // Extract transaction action (backward compatible)
    if (parsed.action?.type === 'transaction' && parsed.action.data) {
      result.transaction = {
        ...parsed.action.data,
        opponentAccountId: defaultCashAccount,
      };
    }

    // Extract edit action (amount change on an existing transaction)
    if (parsed.action?.type === 'edit' && parsed.action.data) {
      result.editAction = parsed.action.data;
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
      { response: 'Sorry, I am currently unavailable. Please try again later.', transaction: null, editAction: null },
      { status: 200 }
    );
  }
}
