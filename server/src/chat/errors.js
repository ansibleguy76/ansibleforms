'use strict';

/** A chat turn or approval that stopped before a normal reply : a stable code and an HTTP status. */
export class ChatError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = 'ChatError';
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

export default { ChatError };
