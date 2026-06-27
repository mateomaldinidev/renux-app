import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { loginSchema } from '../schemas/index.js';

const authRouter = new Hono();

// POST /api/auth/login
authRouter.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { username, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, config.JWT_SECRET, {
    expiresIn: '7d',
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return c.json({ token, expiresAt });
});

// GET /api/auth/me
authRouter.get('/me', authMiddleware, (c) => {
  return c.json({ username: c.get('username') });
});

// POST /api/auth/logout
authRouter.post('/logout', authMiddleware, (c) => {
  return c.json({ success: true });
});

export default authRouter;
