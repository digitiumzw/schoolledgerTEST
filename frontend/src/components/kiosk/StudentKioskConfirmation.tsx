import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface StudentKioskConfirmationProps {
  className: string;
  totalStudents: number;
  date: string;
  onDone: () => void;
}

const AUTO_RESET_SECONDS = 10;

export function StudentKioskConfirmation({
  className,
  totalStudents,
  date,
  onDone,
}: StudentKioskConfirmationProps) {
  const [countdown, setCountdown] = useState(AUTO_RESET_SECONDS);

  useEffect(() => {
    if (countdown <= 0) {
      onDone();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onDone]);

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col items-center justify-center h-screen overflow-hidden w-full bg-gradient-to-br from-slate-50 to-emerald-50 px-6">
      <div className="w-full max-w-lg mx-auto flex flex-col items-center text-center space-y-6">
        {/* Icon */}
        <div className="flex items-center justify-center h-24 w-24 rounded-full bg-emerald-100">
          <CheckCircle2 className="h-14 w-14 text-emerald-600" />
        </div>

        {/* Heading */}
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-gray-800">Attendance Submitted</h2>
          <p className="text-gray-500 text-lg">Records saved successfully</p>
        </div>

        {/* Details card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-8 py-5 space-y-3 w-full">
          <div>
            <p className="text-sm text-gray-500">Class</p>
            <p className="text-2xl font-semibold text-gray-800">{className}</p>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-gray-100">
            <div>
              <p className="text-sm text-gray-500">Students recorded</p>
              <p className="text-xl font-semibold text-gray-800">{totalStudents}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Date</p>
              <p className="text-base text-gray-700">{formattedDate}</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full text-sm font-medium border text-emerald-700 bg-emerald-50 border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Saved
          </div>
        </div>

        {/* Countdown + Done */}
        <div className="space-y-3 w-full">
          <button
            onClick={onDone}
            className="w-full h-14 text-base font-medium border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition-colors text-gray-700"
          >
            Done
          </button>
          <p className="text-sm text-gray-400">
            Returning to kiosk in {countdown}s…
          </p>
        </div>
      </div>
    </div>
  );
}
