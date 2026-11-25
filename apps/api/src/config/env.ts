import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must have at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** Reports further than this % from the city median wait for confirmations. */
  PRICE_PLAUSIBILITY_PCT: z.coerce.number().positive().max(100).default(15),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // --- Jobs ---
  ANP_IMPORT_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** URL of the weekly ANP stations file (CSV). Not verified by us: set it from ANP open data. */
  ANP_DATASET_URL: z.string().url().optional(),
  /** Every Saturday 09:00 (ANP publishes on Fridays 18h). */
  ANP_CRON: z.string().default('0 9 * * 6'),
  ANP_CRON_TZ: z.string().default('America/Araguaina'),
  ANP_MUNICIPALITY: z.string().default('PALMAS'),
  ANP_STATE: z.string().length(2).default('TO'),
  GEOCODER_URL: z.string().url().default('https://nominatim.openstreetmap.org/search'),
  /** Nominatim requires an identifying User-Agent. */
  GEOCODER_USER_AGENT: z.string().default('bomba-certa-importer/0.1'),

  // --- Notifications ---
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Bomba Certa <no-reply@bombacerta.local>'),
});

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule: the app refuses to boot with an invalid environment. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment variables: ${details}`);
  }
  return parsed.data;
}
