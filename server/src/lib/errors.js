// Generic error response helper
function ReturnError(res, err) {
  var errorObj = {}
  if (err?.result) {
    errorObj.result = err.result;
  }
  errorObj.error = err?.error || err?.message || "Internal Server Error";
  // Only OUR OWN status is forwarded.
  //
  // `err.status` used to be trusted whatever set it - and axios sets `.status` on every
  // rejection from an HTTP error, so a third-party server's status became ours. The one
  // that matters is 401: an admin pressing "test connection" on an AWX/AAP record with a
  // stale token got AAP's 401 relayed as AnsibleForms' answer, and App.vue's global
  // interceptor treats any 401 as a dead session - so it cleared the token and logged the
  // admin out of AnsibleForms because a DIFFERENT system rejected a DIFFERENT credential.
  // That is the 401-vs-403 rule the middleware guards were written to obey.
  //
  // Every error this app raises deliberately extends ApiError, which is the discriminator.
  // Anything else is an upstream or unexpected failure and is ours to report as a 500.
  if (err instanceof ApiError && err.status) {
    res.status(err.status).json(errorObj);
  } else {
    res.status(500).json(errorObj);
  }
}
class ApiError extends Error {
  constructor(message = "API error", status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

class NotFoundError extends ApiError {
  constructor(message = "Not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

class AccessDeniedError extends ApiError {
  constructor(message = "Access denied") {
    super(message, 403);
    this.name = "AccessDeniedError";
  }
}

class BadRequestError extends ApiError {
  constructor(message = "Bad request") {
    super(message, 400);
    this.name = "BadRequestError";
  }
}

class ConflictError extends ApiError {
  constructor(message = "Conflict") {
    super(message, 409);
    this.name = "ConflictError";
  }
}

class ValidationError extends ApiError {
  constructor(message = "Validation failed") {
    super(message, 422);
    this.name = "ValidationError";
  }
}

class InternalServerError extends ApiError {
  constructor(message = "Internal server error") {
    super(message, 500);
    this.name = "InternalServerError";
  }
}

export default {
  ApiError,
  NotFoundError,
  AccessDeniedError,
  BadRequestError,
  ConflictError,
  ValidationError,
  InternalServerError,
  ReturnError
}