import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/api";

export interface MaintenanceStatus {
  maintenance_mode: boolean;
  headline: string;
  message: string;
}

export function useMaintenanceStatus() {
  return useQuery<MaintenanceStatus>({
    queryKey: ["maintenance-status"],
    queryFn: () => api.getMaintenanceStatus(),
    refetchInterval: 30_000,
    staleTime: 30_000,
    retry: false,
  });
}
