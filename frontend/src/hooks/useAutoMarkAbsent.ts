import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Staff, StaffAttendanceRecord } from '@/types/dashboard';

/**
 * Hook to automatically mark absent staff when attendance is viewed after cutoff time
 * This implements lazy evaluation - marking absent only when someone checks the system
 * Also checks previous days for any missing attendance records
 */
export function useAutoMarkAbsent(
  staff: Staff[],
  attendanceRecords: StaffAttendanceRecord[],
  workHours: { startTime: string; endTime: string },
  onRefresh?: () => void
) {
  const lastCheckedRef = useRef<string>('');
  const checkDataRef = useRef<{ staff: Staff[], records: StaffAttendanceRecord[] }>({ staff: [], records: [] });
  const checkPreviousDays = useCallback(() => {
    const today = new Date();
    const datesToCheck = [];
    
    // Check up to 7 previous days (excluding weekends)
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Skip weekends
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      
      const dateStr = date.toISOString().split('T')[0];
      
      // Only check if some staff had records for this day (indicates it was a work day)
      const dayRecords = attendanceRecords.filter(r => r.date === dateStr);
      if (dayRecords.length > 0) {
        datesToCheck.push(dateStr);
      }
    }
    
    if (datesToCheck.length === 0) {
      return;
    }
    
    // For each date, find staff who don't have records
    const missingAttendanceByDate: Record<string, Staff[]> = {};
    
    datesToCheck.forEach(date => {
      const staffWithRecords = new Set(
        attendanceRecords
          .filter(r => r.date === date)
          .map(r => r.staffId)
      );
      
      const missingStaff = staff.filter(s => !staffWithRecords.has(s.id));
      if (missingStaff.length > 0) {
        missingAttendanceByDate[date] = missingStaff;
      }
    });
    
    // Show notification if there are missing records
    const totalMissing = Object.values(missingAttendanceByDate).reduce((sum, arr) => sum + arr.length, 0);
    
    if (totalMissing > 0) {
      const dateList = Object.keys(missingAttendanceByDate).join(', ');
      toast.warning(
        `Found ${totalMissing} missing attendance record(s) for: ${dateList}. Use Manual Attendance to update.`,
        {
          duration: 8000,
          action: {
            label: 'View Details',
            onClick: () => {
              let message = 'Missing Attendance:\n\n';
              Object.entries(missingAttendanceByDate).forEach(([date, staffList]) => {
                message += `${date}: ${staffList.length} staff\n`;
                staffList.slice(0, 3).forEach(s => {
                  message += `  - ${s.firstName} ${s.lastName}\n`;
                });
                if (staffList.length > 3) {
                  message += `  ... and ${staffList.length - 3} more\n`;
                }
                message += '\n';
              });
              alert(message);
            }
          }
        }
      );
    }
  }, [staff, attendanceRecords]);
  
  const checkAndMarkAbsent = useCallback(() => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Get cutoff time (use end of work day)
    const cutoff = workHours.endTime;
    const [cutoffHours, cutoffMinutes] = cutoff.split(':').map(Number);
    const cutoffTotalMinutes = cutoffHours * 60 + cutoffMinutes;
    
    // Only proceed if we're past cutoff time
    if (currentTime < cutoffTotalMinutes) {
      return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Find staff who are pending (no attendance record for today)
    const pendingStaff = staff.filter(staffMember => {
      const hasRecord = attendanceRecords.some(
        record => record.staffId === staffMember.id && record.date === today
      );
      return !hasRecord;
    });
    
    if (pendingStaff.length === 0) {
      return; // Everyone has records
    }
    
    // Show notification about pending staff
    toast.info(
      `${pendingStaff.length} staff member(s) haven't checked in today. Use Manual Attendance to mark them absent.`,
      {
        duration: 5000,
        action: {
          label: 'View List',
          onClick: () => {
            const names = pendingStaff.map(s => `${s.firstName} ${s.lastName}`).join(', ');
            alert(`Pending check-ins:\n${names}`);
          }
        }
      }
    );
  }, [staff, attendanceRecords, workHours]);
  
  // Check when component mounts or when data changes, but debounce to prevent excessive calls
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const dataChanged = 
      JSON.stringify(checkDataRef.current.staff) !== JSON.stringify(staff) ||
      JSON.stringify(checkDataRef.current.records) !== JSON.stringify(attendanceRecords);
    
    if (!dataChanged || lastCheckedRef.current === today) {
      return;
    }
    
    // Update refs
    checkDataRef.current = { staff: [...staff], records: [...attendanceRecords] };
    lastCheckedRef.current = today;
    
    // Debounce the checks
    const timer = setTimeout(() => {
      checkPreviousDays();
      checkAndMarkAbsent();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [staff, attendanceRecords, checkPreviousDays, checkAndMarkAbsent]);
  
  return { checkAndMarkAbsent, checkPreviousDays };
}
