'use strict';
import { postJson, withPath, requestHeaders } from './http.js';

export const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const MAX_TOKENS = 4096;

/**
 * The Anthropic Messages API. history : [{ role: user|assistant|tool, text, toolCalls?,
 * toolCallId?, raw? }] ; consecutive tool results become one user message of tool_result
 * blocks, an assistant turn is sent back as the content blocks it came with (thinking
 * included, which the API requires next to tool use).
 */
export function anthropicBody({ model, system, history, tools }) {
  const messages = [];
  for (const m of history) {
    if (m.role === 'user') {
      messages.push({ role: 'user', content: m.text });
    } else if (m.role === 'assistant') {
      const content = Array.isArray(m.raw) && m.raw.length ? m.raw : [
        ...(m.text ? [{ type: 'text', text: m.text }] : []),
        ...(m.toolCalls || []).map((c) => ({ type: 'tool_use', id: c.id, name: c.name, input: c.arguments || {} })),
      ];
      messages.push({ role: 'assistant', content: content.length ? content : [{ type: 'text', text: '' }] });
    } else if (m.role === 'tool') {
      const block = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.text };
      const last = messages[messages.length - 1];
      if (last?.role === 'user' && Array.isArray(last.content) && last.content.every((b) => b.type === 'tool_result')) last.content.push(block);
      else messages.push({ role: 'user', content: [block] });
    }
  }
  const body = { model, max_tokens: MAX_TOKENS, system, messages };
  if (tools?.length) body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  return body;
}

export function parseAnthropic(json) {
  const content = Array.isArray(json?.content) ? json.content : [];
  return {
    text: content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim(),
    toolCalls: content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, arguments: b.input || {} })),
    raw: content,
  };
}

export async function complete({ settings, system, history, tools }) {
  const body = anthropicBody({ model: settings.model, system, history, tools });
  // the user a proxy asks for, when the settings name one
  if (settings.request_user) body.metadata = { user_id: settings.request_user };
  const json = await postJson(
    withPath(settings.base_url || DEFAULT_BASE_URL, '/v1/messages'),
    // the api version is Anthropic's header, not a query parameter
    { ...requestHeaders(settings, 'x-api-key'), 'anthropic-version': settings.api_version || '2023-06-01' },
    body,
    { timeoutSeconds: settings.timeout_seconds, provider: 'Anthropic', ignoreCerts: !!settings.ignore_certs },
  );
  return parseAnthropic(json);
}

export default { complete, anthropicBody, parseAnthropic, DEFAULT_BASE_URL };
