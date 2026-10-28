export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code: string = "bad_request",
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "not_found");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that") {
    super(message, 403, "forbidden");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Please sign in") {
    super(message, 401, "unauthorized");
  }
}

export class ConflictError extends AppError {
  constructor(message = "This record was changed by someone else. Refresh and try again.", details?: unknown) {
    super(message, 409, "conflict", details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please wait a moment and try again.") {
    super(message, 429, "rate_limited");
  }
}
