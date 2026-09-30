'use strict';
import logger from "../lib/logger.js";
import mysql from "./db.model.js";
import crypto from "../lib/crypto.js";

export const CHAT_PROVIDERS = ['anthropic', 'openai'];

/**
 * The chat assistant's model provider : one row, like ldap. The api key is encrypted at
 * rest with ENCRYPTION_SECRET and never leaves the server (the controller masks it).
 */
const ChatSettings = function (s) {
  this.provider = CHAT_PROVIDERS.includes(s.provider) ? s.provider : '';
  // undefined = keep, "" = clear, anything else = encrypt
  if (s.api_key !== undefined) this.api_key = s.api_key === '' ? '' : crypto.encrypt(String(s.api_key));
  this.base_url = s.base_url || '';
  this.model = s.model || '';
  this.max_turns = clampInt(s.max_turns, 1, 200, 20);
  this.max_tool_rounds = clampInt(s.max_tool_rounds, 1, 20, 6);
  this.timeout_seconds = clampInt(s.timeout_seconds, 5, 600, 60);
  this.allow_job_status = (s.allow_job_status === undefined || s.allow_job_status) ? 1 : 0;
};

function clampInt(v, min, max, dflt) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

ChatSettings.update = function (record) {
  logger.info(`Updating chat settings (provider ${record.provider || 'none'})`);
  return mysql.do("UPDATE AnsibleForms.`chat_settings` set ?", record);
};

/** the row with the api key DECRYPTED - for the server only */
ChatSettings.find = async function () {
  const res = await mysql.do("SELECT * FROM AnsibleForms.`chat_settings` limit 1;");
  if (!res.length) throw new Error("No chat_settings record in the database");
  const row = res[0];
  try {
    row.api_key = crypto.decrypt(row.api_key || '');
  } catch {
    logger.error("Couldn't decrypt the chat api key, did the secret key change ?");
    row.api_key = '';
  }
  return row;
};

/**
 * whether a provider is configured well enough to chat : a provider and a model, and a key -
 * or a base url of its own, since a local model server (Ollama, vLLM) or an internal proxy
 * often takes no key at all
 */
ChatSettings.isConfigured = function (row) {
  return !!(row && CHAT_PROVIDERS.includes(row.provider) && row.model && (row.api_key || row.base_url));
};

export default ChatSettings;
