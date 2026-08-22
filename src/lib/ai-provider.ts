/**
 * AI Provider Configuration & Factory
 *
 * Supports multiple LLM providers via their REST APIs.
 * OpenAI-compatible providers share the same request format.
 * Anthropic and Google use their native formats.
 */

export type AiProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'qwen'
  | 'kimi'
  | 'zai';

export interface AiProviderConfig {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  /** Override the default endpoint (optional, for self-hosted) */
  endpoint?: string;
}

export interface AiProviderInfo {
  id: AiProviderId;
  name: string;
  defaultEndpoint: string;
  defaultModel: string;
  models: string[];
  /** Whether this provider uses the OpenAI-compatible chat/completions format */
  openaiCompatible: boolean;
}

/** Console URLs where users can obtain API keys for each provider. */
export const AI_KEY_URLS: Record<AiProviderId, string> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  google: 'https://aistudio.google.com/app/apikey',
  deepseek: 'https://platform.deepseek.com/api_keys',
  qwen: 'https://dashscope.console.aliyun.com/apiKey',
  kimi: 'https://platform.moonshot.cn/console/api-keys',
  zai: 'https://api.z.ai',
};

export const AI_PROVIDERS: Record<AiProviderId, AiProviderInfo> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    openaiCompatible: true,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    defaultEndpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-haiku-4-5-20241022',
    models: ['claude-haiku-4-5-20241022', 'claude-sonnet-4-20250514', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'],
    openaiCompatible: false,
  },
  google: {
    id: 'google',
    name: 'Google',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    openaiCompatible: false,
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultEndpoint: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    openaiCompatible: true,
  },
  qwen: {
    id: 'qwen',
    name: 'Qwen',
    defaultEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long'],
    openaiCompatible: true,
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi',
    defaultEndpoint: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    openaiCompatible: true,
  },
  zai: {
    id: 'zai',
    name: 'Z.Ai',
    defaultEndpoint: 'https://api.z.ai/api/paas/v4/',
    defaultModel: 'z.ai/glm-4.7-flash',
    models: ['z.ai/glm-4.7-flash'],
    openaiCompatible: true,
  },
};

export function getProviderInfo(providerId: AiProviderId): AiProviderInfo {
  return AI_PROVIDERS[providerId];
}

export function getEndpoint(config: AiProviderConfig): string {
  const info = AI_PROVIDERS[config.provider];
  return config.endpoint?.trim() || info.defaultEndpoint;
}

/**
 * Fetch available models from a provider's API.
 * Only works for OpenAI-compatible providers that expose GET /v1/models.
 * Returns the static fallback list on error.
 */
export async function fetchModels(
  provider: AiProviderId,
  apiKey: string,
  endpoint?: string,
): Promise<string[]> {
  const info = AI_PROVIDERS[provider];
  if (!info.openaiCompatible) {
    return info.models;
  }

  const base = (endpoint?.trim() || info.defaultEndpoint).replace(/\/+$/, '');
  const url = `${base}/models`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return info.models;
    const data = await res.json();
    const ids: string[] = (data.data || [])
      .map((m: any) => m.id)
      .filter(Boolean)
      .sort();
    return ids.length > 0 ? ids : info.models;
  } catch {
    return info.models;
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

/**
 * Send a chat completion request to the configured AI provider.
 * Returns the assistant's text content.
 */
export async function chatCompletion(
  config: AiProviderConfig,
  options: ChatCompletionOptions,
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('AI_API_KEY_NOT_SET');
  }

  const info = AI_PROVIDERS[config.provider];
  const endpoint = getEndpoint(config);

  if (info.openaiCompatible) {
    return callOpenAICompatible(endpoint, config.apiKey, config.model, options);
  }

  if (config.provider === 'anthropic') {
    return callAnthropic(endpoint, config.apiKey, config.model, options);
  }

  if (config.provider === 'google') {
    return callGoogle(endpoint, config.apiKey, config.model, options);
  }

  throw new Error(`Unsupported provider: ${config.provider}`);
}

// ── OpenAI-compatible (OpenAI, DeepSeek, Qwen, Kimi, Z.Ai) ──

async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  options: ChatCompletionOptions,
): Promise<string> {
  const url = `${endpoint.replace(/\/+$/, '')}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1024,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Anthropic ──

async function callAnthropic(
  endpoint: string,
  apiKey: string,
  model: string,
  options: ChatCompletionOptions,
): Promise<string> {
  const url = `${endpoint.replace(/\/+$/, '')}/messages`;

  // Anthropic requires system prompt to be separate from messages
  const systemMsg = options.messages.find(m => m.role === 'system');
  const nonSystemMessages = options.messages.filter(m => m.role !== 'system');

  // Convert role names: Anthropic doesn't have 'system' in messages array
  const anthropicMessages = nonSystemMessages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const body: Record<string, unknown> = {
    model,
    messages: anthropicMessages,
    max_tokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.3,
  };

  if (systemMsg) {
    body.system = systemMsg.content;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ── Google Gemini ──

async function callGoogle(
  endpoint: string,
  apiKey: string,
  model: string,
  options: ChatCompletionOptions,
): Promise<string> {
  // Google Gemini API: POST /v1beta/models/{model}:generateContent?key={apiKey}
  const url = `${endpoint.replace(/\/+$/, '')}/models/${model}:generateContent?key=${apiKey}`;

  // Merge system prompt into the first user message (Gemini doesn't have system role)
  const systemMsg = options.messages.find(m => m.role === 'system');
  const nonSystemMessages = options.messages.filter(m => m.role !== 'system');

  const contents = nonSystemMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxTokens ?? 1024,
    },
  };

  // Prepend system instruction as systemInstruction
  if (systemMsg) {
    body.systemInstruction = {
      parts: [{ text: systemMsg.content }],
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Test the connection to an AI provider by sending a minimal request.
 * Returns the model's response text on success.
 */
export async function testConnection(config: AiProviderConfig): Promise<string> {
  const result = await chatCompletion(config, {
    messages: [
      { role: 'user', content: 'Reply with only: OK' },
    ],
    temperature: 0,
    maxTokens: 10,
  });
  return result.trim();
}
