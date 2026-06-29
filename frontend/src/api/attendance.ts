// Attendance API client — new endpoints added in 035-staff-attendance-filters

const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:8080/api';

const TOKEN_KEY = 'schoolledger_token';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message ?? 'Request failed');
  }
  return json.data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttendanceSummaryRecord {
  staff_id: string;
  first_name: string;
  last_name: string;
  department: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  excused_days: number;
}

export interface AttendanceSummaryResponse {
  month: string;
  records: AttendanceSummaryRecord[];
}

export interface TodayStaffEntry {
  staff_id: string;
  first_name: string;
  last_name: string;
  department: string;
  status: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  comment: string | null;
  has_record: boolean;
  is_on_leave?: boolean;
  leave_type?: string | null;
}

export interface TodayAttendanceResponse {
  date: string;
  unchecked_count: number;
  staff: TodayStaffEntry[];
}

export interface UpdateStatusResponse {
  attendance_id: string;
  staff_id: string;
  date: string;
  status: 'absent' | 'excused';
  comment: string | null;
  updated_at: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

export const attendanceApi = {
  /**
   * Fetch monthly attendance summary.
   * @param month  YYYY-MM string; defaults to current month when omitted.
   */
  getSummary(month?: string): Promise<AttendanceSummaryResponse> {
    const qs = month ? `?month=${encodeURIComponent(month)}` : '';
    return request<AttendanceSummaryResponse>(`/attendance/summary${qs}`);
  },

  /** Fetch today's attendance for all active staff, including unchecked. */
  getToday(): Promise<TodayAttendanceResponse> {
    return request<TodayAttendanceResponse>('/attendance/today');
  },

  /**
   * Mark a staff member as absent or excused for today.
   * Only admin/super_admin may call this endpoint.
   */
  updateStatus(
    staffId: string,
    status: 'absent' | 'excused',
    comment?: string
  ): Promise<UpdateStatusResponse> {
    return request<UpdateStatusResponse>(`/attendance/${staffId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, comment: comment ?? null }),
    });
  },
};
