import type { ErrorHandler } from 'hono';
import { AppError } from '../errors.js';

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    c.status(err.statusCode as 400 | 401 | 404 | 500);
    return c.json({ error: err.message });
  }

  console.error('Unhandled error:', err);
  c.status(500);
  return c.json({ error: 'Internal server error' });
};
