import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ADMIN_PASSWORD: z.string().min(1, 'ADMIN_PASSWORD is required'),
  DEMO_PASSWORD: z.string().min(1, 'DEMO_PASSWORD is required'),
  PORT: z.coerce.number().default(3001),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  const formatted = parsed.error.format();
  for (const [key, value] of Object.entries(formatted)) {
    if (key === '_errors') continue;
    const issues = value as { _errors: string[] };
    console.error(`  ${key}: ${issues._errors.join(', ')}`);
  }
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
