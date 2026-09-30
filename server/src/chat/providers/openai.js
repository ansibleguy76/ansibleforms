'use strict';
import { postJson, withPath, withApiVersion, requestHeaders, parseArguments } from './http.js';

export const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/**
 * The OpenAI Chat Completions API - also Azure OpenAI and any OpenAI-compatible endpoint,
 * through the base url. Azure authenticates with an `api-key` header, the rest with a
 * bearer token. The assistant content is always a string, the operator's name goes in `user`.
 */
export function openaiBody({ model, system, history, tools, user }) {
  const messages = [{ role: 'system', content: system }];
  for (const m of history) {
    if (m.role === 'user') messages.push({ role: 'user', content: m.text });
    else if (m.role === 'assistant') {
      const msg = { role: 'assistant', content: m.text || '' };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.arguments || {}) } }));
      }
      messages.push(msg);
    } else if (m.role === 'tool') messages.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.text });
  }
  const body = { model, messages };
  if (tools?.length) body.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
  if (user) body.user = user;
  return body;
}

export function parseOpenai(json) {
  const msg = json?.choices?.[0]?.message || {};
  return {
    text: (typeof msg.content === 'string' ? msg.content : '').trim(),
    toolCalls: (msg.tool_calls || []).map((c) => ({ id: c.id, name: c.function?.name, arguments: parseArguments(c.function?.arguments) })),
    raw: null,
  };
}

/**
 * The OpenAI-compatible protocol sends the key as a bearer token, unless the settings say
 * otherwise - and an Azure OpenAI url with no auth type chosen means its `api-key` header.
 */
export function authHeaders(settings) {
  const azure = /\.openai\.azure\.com|\.cognitiveservices\.azure\.com/i.test(settings.base_url || '');
  return requestHeaders(settings, azure ? 'api-key' : 'bearer');
}

export async function complete({ settings, system, history, tools }) {
  const json = await postJson(
    withApiVersion(withPath(settings.base_url || DEFAULT_BASE_URL, '/chat/completions'), settings.api_version),
    authHeaders(settings),
    // the user a proxy asks for, when the settings name one
    openaiBody({ model: settings.model, system, history, tools, user: settings.request_user || undefined }),
    { timeoutSeconds: settings.timeout_seconds, provider: 'OpenAI' },
  );
  return parseOpenai(json);
}

export default { complete, openaiBody, parseOpenai, authHeaders, DEFAULT_BASE_URL };
