import type { MiddlewareHandler } from 'hono';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

declare module 'hono' {
  interface ContextVariableMap {
    userId: number;
    username: string;
  }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as {
      userId: number;
      username: string;
    };
    c.set('userId', payload.userId);
    c.set('username', payload.username);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
};
