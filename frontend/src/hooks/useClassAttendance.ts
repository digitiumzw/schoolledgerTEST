import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/api';
import type {
  ClassAttendanceBatchInput,
  ClassAttendanceBatchResult,
  ClassAttendanceRegister,
  StudentClassAttendanceSummary,
  ClassAttendanceSummary,
  SessionAttendanceSummary,
  AttendanceAuditLog,
} from '../types/dashboard';

// ─────────────────────────────────────────────────────────────────────────────
// US1: Effective register for a class on a date
// ─────────────────────────────────────────────────────────────────────────────

export function useClassAttendanceRegister(
  classId: string | null,
  date: string | null,
  periodKey?: string | null,
  options?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: 'studentName' | 'status' | 'submittedAt';
    sortOrder?: 'asc' | 'desc';
  }
) {
  return useQuery<ClassAttendanceRegister>({
    queryKey: ['class-attendance-register', classId, date, periodKey ?? null, options ?? {}],
    queryFn: async () => {
      if (!classId || !date) throw new Error('Missing params');
      return api.getClassAttendanceRegister({ classId, date, periodKey, ...options });
    },
    enabled: Boolean(classId && date),
    staleTime: 30_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// US1: Submit attendance batch
// ─────────────────────────────────────────────────────────────────────────────

export function useSubmitClassAttendance() {
  const queryClient = useQueryClient();

  return useMutation<ClassAttendanceBatchResult, Error, ClassAttendanceBatchInput>({
    mutationFn: (input) => api.submitClassAttendance(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['class-attendance-register', variables.classId, variables.date],
      });
      queryClient.invalidateQueries({ queryKey: ['class-attendance-summary'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// US3: Per-student summary
// ─────────────────────────────────────────────────────────────────────────────

export function useStudentClassAttendanceSummary(
  studentId: string | null,
  sessionId: string | null,
  startDate?: string,
  endDate?: string
) {
  return useQuery<StudentClassAttendanceSummary>({
    queryKey: ['student-class-attendance-summary', studentId, sessionId, startDate, endDate],
    queryFn: async () => {
      if (!studentId || !sessionId) throw new Error('Missing params');
      return api.getStudentClassAttendanceSummary({ studentId, sessionId, startDate, endDate });
    },
    enabled: Boolean(studentId && sessionId),
    staleTime: 60_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// US3: Class summary over date range
// ─────────────────────────────────────────────────────────────────────────────

export function useClassAttendanceSummary(
  classId: string | null,
  startDate: string | null,
  endDate: string | null,
  search?: string
) {
  return useQuery<ClassAttendanceSummary>({
    queryKey: ['class-attendance-summary', classId, startDate, endDate, search],
    queryFn: async () => {
      if (!classId || !startDate || !endDate) throw new Error('Missing params');
      return api.getClassAttendanceSummary({ classId, startDate, endDate, search });
    },
    enabled: Boolean(classId && startDate && endDate),
    staleTime: 60_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// US3: Session-level rollup
// ─────────────────────────────────────────────────────────────────────────────

export function useSessionAttendanceSummary(academicSession: string | null) {
  return useQuery<SessionAttendanceSummary>({
    queryKey: ['session-attendance-summary', academicSession],
    queryFn: async () => {
      if (!academicSession) throw new Error('Missing academicSession');
      return api.getSessionAttendanceSummary(academicSession);
    },
    enabled: Boolean(academicSession),
    staleTime: 60_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// US4: Audit log
// ─────────────────────────────────────────────────────────────────────────────

export function useAttendanceAuditLog(
  studentId: string | null,
  classId: string | null,
  date: string | null,
  periodKey?: string | null
) {
  return useQuery<AttendanceAuditLog>({
    queryKey: ['attendance-audit-log', studentId, classId, date, periodKey ?? null],
    queryFn: async () => {
      if (!studentId || !classId || !date) throw new Error('Missing params');
      return api.getClassAttendanceAuditLog({ studentId, classId, date, periodKey });
    },
    enabled: Boolean(studentId && classId && date),
    staleTime: 0,
  });
}
