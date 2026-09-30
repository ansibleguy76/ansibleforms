'use strict';
import anthropic from './anthropic.js';
import openai from './openai.js';
import { ChatError } from '../errors.js';

const PROVIDERS = { anthropic, openai };

/**
 * One model round : { text, toolCalls: [{ id, name, arguments }], raw }. It never runs a
 * tool - the chat turn does, and only its own.
 */
export async function complete(args) {
  const provider = PROVIDERS[args.settings?.provider];
  if (!provider) throw new ChatError('chat_not_configured', 'No chat model provider is configured', 503);
  return provider.complete(args);
}

/** the admin page's check : one tiny round trip with the given settings */
export async function checkProvider(settings) {
  const res = await complete({
    settings: { ...settings, timeout_seconds: Math.min(settings.timeout_seconds || 30, 30) },
    system: 'You are a connection test.',
    history: [{ role: 'user', text: 'Reply with the single word OK.' }],
    tools: [],
  });
  return { ok: true, reply: String(res.text || '').slice(0, 100) };
}

export default { complete, checkProvider };
