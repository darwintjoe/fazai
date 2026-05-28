import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, lang } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const ZAi = (await import('z-ai-web-dev-sdk')).default;
    const ai = await ZAi.create();

    const systemPrompt = `You are FAZAI, a helpful financial assistant for a simple accounting app. 
The user is asking about their finances. Respond in ${lang === 'id' ? 'Indonesian' : lang === 'zh' ? 'Chinese' : 'English'}.
Keep responses concise and helpful. If asked about specific numbers, remind the user to check their reports.
You can help with:
- Understanding accounting concepts
- Suggesting budget tips
- Explaining income/expense categories
- General financial advice
Be friendly and professional.`;

    const response = await ai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });

    const messageContent = response.choices?.[0]?.message?.content || 'I could not generate a response.';
    return NextResponse.json({ response: messageContent });
  } catch (error: any) {
    console.error('AI Chat error:', error);
    return NextResponse.json(
      { response: 'Sorry, I am currently unavailable. Please try again later.' },
      { status: 200 }
    );
  }
}
