import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import authRouter from './routes/auth.js';

const app = new Hono();

// Global error handler
app.onError(errorHandler);

// Mount routes
app.route('/api/auth', authRouter);

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }));

serve(
  {
    fetch: app.fetch,
    port: config.PORT,
  },
  (info) => {
    console.log(`🚀 Server running on http://localhost:${info.port}`);
  },
);
