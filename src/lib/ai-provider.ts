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
  | 'groq'
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
  groq: {
    id: 'groq',
    name: 'Groq',
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    openaiCompatible: true,
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
    defaultEndpoint: 'https://api.z.ai/v1',
    defaultModel: 'z-ai-default',
    models: ['z-ai-default'],
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

interface ChatMessageContent {
  type: 'text';
  text: string;
}

interface ChatMessageImageContent {
  type: 'image_url';
  image_url: { url: string };
}

type ChatContentPart = ChatMessageContent | ChatMessageImageContent;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContentPart[];
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

// ── OpenAI-compatible (OpenAI, Groq, DeepSeek, Qwen, Kimi, Z.Ai) ──

function isImageContent(content: string | ChatContentPart[]): content is ChatContentPart[] {
  return Array.isArray(content);
}

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

// ── OpenAI-compatible Vision ──

async function callOpenAICompatibleVision(
  endpoint: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
): Promise<string> {
  const url = `${endpoint.replace(/\/+$/, '')}/chat/completions`;

  const dataUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI Vision API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Anthropic Vision ──

async function callAnthropicVision(
  endpoint: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
): Promise<string> {
  const url = `${endpoint.replace(/\/+$/, '')}/messages`;

  // Strip data URI prefix if present
  const rawBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      max_tokens: 1024,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: rawBase64,
            },
          },
          {
            type: 'text',
            text: userText,
          },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic Vision API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ── Google Gemini Vision ──

async function callGoogleVision(
  endpoint: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
): Promise<string> {
  const url = `${endpoint.replace(/\/+$/, '')}/models/${model}:generateContent?key=${apiKey}`;

  // Strip data URI prefix if present
  const rawBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: rawBase64 } },
          { text: userText },
        ],
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Vision API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Send a vision request (text + image) to the configured AI provider.
 * Returns the assistant's text content.
 */
export async function visionCompletion(
  config: AiProviderConfig,
  options: {
    systemPrompt: string;
    userText: string;
    imageBase64: string;
  },
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('AI_API_KEY_NOT_SET');
  }

  const info = AI_PROVIDERS[config.provider];
  const endpoint = getEndpoint(config);
  const model = config.model || info.defaultModel;
  const { systemPrompt, userText, imageBase64 } = options;

  if (info.openaiCompatible) {
    return callOpenAICompatibleVision(endpoint, config.apiKey, model, systemPrompt, userText, imageBase64);
  }

  if (config.provider === 'anthropic') {
    return callAnthropicVision(endpoint, config.apiKey, model, systemPrompt, userText, imageBase64);
  }

  if (config.provider === 'google') {
    return callGoogleVision(endpoint, config.apiKey, model, systemPrompt, userText, imageBase64);
  }

  throw new Error(`Unsupported provider for vision: ${config.provider}`);
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
