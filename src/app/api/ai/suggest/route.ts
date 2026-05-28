import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, counterparty, type, accounts } = body;

    if (!description && !counterparty) {
      return NextResponse.json({ accountId: null, accountName: null });
    }

    // Simple keyword-based suggestion (can be enhanced with AI)
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

    const searchText = `${description} ${counterparty}`.toLowerCase();
    let matchedCode: string | null = null;

    for (const [keyword, code] of Object.entries(keywordMap)) {
      if (searchText.includes(keyword)) {
        // Only match if the type aligns
        if (type === 'income' && code.startsWith('4')) {
          matchedCode = code;
          break;
        }
        if (type === 'expense' && code.startsWith('5')) {
          matchedCode = code;
          break;
        }
      }
    }

    if (!matchedCode) {
      // Default suggestions based on type
      matchedCode = type === 'income' ? '4-9000' : '5-9000';
    }

    const matchedAccount = accounts?.find((a: any) => a.code === matchedCode);

    return NextResponse.json({
      accountId: matchedAccount?.id || null,
      accountName: matchedAccount?.name || null,
    });
  } catch (error) {
    console.error('AI Suggest error:', error);
    return NextResponse.json({ accountId: null, accountName: null });
  }
}
