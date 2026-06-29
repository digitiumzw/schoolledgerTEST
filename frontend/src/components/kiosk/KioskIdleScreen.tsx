import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

export interface KioskIdleScreenProps {
  schoolName: string;
  workHours: { startTime: string; endTime: string } | null;
  onSubmit: (employeeId: string) => void;
  errorMessage?: string;
}

export function KioskIdleScreen({
  schoolName,
  workHours,
  onSubmit,
  errorMessage,
}: KioskIdleScreenProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [time, setTime] = useState(() => new Date());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!errorMessage) return;
    setDisplayError(errorMessage);
    const timer = setTimeout(() => setDisplayError(null), 5000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  useEffect(() => {
    inputRef.current?.focus();
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = employeeId.trim();
    if (!trimmed) return;
    setEmployeeId("");
    onSubmit(trimmed);
  };

  const formattedTime = time.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const formattedDate = time.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col items-center justify-center h-screen overflow-hidden w-full bg-gradient-to-br from-slate-50 to-blue-50 px-6">
      {/* School Name */}
      <div className="text-center mb-6">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 tracking-tight">
          {schoolName || "Staff Attendance Kiosk"}
        </h1>
        <p className="text-gray-500 mt-2 text-lg">{formattedDate}</p>
      </div>

      {/* Live Clock */}
      <div className="flex items-center gap-3 mb-1">
        <Clock className="h-8 w-8 text-blue-500" />
        <span className="text-5xl font-mono font-semibold text-gray-800 tabular-nums">
          {formattedTime}
        </span>
      </div>

      {/* Shift Hours */}
      {workHours && (
        <p className="text-gray-500 text-lg mb-6">
          Shift: {workHours.startTime} – {workHours.endTime}
        </p>
      )}

      {/* ID Entry */}
      <div className="w-full max-w-md space-y-3 mt-6">
        <p className="text-center text-gray-600 font-medium text-lg">
          Enter your Employee ID to sign in or out
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
            placeholder="e.g. EMP0042"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full text-center text-2xl font-mono tracking-widest text-gray-900 border-2 border-gray-300 rounded-xl px-4 py-4 focus:outline-none focus:border-blue-500 bg-white shadow-sm"
          />
          <button
            type="submit"
            disabled={!employeeId.trim()}
            className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed text-white rounded-xl transition-colors shadow"
          >
            Continue
          </button>
        </form>

        {displayError && (
          <div className="text-center text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm font-medium">
            {displayError}
          </div>
        )}
      </div>
    </div>
  );
}
