'use strict';
import anthropic from './anthropic.js';
import openai from './openai.js';
import { ChatError } from '../errors.js';
import { effectiveSettings } from '../vendors.js';

const PROVIDERS = { anthropic, openai };

/**
 * One model round : { text, toolCalls: [{ id, name, arguments }], raw }. It never runs a
 * tool - the chat turn does, and only its own.
 */
export async function complete(args) {
  const settings = effectiveSettings(args.settings);
  const adapter = PROVIDERS[settings.protocol];
  if (!adapter) throw new ChatError('chat_not_configured', 'No chat model provider is configured', 503);
  return adapter.complete({ ...args, settings });
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
