import { format } from 'date-fns';
import { Staff, StaffAttendanceRecord, LeaveRequest, Settings, WorkHours } from '@/types/dashboard';
import { calculateAttendanceState } from '@/lib/attendanceStateTransitions';

// Default work hours
const DEFAULT_STAFF_WORK_HOURS: WorkHours = {
  startTime: "08:30",
  endTime: "17:00"
};

// Create a Map for O(1) staff lookups
export function createStaffMap(staff: Staff[]): Map<string, Staff> {
  return new Map(staff.map(s => [s.id, s]));
}

// Memoized staff name lookup
export function createStaffNameLookup(staff: Staff[]): Map<string, string> {
  return new Map(staff.map(s => [s.id, `${s.firstName} ${s.lastName}`]));
}

// Get work hours from settings or use default
export function getWorkHours(settings?: Settings | null): WorkHours {
  return settings?.staffWorkHours || DEFAULT_STAFF_WORK_HOURS;
}

// Memoized date formatting
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const key = JSON.stringify(options);
  if (!dateFormatters.has(key)) {
    dateFormatters.set(key, new Intl.DateTimeFormat('en-US', options));
  }
  const formatter = dateFormatters.get(key)!;
  return formatter.format(typeof date === 'string' ? new Date(date) : date);
}

// Optimized status calculation with memoization and proper cache management
const statusCache = new Map<string, { status: string; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds
const MAX_CACHE_SIZE = 500; // Reduced max size

export function calculateAttendanceStatus(
  attendance: StaffAttendanceRecord | undefined,
  staffId: string,
  workHours: WorkHours,
  leaveRequests: LeaveRequest[],
  settings?: Settings | null,
  staffMember?: Staff
): string {
  // Create cache key
  const cacheKey = `${attendance?.id || 'none'}-${staffId}-${workHours.startTime}-${workHours.endTime}-${leaveRequests.length}-${staffMember?.employmentStatus || 'active'}`;
  
  const cached = statusCache.get(cacheKey);
  
  // Return cached status if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.status;
  }
  
  const status = calculateAttendanceState(attendance, staffId, workHours, leaveRequests, staffMember);
  
  // Cache the result with timestamp
  statusCache.set(cacheKey, { status, timestamp: Date.now() });
  
  // Clean up old entries if cache is too large
  if (statusCache.size > MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [key, value] of statusCache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        statusCache.delete(key);
      }
    }
    
    // If still too large, remove oldest entries
    if (statusCache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(statusCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, statusCache.size - MAX_CACHE_SIZE + 100);
      toDelete.forEach(([key]) => statusCache.delete(key));
    }
  }
  
  return status;
}

// Clear status cache when needed
export function clearStatusCache() {
  statusCache.clear();
}

// Clear expired cache entries
export function clearExpiredStatusCache() {
  const now = Date.now();
  for (const [key, value] of statusCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      statusCache.delete(key);
    }
  }
}

// Optimized status badge component logic
export function getStatusDisplayInfo(status: string) {
  let displayStatus: string;
  let isClickable = false;
  
  switch (status) {
    case 'present':
      displayStatus = 'PRESENT';
      break;
    case 'late':
      displayStatus = 'LATE';
      isClickable = true;
      break;
    case 'absent':
      displayStatus = 'ABSENT';
      isClickable = true;
      break;
    case 'on_leave':
      displayStatus = 'ON ACTIVE LEAVE';
      break;
    case 'half_day':
      displayStatus = 'HALF DAY';
      break;
    case 'excused':
      displayStatus = 'EXCUSED';
      break;
    case 'early_departure':
      displayStatus = 'EARLY DEPARTURE';
      break;
    case 'checked_out':
      displayStatus = 'PRESENT';
      break;
    case 'pending':
      displayStatus = 'NOT ARRIVED';
      isClickable = true;
      break;
    case 'inactive':
      displayStatus = 'INACTIVE';
      break;
    default:
      displayStatus = status.replace('_', ' ').toUpperCase();
  }
  
  return { displayStatus, isClickable };
}

// Filter leave requests for a specific date range
export function filterLeaveRequestsForDate(
  leaveRequests: LeaveRequest[],
  date: string
): LeaveRequest[] {
  return leaveRequests.filter(leave => 
    leave.status === 'approved' && 
    leave.startDate <= date && 
    leave.endDate >= date
  );
}

// Check if staff member can check in/out
export function canCheckIn(attendance: StaffAttendanceRecord | undefined, status: string): boolean {
  return !attendance?.checkIn && status !== 'inactive' && status !== 'on_leave' && status !== 'half_day';
}

export function canCheckOut(attendance: StaffAttendanceRecord | undefined, status: string): boolean {
  return !!attendance?.checkIn && !attendance?.checkOut && status !== 'inactive' && status !== 'on_leave' && status !== 'half_day';
}

// Optimized search/filter function
export function filterAndSortRecords(
  records: StaffAttendanceRecord[],
  staffNameMap: Map<string, string>,
  searchQuery: string,
  statusFilter: string,
  dateRange?: { start?: Date; end?: Date }
): StaffAttendanceRecord[] {
  let filtered = records;

  // Filter by date range (before search/status for best performance on large sets)
  if (dateRange?.start) {
    const startStr = format(dateRange.start, 'yyyy-MM-dd');
    filtered = filtered.filter(r => r.date >= startStr);
  }
  if (dateRange?.end) {
    const endStr = format(dateRange.end, 'yyyy-MM-dd');
    filtered = filtered.filter(r => r.date <= endStr);
  }

  // Filter by search query
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(record => {
      const staffName = staffNameMap.get(record.staffId) || '';
      return staffName.toLowerCase().includes(query);
    });
  }
  
  // Filter by status
  if (statusFilter && statusFilter !== 'all') {
    filtered = filtered.filter(record => record.status === statusFilter);
  }
  
  // Sort by date (newest first)
  return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Debounced search utility
export function createDebouncedSearch(delay: number = 300) {
  let timeoutId: number;
  
  return (fn: () => void) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(fn, delay);
  };
}

// Calculate attendance statistics
export function calculateAttendanceStats(attendanceRecords: StaffAttendanceRecord[]) {
  const stats = {
    total: attendanceRecords.length,
    present: 0,
    absent: 0,
    late: 0,
    onLeave: 0,
  };

  attendanceRecords.forEach(record => {
    switch (record.status) {
      case 'present':
        stats.present++;
        break;
      case 'absent':
        stats.absent++;
        break;
      case 'late':
        stats.late++;
        break;
      case 'on_leave':
        stats.onLeave++;
        break;
    }
  });

  return stats;
}

// Format time consistently
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatTime(time: string): string {
  if (!time) return '-';
  try {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes), 0);
    return timeFormatter.format(date);
  } catch {
    return time;
  }
}

// Check if a date is today
export function isToday(date: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return date === today;
}

// Get today's date string
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// Check if staff is inactive
export function isStaffInactive(staffMember: Staff | undefined): boolean {
  return staffMember?.employmentStatus === 'resigned' || 
         staffMember?.employmentStatus === 'suspended' || 
         staffMember?.employmentStatus === 'retired';
}
