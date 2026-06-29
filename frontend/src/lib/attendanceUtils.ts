/**
 * ================================================================================
 * attendanceUtils.ts - Staff Attendance & Leave Utilities
 * ================================================================================
 * 
 * PURPOSE:
 * Helper functions for the Staff Attendance module. These utilities handle time
 * calculations, formatting, status colors, and leave type badges.
 * 
 * WHY THIS EXISTS:
 * Staff attendance involves complex time calculations (work hours, late check-ins,
 * date ranges). Instead of repeating this logic everywhere, we centralize it here.
 * 
 * MAIN EXPORTS:
 * - calculateWorkHours(checkIn, checkOut) - Calculate hours worked
 * - formatTime(time) - Format time in 24-hour format (08:30 → 08:30)
 * - isLateCheckIn(time, workHours) - Check if check-in is after configured start time
 * - calculateAttendanceStatus(checkInTime, workHours) - Calculate present/late/absent
 * - getAttendanceStatusColor(status) - Badge colors for attendance status
 * - calculateDays(startDate, endDate) - Count days in date range (inclusive)
 * - getLeaveTypeVariant(type) - Badge colors for leave types
 * - formatWorkHours(hours) - Format decimal hours to "8h 30m"
 * - getCurrentTime() - Get current time as "HH:mm"
 * - isWithinWorkingHours(workHours) - Check if current time is within work hours
 * 
 * RELATED FILES:
 * - Used in: Staff Attendance page tabs (Daily, Records, Leave Management)
 * - Works with: StaffAttendanceRecord, LeaveRequest, WorkHours types
 * 
 * FOR BEGINNERS:
 * Think of this as a calculator and formatter specifically for staff attendance.
 * It handles all the time math and formatting so components don't have to.
 * ================================================================================
 */

import { WorkHours } from '@/types/dashboard';

// -----------------------------------------------------------------------------
// SECTION: Work Hours Calculation
// Purpose: Calculate how many hours a staff member worked
// -----------------------------------------------------------------------------

/**
 * Calculate work hours between check-in and check-out times
 * 
 * WHAT IT DOES:
 * Takes two time strings (check-in and check-out) and calculates the difference
 * in hours as a decimal number
 * 
 * HOW IT WORKS:
 * 1. Split time strings into hours and minutes
 * 2. Convert both times to total minutes
 * 3. Calculate the difference in minutes
 * 4. Convert minutes back to hours (divide by 60)
 * 5. Round to 2 decimal places for cleanliness
 * 
 * EXAMPLE USAGE:
 * calculateWorkHours("08:30", "17:00")  // Returns: 8.5 (8 hours 30 minutes)
 * calculateWorkHours("09:00", "17:30")  // Returns: 8.5
 * calculateWorkHours("08:00", "12:00")  // Returns: 4.0
 * 
 * @param checkIn - Check-in time in 24h format "HH:mm" (e.g., "08:30")
 * @param checkOut - Check-out time in 24h format "HH:mm" (e.g., "17:00")
 * @returns Work hours as a decimal number (e.g., 8.5 for 8 hours 30 minutes)
 */
export function calculateWorkHours(checkIn: string, checkOut: string): number {
  // Split check-in time "08:30" into hours (8) and minutes (30)
  const [checkInHours, checkInMinutes] = checkIn.split(':').map(Number);
  
  // Split check-out time "17:00" into hours (17) and minutes (0)
  const [checkOutHours, checkOutMinutes] = checkOut.split(':').map(Number);
  
  // Convert both times to total minutes
  // Example: 8:30 = (8 * 60) + 30 = 510 minutes
  // Example: 17:00 = (17 * 60) + 0 = 1020 minutes
  const workMinutes = (checkOutHours * 60 + checkOutMinutes) - (checkInHours * 60 + checkInMinutes);
  
  // Convert minutes to hours and round to 2 decimal places
  // Example: 510 minutes / 60 = 8.5 hours
  return Math.round((workMinutes / 60) * 100) / 100;
}

// -----------------------------------------------------------------------------
// SECTION: Time Formatting
// Purpose: Format time in 24-hour format
// -----------------------------------------------------------------------------

/**
 * Format time in 24-hour format
 * 
 * WHAT IT DOES:
 * Returns the time in 24-hour format without conversion
 * 
 * HOW IT WORKS:
 * 1. Split time into hours and minutes
 * 2. Ensure minutes are padded with leading zero if needed
 * 3. Return in HH:mm format
 * 
 * EXAMPLE USAGE:
 * formatTime("08:30")  // Returns: "08:30"
 * formatTime("14:45")  // Returns: "14:45"
 * formatTime("00:00")  // Returns: "00:00"
 * formatTime("12:00")  // Returns: "12:00"
 * 
 * @param time - Time in 24-hour format "HH:mm"
 * @returns Formatted time in 24-hour format (e.g., "08:30")
 */
export function formatTime(time: string): string {
  // Split time "14:30" into hours (14) and minutes (30)
  const [hours, minutes] = time.split(':').map(Number);
  
  // Ensure minutes always have 2 digits (pad with leading zero if needed)
  // padStart(2, '0') adds a '0' at the start if the string is only 1 character
  // Example: "5" becomes "05", but "15" stays "15"
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// -----------------------------------------------------------------------------
// SECTION: Late Check-In Detection
// Purpose: Determine if a staff member checked in late (after configured start time)
// -----------------------------------------------------------------------------

/**
 * Check if a check-in time is considered late (after configured work start time)
 * 
 * WHAT IT DOES:
 * Returns true if the check-in time is after the configured work start time
 * 
 * HOW IT WORKS:
 * Compares the check-in time to the configured start time for staff or students
 * 
 * EXAMPLE USAGE:
 * isLateCheckIn("08:31", { startTime: "08:30" })  // Returns: true (1 minute late)
 * isLateCheckIn("08:30", { startTime: "08:30" })  // Returns: false (exactly on time)
 * isLateCheckIn("09:00", { startTime: "08:30" })  // Returns: true (30 minutes late)
 * 
 * @param time - Check-in time in 24h format "HH:mm"
 * @param workHours - WorkHours configuration with startTime
 * @returns true if late, false if on time or early
 */
export function isLateCheckIn(time: string, workHours: WorkHours): boolean {
  // Split check-in time into hours and minutes
  const [checkInHours, checkInMinutes] = time.split(':').map(Number);
  
  // Split configured start time into hours and minutes
  const [startHours, startMinutes] = workHours.startTime.split(':').map(Number);
  
  // Convert both times to total minutes since midnight for easy comparison
  const checkInTotalMinutes = checkInHours * 60 + checkInMinutes;
  const startTotalMinutes = startHours * 60 + startMinutes;
  
  // Late if check-in time is after start time
  return checkInTotalMinutes > startTotalMinutes;
}

/**
 * Determine attendance status based on check-in time and work hours
 * 
 * WHAT IT DOES:
 * Calculates attendance status (present, late, absent) based on check-in behavior
 * 
 * HOW IT WORKS:
 * - Present: checked in within working hours (on or before start time)
 * - Late: checked in after start time
 * - Absent: never checked in (no check-in time)
 * 
 * @param checkInTime - Check-in time in "HH:mm" format or null if no check-in
 * @param workHours - WorkHours configuration
 * @returns Attendance status string
 */
export function calculateAttendanceStatus(checkInTime: string | null, workHours: WorkHours): 'present' | 'late' | 'absent' {
  if (!checkInTime) {
    return 'absent';
  }
  
  if (isLateCheckIn(checkInTime, workHours)) {
    return 'late';
  }
  
  return 'present';
}

/**
 * Check if current time is within working hours
 * 
 * WHAT IT DOES:
 * Returns true if the current time is between start and end times
 * 
 * @param workHours - WorkHours configuration
 * @returns true if within working hours
 */
export function isWithinWorkingHours(workHours: WorkHours): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const [startHours, startMinutes] = workHours.startTime.split(':').map(Number);
  const [endHours, endMinutes] = workHours.endTime.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  return currentMinutes >= startTotalMinutes && currentMinutes <= endTotalMinutes;
}

// -----------------------------------------------------------------------------
// SECTION: Attendance Status Badge Colors
// Purpose: Map attendance status to UI badge variants
// -----------------------------------------------------------------------------

/**
 * Get badge variant for attendance status
 * 
 * WHAT IT DOES:
 * Maps status strings to Shadcn badge variant names for consistent styling
 * 
 * HOW IT WORKS:
 * Uses a switch statement to return the appropriate badge variant
 * 
 * EXAMPLE USAGE:
 * getAttendanceStatusColor("present")   // Returns: "default" (usually green/blue)
 * getAttendanceStatusColor("late")      // Returns: "secondary" (usually yellow)
 * getAttendanceStatusColor("absent")    // Returns: "destructive" (red)
 * getAttendanceStatusColor("on_leave")  // Returns: "outline" (gray)
 * 
 * IN COMPONENTS:
 * <Badge variant={getAttendanceStatusColor(record.status)}>{record.status}</Badge>
 * 
 * @param status - The attendance status string
 * @returns Badge variant name from Shadcn UI ("default" | "secondary" | "destructive" | "outline")
 */
export function getAttendanceStatusColor(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case 'present':
      return 'default';      // Blue/primary color for present
    case 'late':
      return 'secondary';    // Yellow/warning color for late
    case 'absent':
      return 'destructive';  // Red for absent (needs attention)
    case 'on_leave':
      return 'outline';      // Gray outline for on leave (neutral)
    case 'half_day':
      return 'secondary';    // Yellow for half day
    case 'pending':
      return 'outline';      // Gray for pending (not yet determined)
    case 'checked_out':
      return 'default';      // Blue for checked out (completed day)
    case 'inactive':
      return 'destructive';  // Red for inactive (suspended, terminated, etc.)
    default:
      return 'outline';      // Default to outline if status is unknown
  }
}

// -----------------------------------------------------------------------------
// SECTION: Date Range Calculation
// Purpose: Calculate number of days between two dates (inclusive)
// -----------------------------------------------------------------------------

/**
 * Calculate the number of days between two dates (inclusive)
 * 
 * WHAT IT DOES:
 * Counts how many days are in a date range, including both start and end dates
 * 
 * HOW IT WORKS:
 * 1. Convert date strings to Date objects
 * 2. Calculate time difference in milliseconds
 * 3. Convert milliseconds to days
 * 4. Add 1 to include both start and end dates
 * 
 * EXAMPLE USAGE:
 * calculateDays("2024-11-01", "2024-11-01")  // Returns: 1 (same day = 1 day)
 * calculateDays("2024-11-01", "2024-11-05")  // Returns: 5 (5 days inclusive)
 * calculateDays("2024-11-01", "2024-11-30")  // Returns: 30 (entire month)
 * 
 * USE CASE:
 * When a staff member applies for leave from Nov 1 to Nov 5, this calculates
 * that they're requesting 5 days of leave (not 4).
 * 
 * @param startDate - Start date in "YYYY-MM-DD" format
 * @param endDate - End date in "YYYY-MM-DD" format
 * @returns Number of days in the range (inclusive of both dates)
 */
export function calculateDays(startDate: string, endDate: string): number {
  // Convert date strings to Date objects
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate difference in milliseconds between the two dates
  // Math.abs() ensures positive result regardless of date order
  const diffTime = Math.abs(end.getTime() - start.getTime());
  
  // Convert milliseconds to days
  // 1000 ms/second * 60 seconds/minute * 60 minutes/hour * 24 hours/day
  // Math.ceil() rounds up to handle partial days
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Add 1 to include both start and end dates
  // Example: Nov 1 to Nov 3 is 3 days (1st, 2nd, 3rd), not 2
  return diffDays + 1;
}

// -----------------------------------------------------------------------------
// SECTION: Leave Type Badge Colors
// Purpose: Map leave types to appropriate badge colors
// -----------------------------------------------------------------------------

/**
 * Get badge variant for leave type
 * 
 * WHAT IT DOES:
 * Returns appropriate badge styling based on the type of leave requested
 * 
 * HOW IT WORKS:
 * Maps leave type strings to badge variants using a color-coded system
 * 
 * EXAMPLE USAGE:
 * getLeaveTypeVariant("sick")       // Returns: "destructive" (red - urgent)
 * getLeaveTypeVariant("vacation")   // Returns: "default" (blue - planned)
 * getLeaveTypeVariant("personal")   // Returns: "secondary" (yellow - casual)
 * getLeaveTypeVariant("maternity")  // Returns: "default" (blue - planned)
 * 
 * COLOR CODING:
 * - Red (destructive): Urgent/unplanned (sick, emergency)
 * - Blue (default): Planned/standard (vacation, maternity)
 * - Yellow (secondary): Casual (personal)
 * - Gray (outline): Special cases (unpaid)
 * 
 * @param type - The leave type string (e.g., "sick", "vacation", "personal")
 * @returns Badge variant for styling
 */
export function getLeaveTypeVariant(type: string | null | undefined): "default" | "secondary" | "destructive" | "outline" {
  if (!type) return 'outline';
  // Create a mapping of leave types to badge variants
  const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    annual: 'default',         // Blue - planned annual leave
    sick: 'destructive',       // Red - urgent/health issue
    maternity: 'default',      // Blue - planned extended leave
    paternity: 'default',      // Blue - planned paternity leave
    study: 'secondary',        // Yellow - professional development
    unpaid: 'outline',         // Gray - special case
    compassionate: 'destructive', // Red - urgent/family emergency
    // Legacy types (pre-migration)
    vacation: 'default',
    personal: 'secondary',
  };
  
  // Return the color for the given type, or default to outline
  return colors[type] || 'outline';
}

// -----------------------------------------------------------------------------
// SECTION: Work Hours Formatting
// Purpose: Format decimal hours to human-readable format (8.5 → "8h 30m")
// -----------------------------------------------------------------------------

/**
 * Calculate working days between two dates (excluding weekends and holidays)
 * 
 * WHAT IT DOES:
 * Calculates the number of working days (weekdays) between start and end dates,
 * excluding weekends and optionally excluding holidays based on school calendar
 * 
 * HOW IT WORKS:
 * 1. Iterate through each day from start to end
 * 2. Skip weekends (Saturday, Sunday)
 * 3. Skip holidays if provided
 * 4. Count only valid working days
 * 
 * EXAMPLE USAGE:
 * calculateWorkingDays("2024-01-01", "2024-01-05")  // Returns: 5 (Mon-Fri)
 * calculateWorkingDays("2024-01-01", "2024-01-07", holidays)  // Excludes holidays
 * 
 * @param startDate - Start date in "YYYY-MM-DD" format
 * @param endDate - End date in "YYYY-MM-DD" format
 * @param holidays - Optional array of holiday dates to exclude
 * @returns Number of working days
 */
export function calculateWorkingDays(startDate: string, endDate: string, holidays?: string[]): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const holidaySet = new Set(holidays || []);
  
  let workingDays = 0;
  const current = new Date(start);
  
  // Reset time to avoid timezone issues
  current.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];
    
    // Check if it's a weekday (0=Sunday, 6=Saturday)
    // And not a holiday
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      workingDays++;
    }
    
    // Move to next day
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
}

/**
 * Format leave type to display name
 * 
 * EXAMPLE USAGE:
 * formatLeaveType("annual")       // Returns: "Annual Leave"
 * formatLeaveType("sick")         // Returns: "Sick Leave"
 * formatLeaveType("maternity")    // Returns: "Maternity Leave"
 * 
 * @param type - The leave type string
 * @returns Formatted display name
 */
export function formatLeaveType(type: string | null | undefined): string {
  if (!type) return 'Unknown';
  const displayNames: Record<string, string> = {
    annual: 'Annual Leave',
    sick: 'Sick Leave',
    maternity: 'Maternity Leave',
    paternity: 'Paternity Leave',
    study: 'Study Leave',
    unpaid: 'Unpaid Leave',
    compassionate: 'Compassionate Leave',
    // Legacy types (pre-migration)
    vacation: 'Annual Leave',
    personal: 'Personal Leave',
  };
  
  return displayNames[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Format decimal work hours to "Xh Ym" format
 * 
 * WHAT IT DOES:
 * Converts a decimal number of hours to a readable format with hours and minutes
 * 
 * HOW IT WORKS:
 * 1. Split the number into whole hours (floor)
 * 2. Convert the decimal part to minutes (* 60)
 * 3. Format as "Xh Ym" or just "Xh" if no minutes
 * 
 * EXAMPLE USAGE:
 * formatWorkHours(8.5)   // Returns: "8h 30m"
 * formatWorkHours(7.25)  // Returns: "7h 15m"
 * formatWorkHours(8)     // Returns: "8h"
 * formatWorkHours(9.75)  // Returns: "9h 45m"
 * 
 * @param hours - Work hours as decimal number (e.g., 8.5 for 8 hours 30 minutes)
 * @returns Formatted string like "8h 30m"
 */
export function formatWorkHours(hours: number): string {
  // Get whole hours by rounding down
  // Example: 8.75 → 8
  const h = Math.floor(hours);
  
  // Get minutes from the decimal part
  // (hours - h) gives the decimal part (0.75)
  // Multiply by 60 to convert to minutes (0.75 * 60 = 45)
  // Round to nearest minute
  const m = Math.round((hours - h) * 60);
  
  // If there are minutes, include them in the format
  // Otherwise, just show hours
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// -----------------------------------------------------------------------------
// SECTION: Current Time Helper
// Purpose: Get the current time in the format we use throughout the app
// -----------------------------------------------------------------------------

/**
 * Get current time in HH:mm format (24-hour)
 * 
 * WHAT IT DOES:
 * Returns the current time as a string in "HH:mm" format
 * 
 * HOW IT WORKS:
 * 1. Get current Date object
 * 2. Extract hours and minutes
 * 3. Pad with leading zeros if needed
 * 4. Combine into HH:mm format
 * 
 * EXAMPLE USAGE:
 * getCurrentTime()  // Returns: "14:35" (if current time is 2:35 PM)
 * getCurrentTime()  // Returns: "08:05" (if current time is 8:05 AM)
 * 
 * USE CASE:
 * Used for pre-filling check-in/check-out time fields with the current time
 * 
 * @returns Current time as "HH:mm" string
 */
export function getCurrentTime(): string {
  // Get the current date and time
  const now = new Date();
  
  // Get hours (0-23) and minutes (0-59)
  // Convert to string and pad with leading zero if single digit
  // Example: 8 becomes "08", 14 stays "14"
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}
