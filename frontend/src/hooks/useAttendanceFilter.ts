import { useState } from 'react';

/** Returns the current month as a YYYY-MM string. */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Manages the selected month string for attendance filtering. */
export function useAttendanceFilter() {
  const [month, setMonth] = useState<string>(currentMonth);

  return { month, setMonth };
}
