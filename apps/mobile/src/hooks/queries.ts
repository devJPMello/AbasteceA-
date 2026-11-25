import type {
  AlertDto,
  CreateAlertInput,
  FuelType,
  NearbyStation,
  NotificationsResponse,
  Paginated,
  SortBy,
  StationDetail,
} from '@bomba-certa/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

export interface NearbyParams {
  lat: number;
  lng: number;
  radiusMeters: number;
  fuelType: FuelType;
  sortBy: SortBy;
}

export function useNearby(params: NearbyParams) {
  return useQuery({
    queryKey: ['nearby', params],
    queryFn: () =>
      api<Paginated<NearbyStation>>('/stations/nearby', {
        query: { ...params, page: 1, pageSize: 50 },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useStation(id: string) {
  return useQuery({
    queryKey: ['station', id],
    queryFn: () => api<StationDetail>(`/stations/${id}`),
  });
}

export function useReportPrice(stationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { fuelType: FuelType; priceMilli: number }) =>
      api<{ id: string; status: 'ACTIVE' | 'PENDING' }>('/prices/reports', {
        method: 'POST',
        body: { stationId, ...input },
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['station', stationId] }),
        qc.invalidateQueries({ queryKey: ['nearby'] }),
      ]),
  });
}

export function useAlerts() {
  const session = useSession();
  return useQuery({
    queryKey: ['alerts', session?.user.id],
    queryFn: () => api<AlertDto[]>('/alerts'),
    enabled: !!session,
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAlertInput) =>
      api<AlertDto>('/alerts', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/alerts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useNotifications() {
  const session = useSession();
  return useQuery({
    queryKey: ['notifications', session?.user.id],
    queryFn: () =>
      api<NotificationsResponse>('/notifications', { query: { page: 1, pageSize: 20 } }),
    enabled: !!session,
  });
}
