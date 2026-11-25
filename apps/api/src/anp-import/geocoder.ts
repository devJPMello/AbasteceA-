import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

export interface Geocoder {
  geocode(query: string): Promise<{ lat: number; lng: number } | null>;
}

/** DI token, so tests can swap the real HTTP geocoder for a fake one. */
export const GEOCODER = Symbol('GEOCODER');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Nominatim (OpenStreetMap). Its usage policy: max 1 request/second and an identifying
 * User-Agent. We only call it for stations not yet in our DB, and the result is stored on the
 * station, so each address is geocoded once: the database is the cache.
 */
@Injectable()
export class NominatimGeocoder implements Geocoder {
  private readonly logger = new Logger(NominatimGeocoder.name);
  private lastCall = 0;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async geocode(query: string) {
    const wait = this.lastCall + 1100 - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastCall = Date.now();

    const url = new URL(this.config.get('GEOCODER_URL', { infer: true }));
    url.search = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'br',
    }).toString();

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': this.config.get('GEOCODER_USER_AGENT', { infer: true }) },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Geocoder responded ${res.status}`);
        return null;
      }
      const results = (await res.json()) as { lat: string; lon: string }[];
      const first = results[0];
      return first ? { lat: Number(first.lat), lng: Number(first.lon) } : null;
    } catch (err) {
      this.logger.warn(`Geocoding failed: ${String(err)}`);
      return null;
    }
  }
}
