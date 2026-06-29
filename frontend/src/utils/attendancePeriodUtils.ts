import { WorkHours } from '@/types/dashboard';

/**
 * Determine the current attendance period based on the current time
 * Returns information about which attendance threshold we're currently at
 */
export function getCurrentAttendancePeriod(
  currentTime: string,
  workHours: WorkHours
) {
  // Parse current time to minutes
  const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
  const currentTotalMinutes = currentHours * 60 + currentMinutes;
  
  // Parse work hours
  const [startHours, startMinutes] = workHours.startTime.split(':').map(Number);
  const startTotalMinutes = startHours * 60 + startMinutes;
  
  // Parse cutoff time (use end of work day)
  const cutoff = workHours.endTime;
  const [cutoffHours, cutoffMinutes] = cutoff.split(':').map(Number);
  const cutoffTotalMinutes = cutoffHours * 60 + cutoffMinutes;
  
  // Determine current period
  if (currentTotalMinutes < startTotalMinutes) {
    return {
      period: 'before_start',
      label: 'Before Work Hours',
      color: 'text-gray-500',
      description: 'Attendance tracking has not started yet'
    };
  } else if (currentTotalMinutes === startTotalMinutes) {
    return {
      period: 'at_start',
      label: 'Start Time',
      color: 'text-green-600',
      description: 'Check-in time - staff should check in now'
    };
  } else if (currentTotalMinutes < cutoffTotalMinutes) {
    return {
      period: 'during_work',
      label: 'Work Hours',
      color: 'text-blue-600',
      description: 'Staff can check in (will be marked late if after start time)'
    };
  } else if (currentTotalMinutes === cutoffTotalMinutes) {
    return {
      period: 'at_cutoff',
      label: 'Cutoff Time',
      color: 'text-orange-600',
      description: 'Absence being applied for no-shows'
    };
  } else {
    return {
      period: 'after_cutoff',
      label: 'After Cutoff',
      color: 'text-red-600',
      description: 'No check-ins will be marked as absent'
    };
  }
}
