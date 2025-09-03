// Generic error response helper
function ReturnError(res, err) {
  var errorObj = {}
  if (err?.result) {
    errorObj.result = err.result;
  }
  errorObj.error = err?.error || err?.message || "Internal Server Error";
  if (err && err.status) {
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