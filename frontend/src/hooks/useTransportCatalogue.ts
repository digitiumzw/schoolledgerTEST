import { useQuery, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { api } from '@/api/api';
import type { TransportListParams, PaginatedResponse } from '@/types/dashboard';

export const TRANSPORT_ROUTES_KEY = 'transport-routes';
export const TRANSPORT_VEHICLES_KEY = 'transport-vehicles';
export const TRANSPORT_DRIVERS_KEY = 'transport-drivers';

export function useTransportRoutes(params?: TransportListParams) {
  return useQuery<PaginatedResponse<any>>({
    queryKey: [TRANSPORT_ROUTES_KEY, params],
    queryFn: () => api.getRoutes(params),
    placeholderData: keepPreviousData,
  });
}

export function useTransportVehicles(params?: TransportListParams) {
  return useQuery<PaginatedResponse<any>>({
    queryKey: [TRANSPORT_VEHICLES_KEY, params],
    queryFn: () => api.getVehicles(params),
    placeholderData: keepPreviousData,
  });
}

export function useTransportDrivers(params?: TransportListParams) {
  return useQuery<PaginatedResponse<any>>({
    queryKey: [TRANSPORT_DRIVERS_KEY, params],
    queryFn: () => api.getDrivers(params),
    placeholderData: keepPreviousData,
  });
}

export function useInvalidateTransport() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [TRANSPORT_ROUTES_KEY] });
    queryClient.invalidateQueries({ queryKey: [TRANSPORT_VEHICLES_KEY] });
    queryClient.invalidateQueries({ queryKey: [TRANSPORT_DRIVERS_KEY] });
  };
}
