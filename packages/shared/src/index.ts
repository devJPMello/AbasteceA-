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
