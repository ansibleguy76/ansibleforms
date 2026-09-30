'use strict';

/**
 * The providers the chat knows. Two protocols : Anthropic's Messages API, and the OpenAI
 * Chat Completions API that almost every other vendor, proxy and local model server speaks.
 * An empty base url, auth type or api version falls back to the provider's own. `url`
 * marks a provider without a fixed endpoint : its base url must be set.
 */
export const CHAT_VENDORS = {
  anthropic: { protocol: 'anthropic', base_url: 'https://api.anthropic.com' },
  openai: { protocol: 'openai', base_url: 'https://api.openai.com/v1' },
  azure: { protocol: 'openai', auth_type: 'api-key', api_version: '2024-10-21', url: true },
  gemini: { protocol: 'openai', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  grok: { protocol: 'openai', base_url: 'https://api.x.ai/v1' },
  mistral: { protocol: 'openai', base_url: 'https://api.mistral.ai/v1' },
  deepseek: { protocol: 'openai', base_url: 'https://api.deepseek.com/v1' },
  groq: { protocol: 'openai', base_url: 'https://api.groq.com/openai/v1' },
  openrouter: { protocol: 'openai', base_url: 'https://openrouter.ai/api/v1' },
  ollama: { protocol: 'openai', base_url: 'http://localhost:11434/v1', auth_type: 'none' },
  custom: { protocol: 'openai', url: true },
};
export const CHAT_PROVIDERS = Object.keys(CHAT_VENDORS);

/** the settings as the adapters use them : the protocol, and the provider's defaults filled in */
export function effectiveSettings(row) {
  const vendor = CHAT_VENDORS[row?.provider];
  if (!vendor) return { ...row, protocol: '' };
  return {
    ...row,
    protocol: vendor.protocol,
    base_url: row.base_url || vendor.base_url || '',
    auth_type: row.auth_type || vendor.auth_type || '',
    api_version: row.api_version || vendor.api_version || '',
  };
}

export default { CHAT_VENDORS, CHAT_PROVIDERS, effectiveSettings };
