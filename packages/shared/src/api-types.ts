import type { FuelType, PriceSource } from './index';

export interface CurrentPrice {
  priceMilli: number;
  source: PriceSource | null;
  reportedAt: string | null;
  stale: boolean;
}

export interface NearbyStation {
  id: string;
  name: string;
  brand: string;
  address: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  price: CurrentPrice | null;
}

export interface Paginated<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface StationDetail {
  id: string;
  name: string;
  brand: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  prices: (CurrentPrice & { fuelType: FuelType })[];
}

export interface HistoryResponse {
  fuelType: FuelType;
  days: number;
  points: { priceMilli: number; source: PriceSource; reportedAt: string }[];
}

export interface PendingReport {
  id: string;
  fuelType: FuelType;
  priceMilli: number;
  confirmationsCount: number;
  reportedAt: string;
  /** True when the logged-in caller authored it (cannot confirm own reports). */
  isMine: boolean;
  /** True when the logged-in caller already confirmed it (one vote per user). */
  confirmedByMe: boolean;
}

export interface AuthResponse {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

export interface AlertDto {
  id: string;
  fuelType: FuelType;
  targetPriceMilli: number;
  radiusMeters: number;
  active: boolean;
  lat: number;
  lng: number;
  lastNotifiedAt: string | null;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse extends Paginated<NotificationDto> {
  unread: number;
}
