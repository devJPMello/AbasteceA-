import type {
  AlertDto,
  CreateAlertInput,
  FuelType,
  NotificationsResponse,
  SortBy,
} from '@bomba-certa/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
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
  // The answer is personalised (isMine / confirmedByMe), so the key includes the user.
  const userId = useSession()?.user.id ?? null;
  return useQuery({
    queryKey: ['pending', id, userId],
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

// ---------- alerts and notifications (logged-in only) ----------

export function useAlerts() {
  const userId = useSession()?.user.id;
  return useQuery({
    queryKey: ['alerts', userId],
    queryFn: () => api<AlertDto[]>('/alerts'),
    enabled: !!userId,
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAlertInput) =>
      api<AlertDto>('/alerts', { method: 'POST', body: input }),
    onSuccess: () => {
      // The worker may fire the alert right away (a price already qualifies). It writes the
      // notification a moment after claiming the alert, so look again shortly: the list and the
      // bell then update without waiting for the next poll.
      setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ['alerts'] });
        void qc.invalidateQueries({ queryKey: ['notifications'] });
      }, 1500);
      return qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/alerts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

/**
 * Notifications of the logged-in user. Polled once a minute (and on window focus) so the bell
 * learns about alerts that fired in the background worker.
 */
export function useNotifications() {
  const userId = useSession()?.user.id;
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: () =>
      api<NotificationsResponse>('/notifications', { query: { page: 1, pageSize: 20 } }),
    enabled: !!userId,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
