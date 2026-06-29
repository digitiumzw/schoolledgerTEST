import { useQuery } from '@tanstack/react-query';
import {
  getDashboardKpis,
  getDashboardRevenue,
  getDashboardPlans,
  getDashboardActivity,
} from '@/api/platform';

export function useDashboardKpis() {
  return useQuery({
    queryKey: ['platform', 'dashboard', 'kpis'],
    queryFn: () => getDashboardKpis().then((r) => r.data.data),
    staleTime: 60_000,
  });
}

export function useDashboardRevenue() {
  return useQuery({
    queryKey: ['platform', 'dashboard', 'revenue'],
    queryFn: () => getDashboardRevenue().then((r) => r.data.data),
    staleTime: 300_000,
  });
}

export function useDashboardPlans() {
  return useQuery({
    queryKey: ['platform', 'dashboard', 'plans'],
    queryFn: () => getDashboardPlans().then((r) => r.data.data),
    staleTime: 300_000,
  });
}

export function useDashboardActivity() {
  return useQuery({
    queryKey: ['platform', 'dashboard', 'activity'],
    queryFn: () => getDashboardActivity().then((r) => r.data.data),
    staleTime: 30_000,
  });
}
