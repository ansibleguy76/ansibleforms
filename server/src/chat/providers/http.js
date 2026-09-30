'use strict';
import { ChatError } from '../errors.js';

/**
 * POST json to a model provider. The api key only ever travels in a header ; a failure is
 * reported with the provider's status and the start of its message - never the request.
 */
export async function postJson(url, headers, body, { timeoutSeconds = 60, provider = 'provider' } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutSeconds * 1000),
    });
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw new ChatError(timedOut ? 'provider_timeout' : 'provider_unreachable',
      timedOut ? `${provider} did not answer within ${timeoutSeconds}s` : `${provider} could not be reached : ${err?.message || err}`, 502);
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!res.ok) {
    const detail = json?.error?.message || json?.message || text.slice(0, 200);
    throw new ChatError('provider_error', `${provider} returned ${res.status} : ${detail}`, 502);
  }
  if (!json) throw new ChatError('provider_error', `${provider} did not return JSON`, 502);
  return json;
}

/** a url with a path appended in front of its query string (Azure keeps api-version there) */
export function withPath(base, path) {
  const [head, query] = String(base).split('?');
  return `${head.replace(/\/+$/, '')}${path}${query ? `?${query}` : ''}`;
}

/** tool call arguments the model sent as text ; broken JSON is flagged, not thrown */
export function parseArguments(value) {
  if (value && typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { __invalid_json__: true };
  } catch {
    return { __invalid_json__: true };
  }
}

export default { postJson, withPath, parseArguments };
