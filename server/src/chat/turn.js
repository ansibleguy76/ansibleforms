'use strict';
import logger from '../lib/logger.js';
import { ChatError } from './errors.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { TOOLS, runTool } from './tools.js';
import { UNFOUNDED_LAUNCH, NUDGE, HONEST } from './policy.js';

export const MAX_MESSAGE_LENGTH = 4000;

/**
 * One operator message : model rounds, the tools they ask for, then a page-ready result
 * `{ reply, choices, proposals, job }`. The loop :
 *   - an empty model reply is retried once ;
 *   - a reply claiming a launch while this turn stored no summary is nudged once, and if it
 *     insists, replaced by an honest one - the model cannot launch, and must not say it did ;
 *   - at most `max_tool_rounds` model calls per message, `max_turns` messages per session.
 *
 * @param {object} args
 * @param {object} args.session   sessions.js conversation
 * @param {string} args.message   what the operator typed, or the value of a clicked choice
 * @param {object} [args.selection]  { slot, value } of a clicked choice
 * @param {object} args.settings  the chat settings row (api key decrypted)
 * @param {object} args.handlers  the MCP handlers for this user
 * @param {object} args.user      req.user.user
 * @param {function} args.complete  providers complete()
 */
export async function runTurn({ session, message, selection, settings, handlers, user, complete }) {
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) throw new ChatError('empty_message', 'Type a message', 400);
  if (text.length > MAX_MESSAGE_LENGTH) throw new ChatError('message_too_long', `A message is at most ${MAX_MESSAGE_LENGTH} characters`, 400);
  if (session.turns >= (settings.max_turns || 20)) {
    throw new ChatError('turn_limit', 'This conversation has reached its message limit. Start a new conversation.', 429);
  }
  rememberSelection(session, selection);
  session.operatorMessages.push(text);
  session.messages.push({ role: 'user', text });
  session.turns++;

  const proposals = [];
  let choices = [];
  let job = null;
  let retriedEmpty = false;
  let retriedUnfounded = false;
  const maxRounds = settings.max_tool_rounds || 6;
  const ctx = { handlers, user, session, settings };

  for (let round = 0; round < maxRounds; round++) {
    const result = await complete({ settings, system: SYSTEM_PROMPT, history: session.messages, tools: TOOLS });
    const calls = result.toolCalls || [];
    if (!result.text && !calls.length && !retriedEmpty) {
      retriedEmpty = true;
      logger.debug(`chat ${session.id.slice(0, 8)} : empty model reply, retrying`);
      continue;
    }
    const unfounded = !calls.length && !proposals.length && UNFOUNDED_LAUNCH.test(result.text || '');
    if (unfounded && !retriedUnfounded) {
      retriedUnfounded = true;
      logger.debug(`chat ${session.id.slice(0, 8)} : the model described a launch that did not happen, nudging`);
      session.messages.push({ role: 'user', text: NUDGE });
      continue;
    }
    let reply = result.text || '';
    if (unfounded) {
      // the nudge is not part of the conversation the operator had
      const last = session.messages[session.messages.length - 1];
      if (last?.role === 'user' && last.text === NUDGE) session.messages.pop();
      reply = HONEST;
    }
    session.messages.push({ role: 'assistant', text: reply, toolCalls: calls, raw: unfounded ? null : result.raw });
    if (!calls.length) {
      return {
        reply: reply || 'The model returned an empty reply. Try again, or say it in one shorter message.',
        choices, proposals, job,
      };
    }
    for (const call of calls) {
      const outcome = await runTool(call.name, call.arguments, ctx);
      session.messages.push({ role: 'tool', toolCallId: call.id, name: call.name, text: JSON.stringify(outcome.payload) });
      if (outcome.choices?.length) {
        choices = outcome.choices;
        rememberChoices(session, outcome.choices);
      }
      if (outcome.proposal) proposals.push(outcome.proposal);
      if (outcome.job) job = outcome.job;
    }
  }
  logger.info(`chat ${session.id.slice(0, 8)} : tool round limit`);
  throw new ChatError('tool_round_limit', 'This message needed too many steps. Say what you want in one message, or start a new conversation.', 429);
}

// a clicked choice counts as the operator's own answer - but only a value the page offered
function rememberSelection(session, selection) {
  if (!selection || typeof selection !== 'object') return;
  const { slot, value } = selection;
  if (typeof slot !== 'string' || (typeof value !== 'string' && typeof value !== 'number')) return;
  const offered = session.choiceValues[slot];
  const v = String(value).toLowerCase();
  if (offered && offered.has(v)) session.selections.add(`${slot}\u0000${v}`);
}

function rememberChoices(session, groups) {
  for (const g of groups) {
    if (typeof g.slot !== 'string') continue;
    session.choiceValues[g.slot] = new Set((g.options || []).filter((o) => o && o.value !== undefined && o.value !== null).map((o) => String(o.value).toLowerCase()));
  }
}

export default { runTurn, MAX_MESSAGE_LENGTH };
