import { NextRequest, NextResponse } from 'next/server';
import { fetchModels, type AiProviderId, AI_PROVIDERS } from '@/lib/ai-provider';

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, endpoint } = (await request.json()) as {
      provider: AiProviderId;
      apiKey: string;
      endpoint?: string;
    };

    if (!provider || !apiKey) {
      return NextResponse.json({ error: 'provider and apiKey are required' }, { status: 400 });
    }

    const info = AI_PROVIDERS[provider];
    if (!info) {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    // Non-OpenAI-compatible providers return static lists
    if (!info.openaiCompatible) {
      return NextResponse.json({ models: info.models });
    }

    const models = await fetchModels(provider, apiKey, endpoint);
    return NextResponse.json({ models });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch models' },
      { status: 500 },
    );
  }
}
