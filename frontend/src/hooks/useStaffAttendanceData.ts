import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/api/api';
import { Staff, StaffAttendanceRecord, LeaveRequest, Settings } from '@/types/dashboard';
import { toast } from 'sonner';

// Cache for data to prevent unnecessary re-fetches
const dataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

// Hook to fetch all staff
export function useStaff() {
  const [data, setData] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    const cacheKey = 'staff';
    const cached = dataCache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await api.getStaff({ limit: 100 });
      const staffArray = result.data ?? [];
      
      // Cache the result
      dataCache.set(cacheKey, { data: staffArray, timestamp: Date.now() });
      setData(staffArray);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch staff:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cacheRef.current !== 'staff-loaded') {
      fetchData();
      cacheRef.current = 'staff-loaded';
    }
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Hook to fetch attendance records with optional filtering
export function useStaffAttendance(params?: { staffId?: string; date?: string }) {
  const [data, setData] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const paramsRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    const paramsStr = JSON.stringify(params || {});
    const cacheKey = `attendance-${paramsStr}`;
    const cached = dataCache.get(cacheKey);
    
    // Return cached data if still valid and params haven't changed
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION && paramsRef.current === paramsStr) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await api.getStaffAttendance(params || {});
      
      // Cache the result
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
      paramsRef.current = paramsStr;
      setData(result);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch attendance:', err);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    const paramsStr = JSON.stringify(params || {});
    if (paramsRef.current !== paramsStr) {
      fetchData();
    }
  }, [fetchData, params]);

  return { data, loading, error, refetch: fetchData };
}

// Hook to fetch dynamic filter metadata for staff attendance
export function useStaffAttendanceFilterMetadata() {
  const [data, setData] = useState<{
    years: number[];
    departments: string[];
    staff: { id: string; name: string; department: string }[];
    months: string[];
    statuses: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const loadedRef = useRef<boolean>(false);

  const fetchData = useCallback(async () => {
    if (loadedRef.current) return;

    try {
      setLoading(true);
      setError(null);
      const result = await api.getStaffAttendanceFilterMetadata();
      setData(result);
      loadedRef.current = true;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch filter metadata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      fetchData();
    }
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Hook to fetch a single page of attendance records with server-side filters
export function usePagedStaffAttendance(params: {
  page: number;
  limit: number;
  search: string;
  status: string;
  staffId?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'date' | 'staffName' | 'status' | 'workHours' | 'overtimeHours';
  sortOrder?: 'asc' | 'desc';
}) {
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({
    present: 0,
    absent: 0,
    late: 0,
    onLeave: 0,
    earlyDeparture: 0,
    halfDay: 0,
    totalOvertimeHours: 0,
    attendanceRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { page, limit, search, status, staffId, department, startDate, endDate, sortBy, sortOrder } = params;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getPagedStaffAttendance({ page, limit, search, status, staffId, department, startDate, endDate, sortBy, sortOrder });
      setRecords(result.records ?? []);
      setPagination(result.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 });
      if (result.summary) setSummary(result.summary);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status, staffId, department, startDate, endDate, sortBy, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { records, pagination, summary, loading, error, refetch: fetchData };
}

// Hook to fetch all attendance records for records tab
export function useAllStaffAttendance() {
  const [data, setData] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const loadedRef = useRef<boolean>(false);

  const fetchData = useCallback(async () => {
    const cacheKey = 'all-attendance';
    const cached = dataCache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION && loadedRef.current) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await api.getStaffAttendance();
      
      // Cache the result
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
      loadedRef.current = true;
      setData(result);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch all attendance:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      fetchData();
    }
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Hook to fetch leave requests
export function useLeaveRequests() {
  const [data, setData] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const loadedRef = useRef<boolean>(false);

  const fetchData = useCallback(async () => {
    const cacheKey = 'leave-requests';
    const cached = dataCache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION && loadedRef.current) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await api.getLeaveRequests();
      
      // Cache the result
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
      loadedRef.current = true;
      setData(result);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch leave requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      fetchData();
    }
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Hook to fetch paginated leave requests (backend-driven pagination)
export function usePaginatedLeaveRequests(page: number, limit: number) {
  const [data, setData] = useState<LeaveRequest[]>([]);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getLeaveRequests({ page, limit });
      const records = result.requests ?? result.data ?? [];
      setData(records);
      setPagination(result.pagination ?? null);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch paginated leave requests:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, pagination, loading, error, refetch: fetchData };
}

// Hook to fetch settings
export function useSettings() {
  const [data, setData] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const loadedRef = useRef<boolean>(false);

  const fetchData = useCallback(async () => {
    const cacheKey = 'settings';
    const cached = dataCache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION && loadedRef.current) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await api.getSettings();
      
      // Cache the result
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
      loadedRef.current = true;
      setData(result);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      fetchData();
    }
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Hook to fetch attendance summary for a specific staff member
export function useStaffAttendanceSummary(staffId: string, month?: string, includeTrend?: boolean, shouldFetch: boolean = true) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(shouldFetch);
  const [error, setError] = useState<Error | null>(null);
  const paramsRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    if (!staffId || !shouldFetch) return;
    
    const paramsStr = `${staffId}-${month}-${includeTrend}`;
    const cacheKey = `summary-${paramsStr}`;
    const cached = dataCache.get(cacheKey);
    
    // Return cached data if still valid and params haven't changed
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION && paramsRef.current === paramsStr) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await api.getStaffAttendanceSummary(staffId, month, includeTrend);
      
      // Cache the result
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
      paramsRef.current = paramsStr;
      setData(result);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch attendance summary:', err);
    } finally {
      setLoading(false);
    }
  }, [staffId, month, includeTrend, shouldFetch]);

  useEffect(() => {
    if (shouldFetch) {
      const paramsStr = `${staffId}-${month}-${includeTrend}`;
      if (paramsRef.current !== paramsStr) {
        fetchData();
      }
    }
  }, [fetchData, shouldFetch, staffId, month, includeTrend]);

  return { data, loading, error, refetch: fetchData };
}

// Combined hook for daily attendance tab
export function useDailyAttendanceData(date: string) {
  const staffQuery = useStaff();
  const attendanceQuery = useStaffAttendance({ date });
  const leaveRequestsQuery = useLeaveRequests();
  const settingsQuery = useSettings();

  const isLoading = staffQuery.loading || attendanceQuery.loading || 
                   leaveRequestsQuery.loading || settingsQuery.loading;

  const error = staffQuery.error || attendanceQuery.error || 
                leaveRequestsQuery.error || settingsQuery.error;

  // Filter approved leave requests for the date
  const todayLeaves = leaveRequestsQuery.data?.filter((leave: any) => 
    leave.status === 'approved' && 
    leave.startDate <= date && 
    leave.endDate >= date
  ) || [];

  return {
    staff: staffQuery.data || [],
    attendanceRecords: attendanceQuery.data || [],
    leaveRequests: todayLeaves,
    settings: settingsQuery.data,
    isLoading,
    error,
    refetch: () => {
      staffQuery.refetch();
      attendanceQuery.refetch();
      leaveRequestsQuery.refetch();
      settingsQuery.refetch();
    },
  };
}

/** Clear all attendance-related cache entries so the next read fetches fresh data. */
function invalidateAttendanceCache() {
  for (const key of Array.from(dataCache.keys())) {
    if (key.startsWith('attendance') || key.startsWith('summary') || key.startsWith('daily')) {
      dataCache.delete(key);
    }
  }
}

// Simple mutation functions without React Query
export async function checkInStaff(staffId: string, checkInTime?: string, date?: string, force?: boolean) {
  try {
    const result = await api.checkInStaff(staffId, checkInTime, date, force);
    invalidateAttendanceCache();
    toast.success('Check-in successful');
    return result;
  } catch (error: any) {
    if (error?.status !== 409) {
      toast.error(error.message || 'Failed to check in');
    }
    throw error;
  }
}

export async function checkOutStaff(staffId: string, checkOutTime?: string, date?: string) {
  try {
    const result = await api.checkOutStaff(staffId, checkOutTime, date);
    invalidateAttendanceCache();
    toast.success('Check-out successful');
    return result;
  } catch (error: any) {
    toast.error(error.message || 'Failed to check out');
    throw error;
  }
}

export async function updateStaffAttendance(id: string, updates: any) {
  try {
    const result = await api.updateStaffAttendance(id, updates);
    invalidateAttendanceCache();
    toast.success('Attendance updated successfully');
    return result;
  } catch (error: any) {
    toast.error(error.message || 'Failed to update attendance');
    throw error;
  }
}

export async function deleteStaffAttendance(id: string) {
  try {
    const result = await api.deleteStaffAttendance(id);
    invalidateAttendanceCache();
    toast.success('Attendance record deleted successfully');
    return result;
  } catch (error: any) {
    toast.error(error.message || 'Failed to delete attendance record');
    throw error;
  }
}

// Leave request functions
export async function createLeaveRequest(leaveData: any) {
  try {
    const result = await api.createLeaveRequest(leaveData);
    toast.success('Leave request created successfully');
    return result;
  } catch (error: any) {
    toast.error(error.message || 'Failed to create leave request');
    throw error;
  }
}

export async function reviewLeaveRequest(id: string, status: string, reviewedBy: string, reviewNotes?: string) {
  try {
    const result = await api.reviewLeaveRequest(id, status, reviewedBy, reviewNotes);
    toast.success('Leave request reviewed successfully');
    return result;
  } catch (error: any) {
    toast.error(error.message || 'Failed to review leave request');
    throw error;
  }
}

export async function deleteLeaveRequest(id: string) {
  try {
    const result = await api.deleteLeaveRequest(id);
    toast.success('Leave request deleted successfully');
    return result;
  } catch (error: any) {
    toast.error(error.message || 'Failed to delete leave request');
    throw error;
  }
}

export async function updateLeaveRequest(id: string, leaveData: any) {
  try {
    const result = await api.updateLeaveRequest(id, leaveData);
    toast.success('Leave request updated successfully');
    return result;
  } catch (error: any) {
    toast.error(error.message || 'Failed to update leave request');
    throw error;
  }
}

export function useStaffAttendanceHistory(staffId: string, shouldFetch: boolean = true) {
  const [data, setData] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(shouldFetch);
  const [error, setError] = useState<Error | null>(null);
  const paramsRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    if (!staffId || !shouldFetch) return;
    
    const paramsStr = `history-${staffId}`;
    const cacheKey = `attendance-history-${paramsStr}`;
    const cached = dataCache.get(cacheKey);
    
    // Return cached data if still valid and params haven't changed
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION && paramsRef.current === paramsStr) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await api.getStaffAttendance({ staffId });
      
      // Cache the result
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
      paramsRef.current = paramsStr;
      setData(result);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch attendance history:', err);
    } finally {
      setLoading(false);
    }
  }, [staffId, shouldFetch]);

  useEffect(() => {
    if (shouldFetch) {
      const paramsStr = `history-${staffId}`;
      if (paramsRef.current !== paramsStr) {
        fetchData();
      }
    }
  }, [fetchData, shouldFetch, staffId]);

  return { data, loading, error, refetch: fetchData };
}

export function useStaffLeaveHistory(staffId: string, shouldFetch: boolean = true) {
  const [data, setData] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(shouldFetch);
  const [error, setError] = useState<Error | null>(null);
  const paramsRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    if (!staffId || !shouldFetch) return;
    
    const paramsStr = `leave-history-${staffId}`;
    const cacheKey = `leave-history-${paramsStr}`;
    const cached = dataCache.get(cacheKey);
    
    // Return cached data if still valid and params haven't changed
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION && paramsRef.current === paramsStr) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await api.getLeaveRequestsByStaff(staffId);
      
      // Cache the result
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
      paramsRef.current = paramsStr;
      setData(result);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch leave history:', err);
    } finally {
      setLoading(false);
    }
  }, [staffId, shouldFetch]);

  useEffect(() => {
    if (shouldFetch) {
      const paramsStr = `leave-history-${staffId}`;
      if (paramsRef.current !== paramsStr) {
        fetchData();
      }
    }
  }, [fetchData, shouldFetch, staffId]);

  return { data, loading, error, refetch: fetchData };
}

// Mutation hooks for React Query-style usage
export function useCheckInMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [leaveConflict, setLeaveConflict] = useState(false);

  const mutate = useCallback(async ({
    staffId, checkInTime, date, force,
  }: { staffId: string; checkInTime?: string; date?: string; force?: boolean }) => {
    setIsLoading(true);
    setError(null);
    setLeaveConflict(false);
    try {
      const result = await checkInStaff(staffId, checkInTime, date, force);
      return result;
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e?.status === 409) {
        setLeaveConflict(true);
      }
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearConflict = useCallback(() => setLeaveConflict(false), []);

  return { mutate, isLoading, error, leaveConflict, clearConflict };
}

export function useCheckOutMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async ({ staffId, checkOutTime, date }: { staffId: string; checkOutTime?: string; date?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await checkOutStaff(staffId, checkOutTime, date);
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

export function useUpdateAttendanceMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async ({ id, updates }: { id: string; updates: any }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await updateStaffAttendance(id, updates);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

export function useDeleteAttendanceMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await deleteStaffAttendance(id);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

// Leave request mutation hooks
export function useCreateLeaveRequestMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (leaveData: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await createLeaveRequest(leaveData);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

export function useReviewLeaveRequestMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async ({ id, status, reviewedBy, reviewNotes }: { 
    id: string; 
    status: string; 
    reviewedBy: string; 
    reviewNotes?: string 
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await reviewLeaveRequest(id, status, reviewedBy, reviewNotes);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

export function useDeleteLeaveRequestMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await deleteLeaveRequest(id);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

export function useUpdateLeaveRequestMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async ({ id, leaveData }: { id: string; leaveData: any }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await updateLeaveRequest(id, leaveData);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

// Hook to fetch classes assigned to a teacher
export function useTeacherClasses(staffId: string, shouldFetch: boolean = true) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(shouldFetch);
  const [error, setError] = useState<Error | null>(null);
  const paramsRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    if (!staffId || !shouldFetch) return;
    
    const paramsStr = `classes-${staffId}`;
    const cacheKey = `teacher-classes-${paramsStr}`;
    const cached = dataCache.get(cacheKey);
    
    // Return cached data if still valid and params haven't changed
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION && paramsRef.current === paramsStr) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await api.getStaffClasses(staffId);
      
      // Cache the result
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
      paramsRef.current = paramsStr;
      setData(result);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch teacher classes:', err);
    } finally {
      setLoading(false);
    }
  }, [staffId, shouldFetch]);

  useEffect(() => {
    if (shouldFetch) {
      const paramsStr = `classes-${staffId}`;
      if (paramsRef.current !== paramsStr) {
        fetchData();
      }
    }
  }, [fetchData, shouldFetch, staffId]);

  return { classes: data, loading, error, refetch: fetchData };
}

// Utility function to clear cache when needed
export function clearDataCache() {
  dataCache.clear();
}
