import type { FuelType, SortBy } from '@bomba-certa/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  HistoryResponse,
  NearbyStation,
  Paginated,
  PendingReport,
  StationDetail,
} from '../lib/types';

export interface NearbyParams {
  lat: number;
  lng: number;
  radiusMeters: number;
  fuelType: FuelType;
  sortBy: SortBy;
  page: number;
}

export function useNearby(params: NearbyParams) {
  return useQuery({
    queryKey: ['nearby', params],
    queryFn: () =>
      api<Paginated<NearbyStation>>('/stations/nearby', { query: { ...params, pageSize: 50 } }),
    placeholderData: keepPreviousData,
  });
}

export function useStation(id: string) {
  return useQuery({
    queryKey: ['station', id],
    queryFn: () => api<StationDetail>(`/stations/${id}`),
  });
}

export function useHistory(id: string, fuelType: FuelType, days: number) {
  return useQuery({
    queryKey: ['history', id, fuelType, days],
    queryFn: () =>
      api<HistoryResponse>(`/stations/${id}/price-history`, { query: { fuelType, days } }),
  });
}

export function usePendingReports(id: string) {
  return useQuery({
    queryKey: ['pending', id],
    queryFn: () => api<PendingReport[]>(`/stations/${id}/pending-reports`),
  });
}

/** After any price write, everything that shows prices is stale. */
function useInvalidatePrices(stationId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['station', stationId] }),
      qc.invalidateQueries({ queryKey: ['history', stationId] }),
      qc.invalidateQueries({ queryKey: ['pending', stationId] }),
      qc.invalidateQueries({ queryKey: ['nearby'] }),
    ]);
}

export function useReportPrice(stationId: string) {
  const invalidate = useInvalidatePrices(stationId);
  return useMutation({
    mutationFn: (input: { fuelType: FuelType; priceMilli: number }) =>
      api<{ id: string; status: 'ACTIVE' | 'PENDING' }>('/prices/reports', {
        method: 'POST',
        body: { stationId, ...input },
      }),
    onSuccess: invalidate,
  });
}

export function useConfirmReport(stationId: string) {
  const invalidate = useInvalidatePrices(stationId);
  return useMutation({
    mutationFn: (reportId: string) =>
      api(`/prices/reports/${reportId}/confirm`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}
