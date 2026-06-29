import { LeaveRequest, WorkHours } from '@/types/dashboard';

/**
 * Attendance states in order of progression
 */
export type AttendanceState = 
  | 'pending'
  | 'present' 
  | 'late'
  | 'checked_out'
  | 'absent'
  | 'on_leave'
  | 'half_day'
  | 'excused'
  | 'early_departure'
  | 'inactive'; // For suspended, terminated, resigned, retired

/**
 * Calculate attendance status based on state transitions
 * 
 * State flow: NOT ARRIVED → PRESENT → LATE → CHECKED_OUT → ABSENT
 * 
 * Rules:
 * - Start as NOT ARRIVED at beginning of day
 * - Mark ABSENT only after cutoff time
 * - If staff is on approved leave → override absence
 * - If staff is inactive (suspended, terminated, resigned, retired) → show INACTIVE
 */
export function calculateAttendanceState(
  attendance: { checkIn?: string; checkOut?: string; status?: string } | undefined,
  staffId: string,
  workHours: WorkHours,
  leaveRequests: LeaveRequest[],
  staff?: { employmentStatus?: string }
): AttendanceState {
  // First check if staff is inactive (suspended, terminated, resigned, retired)
  if (staff?.employmentStatus && staff.employmentStatus !== 'active') {
    return 'inactive';
  }
  
  // Then check if staff has approved leave for today (overrides everything)
  const today = new Date().toISOString().split('T')[0];
  const staffLeave = leaveRequests.find(leave => 
    leave.staffId === staffId &&
    leave.status === 'approved' &&
    leave.startDate <= today &&
    leave.endDate >= today
  );
  if (staffLeave) {
    return staffLeave.leaveType === 'half_day' ? 'half_day' : 'on_leave';
  }
  
  // If no attendance record exists
  if (!attendance) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Get cutoff time (use end of work day)
    const cutoffTime = workHours.endTime;
    const [cutoffHours, cutoffMinutes] = cutoffTime.split(':').map(Number);
    const cutoffTotalMinutes = cutoffHours * 60 + cutoffMinutes;
    
    // Before cutoff time: pending (internal state)
    // After cutoff time: ABSENT
    return currentTime < cutoffTotalMinutes ? 'pending' : 'absent';
  }

  if (attendance.status === 'absent' || attendance.status === 'on_leave' || attendance.status === 'half_day' || attendance.status === 'excused' || attendance.status === 'early_departure') {
    return attendance.status;
  }
  
  // If already checked out
  if (attendance.checkOut) {
    return attendance.status === 'late' ? 'late' : 'checked_out';
  }
  
  // If checked in
  if (attendance.checkIn) {
    // Check if late
    const [checkInHours, checkInMinutes] = attendance.checkIn.split(':').map(Number);
    const [startHours, startMinutes] = workHours.startTime.split(':').map(Number);
    
    const checkInTotalMinutes = checkInHours * 60 + checkInMinutes;
    const startTotalMinutes = startHours * 60 + startMinutes;
    
    return checkInTotalMinutes > startTotalMinutes ? 'late' : 'present';
  }
  
  // Default to pending (internal state) if record exists but no check-in
  return 'pending';
}

/**
 * Get the next possible states from current state
 */
export function getNextPossibleStates(currentState: AttendanceState): AttendanceState[] {
  const stateFlow: Record<AttendanceState, AttendanceState[]> = {
    'pending': ['present', 'late', 'absent', 'on_leave', 'half_day'],
    'present': ['checked_out', 'on_leave', 'half_day'],
    'late': ['checked_out', 'on_leave', 'half_day'],
    'checked_out': [], // Terminal state for the day
    'absent': [], // Terminal state for the day (unless overridden by leave)
    'on_leave': [], // Terminal state for the day
    'half_day': [], // Terminal state for the day
    'excused': [],
    'early_departure': [],
    'inactive': [], // Terminal state - no attendance tracking
  };
  
  return stateFlow[currentState] || [];
}

/**
 * Check if a state transition is valid
 */
export function isValidStateTransition(from: AttendanceState, to: AttendanceState): boolean {
  return getNextPossibleStates(from).includes(to);
}

/**
 * Get display text for employment status
 */
export function getEmploymentStatusDisplay(status?: string): string {
  switch (status) {
    case 'suspended':
      return 'SUSPENDED';
    case 'resigned':
      return 'RESIGNED';
    case 'retired':
      return 'RETIRED';
    case 'on_leave':
      return 'ON LEAVE';
    case 'active':
    default:
      return 'ACTIVE';
  }
}
