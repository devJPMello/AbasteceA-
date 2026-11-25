import { z } from 'zod';

export const FuelType = z.enum(['GASOLINE_COMMON', 'GASOLINE_PREMIUM', 'ETHANOL', 'DIESEL_S10']);
export type FuelType = z.infer<typeof FuelType>;

export const PriceSource = z.enum(['USER', 'ANP']);
export type PriceSource = z.infer<typeof PriceSource>;

export const ReportStatus = z.enum(['PENDING', 'ACTIVE', 'REJECTED']);
export type ReportStatus = z.infer<typeof ReportStatus>;

/** Prices are integers in thousandths of BRL: R$ 5,899 => 5899. */
export const priceMilli = z.number().int().min(1000).max(20000);

export const coordinates = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = registerSchema.pick({ email: true, password: true });
export type LoginInput = z.infer<typeof loginSchema>;

export const createPriceReportSchema = z.object({
  stationId: z.string().uuid(),
  fuelType: FuelType,
  priceMilli,
});
export type CreatePriceReportInput = z.infer<typeof createPriceReportSchema>;

/** Business constants shared by API and clients. */
export const PRICE_FRESHNESS_DAYS = 7;
export const REPORT_COOLDOWN_HOURS = 6;

/** A report out of the plausible range needs this many distinct confirmations to go live. */
export const CONFIRMATIONS_REQUIRED = 2;

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });
export type RefreshInput = z.infer<typeof refreshSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const SortBy = z.enum(['price', 'distance']);
export type SortBy = z.infer<typeof SortBy>;

export const nearbyQuerySchema = coordinates
  .extend({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radiusMeters: z.coerce.number().int().min(100).max(50000).default(5000),
    fuelType: FuelType,
    sortBy: SortBy.default('price'),
  })
  .merge(paginationSchema);
export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;

export const createStationSchema = coordinates.extend({
  name: z.string().trim().min(2).max(120),
  brand: z.string().trim().min(2).max(60),
  cnpj: z
    .string()
    .regex(/^\d{14}$/, 'CNPJ must have 14 digits')
    .optional(),
  address: z.string().trim().min(5).max(200),
});
export type CreateStationInput = z.infer<typeof createStationSchema>;

export const priceHistoryQuerySchema = z.object({
  fuelType: FuelType,
  days: z.coerce.number().int().min(1).max(365).default(30),
});
export type PriceHistoryQuery = z.infer<typeof priceHistoryQuerySchema>;

export const MAX_ALERTS_PER_USER = 10;

export const createAlertSchema = coordinates.extend({
  fuelType: FuelType,
  targetPriceMilli: priceMilli,
  radiusMeters: z.number().int().min(500).max(50000),
});
export type CreateAlertInput = z.infer<typeof createAlertSchema>;

export * from './format';
export * from './price-band';

export const registerDeviceSchema = z.object({
  token: z.string().regex(/^(Exponent|Expo)PushToken\[[^\]]+\]$/, 'Invalid Expo push token'),
  platform: z.enum(['ios', 'android']),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
