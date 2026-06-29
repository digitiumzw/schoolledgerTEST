import { useState, useCallback } from 'react';
import { api, AttendancePeriodReport, AttendanceDepartmentReport } from '@/api/api';

export interface PeriodReportParams {
  startDate: string;
  endDate: string;
  department?: string;
  staffId?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'staffName' | 'departmentName' | 'attendanceRate' | 'presentDays' | 'lateDays' | 'totalOvertimeHours';
  sortOrder?: 'asc' | 'desc';
}

export interface DepartmentReportParams {
  startDate: string;
  endDate: string;
}

export function useAttendancePeriodReport() {
  const [data, setData] = useState<AttendancePeriodReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async (params: PeriodReportParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getAttendancePeriodReport(params);
      setData(result);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetch };
}

export function useAttendanceDepartmentReport() {
  const [data, setData] = useState<AttendanceDepartmentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async (params: DepartmentReportParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getAttendanceDepartmentReport(params);
      setData(result);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetch };
}
