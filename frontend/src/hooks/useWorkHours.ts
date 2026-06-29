import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '@/api/api';
import { Settings, WorkHours } from '@/types/dashboard';

// Default work hours for backward compatibility
const DEFAULT_STAFF_WORK_HOURS: WorkHours = {
  startTime: "08:30",
  endTime: "17:00"
};

const DEFAULT_STUDENT_WORK_HOURS: WorkHours = {
  startTime: "08:00",
  endTime: "15:00"
};

/**
 * Custom hook to fetch and return work hours from settings
 * Provides fallback defaults for backward compatibility
 */
export function useWorkHours(type: 'staff' | 'student') {
  const [workHours, setWorkHours] = useState<WorkHours>(
    type === 'staff' ? DEFAULT_STAFF_WORK_HOURS : DEFAULT_STUDENT_WORK_HOURS
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stableWorkHours = useRef<WorkHours>(workHours);
  const typeRef = useRef<'staff' | 'student'>(type);

  useEffect(() => {
    const fetchWorkHours = async () => {
      try {
        setLoading(true);
        setError(null);

        const settings = await api.getSettings();

        // Use configured work hours or fall back to defaults
        const configuredHours = type === 'staff'
          ? settings?.staffWorkHours
          : settings?.studentWorkHours;

        const defaultHours = type === 'staff'
          ? DEFAULT_STAFF_WORK_HOURS
          : DEFAULT_STUDENT_WORK_HOURS;

        const newWorkHours = configuredHours || defaultHours;

        // Only update if actually changed to prevent re-renders
        if (JSON.stringify(newWorkHours) !== JSON.stringify(stableWorkHours.current)) {
          stableWorkHours.current = newWorkHours;
          setWorkHours(newWorkHours);
        }
      } catch (err) {
        console.error('Failed to fetch work hours:', err);
        setError('Failed to load work hours settings');
        // Keep default values on error
      } finally {
        setLoading(false);
      }
    };

    // Fetch on initial mount and when type changes
    typeRef.current = type;
    fetchWorkHours();
  }, [type]);

  // Return memoized stable reference
  return useMemo(() => ({ 
    workHours: stableWorkHours.current, 
    loading, 
    error 
  }), [loading, error]);
}
