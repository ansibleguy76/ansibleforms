'use strict';
import crypto from 'crypto';
import { ChatError } from './errors.js';

/**
 * Conversations, in memory : a transcript lives as long as the operator is talking, and a
 * restart only means "start a new conversation". Each one belongs to one user.
 */
const IDLE_MS = 2 * 60 * 60 * 1000;
const MAX_PER_USER = 5;
const TURNS_PER_HOUR = 60;
const MAX_SESSIONS = 1000;

const sessions = new Map();
const recentTurns = new Map();

const owner = (user) => `${user?.type || ''}:${user?.username || ''}`;

function sweep(now = Date.now()) {
  for (const [id, s] of sessions) if (now - s.lastAt > IDLE_MS) sessions.delete(id);
  while (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
}

export function openSession(user, now = Date.now()) {
  if (!user?.username) throw new ChatError('unauthorized', 'No user', 401);
  sweep(now);
  const mine = [...sessions.values()].filter((s) => s.owner === owner(user)).sort((a, b) => a.lastAt - b.lastAt);
  while (mine.length >= MAX_PER_USER) sessions.delete(mine.shift().id);
  const session = {
    id: crypto.randomBytes(16).toString('hex'),
    owner: owner(user),
    messages: [],
    operatorMessages: [],
    selections: new Set(),
    choiceValues: {},
    turns: 0,
    busy: false,
    createdAt: now,
    lastAt: now,
  };
  sessions.set(session.id, session);
  return session;
}

/** the conversation, if it is this user's ; someone else's reads as not found */
export function getSession(id, user) {
  const session = typeof id === 'string' ? sessions.get(id) : undefined;
  if (!session || session.owner !== owner(user)) throw new ChatError('session_not_found', 'This conversation is no longer known - start a new one', 404);
  session.lastAt = Date.now();
  return session;
}

export function dropSession(id, user) {
  const session = typeof id === 'string' ? sessions.get(id) : undefined;
  if (session && session.owner === owner(user)) sessions.delete(id);
}

/** at most TURNS_PER_HOUR messages per user per hour, across their conversations */
export function countTurn(user, now = Date.now()) {
  const key = owner(user);
  const recent = (recentTurns.get(key) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= TURNS_PER_HOUR) {
    recentTurns.set(key, recent);
    throw new ChatError('rate_limited', 'Too many chat messages in the last hour - try again later', 429);
  }
  recent.push(now);
  recentTurns.set(key, recent);
}

/** for the tests */
export function clearSessions() {
  sessions.clear();
  recentTurns.clear();
}

export default { openSession, getSession, dropSession, countTurn, clearSessions };
