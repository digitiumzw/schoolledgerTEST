import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

interface StudentKioskIdEntryProps {
  schoolName: string;
  onSubmit: (employeeId: string) => void;
  errorMessage?: string;
}

export function StudentKioskIdEntry({
  schoolName,
  onSubmit,
  errorMessage,
}: StudentKioskIdEntryProps) {
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
    const trimmed = employeeId.trim().toUpperCase();
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
    <div className="flex flex-col items-center justify-center h-screen overflow-hidden w-full bg-gradient-to-br from-slate-50 to-emerald-50 px-6">
      {/* School Name + Date */}
      <div className="text-center mb-4">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 tracking-tight">
          {schoolName || "Student Attendance Kiosk"}
        </h1>
        <p className="text-gray-500 mt-1 text-lg">{formattedDate}</p>
      </div>

      {/* Live Clock */}
      <div className="flex items-center gap-3 mb-1">
        <Clock className="h-8 w-8 text-emerald-500" />
        <span className="text-5xl font-mono font-semibold text-gray-800 tabular-nums">
          {formattedTime}
        </span>
      </div>

      {/* Subtitle */}
      <p className="text-emerald-600 text-lg font-semibold mb-6">
        Student Attendance Kiosk
      </p>

      {/* ID Entry */}
      <div className="w-full max-w-md space-y-3">
        <p className="text-center text-gray-600 font-medium text-lg">
          Enter your Employee ID to mark attendance
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
            className="w-full h-16 px-4 text-2xl text-center font-mono text-gray-900 bg-white border-2 border-gray-300 rounded-xl focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-all tracking-widest"
          />
          <button
            type="submit"
            disabled={!employeeId.trim()}
            className="w-full h-14 text-lg font-semibold rounded-xl transition-colors shadow bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
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

      <p className="absolute bottom-4 text-gray-400 text-sm">
        Type your Employee ID and press Enter
      </p>
    </div>
  );
}
