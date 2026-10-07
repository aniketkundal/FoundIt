import { isProd } from '../config/env.js';

// A small helper so route handlers can throw HTTP errors with a status code,
// e.g.  throw new ApiError(404, 'Item not found').
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Wrap async route handlers so thrown/rejected errors reach the error handler
// without a try/catch in every controller.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// 404 for any unmatched route.
export function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.path}`));
}

// Centralised error handler — the single place that shapes error responses.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  // Mongoose validation errors → 400 with field messages.
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => e.message);
  }

  // Malformed ObjectId in a URL (e.g. /api/items/abc) → 400 instead of a 500.
  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path || 'id'}`;
    details = undefined;
  }

  // Duplicate key (e.g. email already registered) → 409.
  if (err.code === 11000) {
    status = 409;
    message = `Duplicate value for: ${Object.keys(err.keyValue || {}).join(', ')}`;
  }

  if (status >= 500) {
    console.error('[FoundIt] Unhandled error:', err);
  }

  res.status(status).json({
    error: message,
    ...(details ? { details } : {}),
    ...(isProd ? {} : { stack: err.stack }),
  });
}
