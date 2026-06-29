import { useEffect, useState } from "react";
import { CheckCircle2, LogIn, LogOut, AlertTriangle } from "lucide-react";
import { KioskActionResult } from "@/api/api";

interface KioskConfirmationProps {
  result: KioskActionResult;
  onDone: () => void;
}

const AUTO_RESET_SECONDS = 10;

export function KioskConfirmation({ result, onDone }: KioskConfirmationProps) {
  const [countdown, setCountdown] = useState(AUTO_RESET_SECONDS);

  useEffect(() => {
    if (countdown <= 0) {
      onDone();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onDone]);

  const isCheckIn = result.action === "check_in";
  const ActionIcon = isCheckIn ? LogIn : LogOut;

  const isAlreadyCompleted = result.action === "already_completed";

  const statusLabel = () => {
    // Handle already completed action
    if (isAlreadyCompleted) {
      return "Already Completed";
    }
    switch (result.attendanceStatus) {
      case "late":            return "Late";
      case "early_departure": return "Early Departure";
      case "half_day":        return "Half Day";
      case "on_leave":        return "On Leave";
      case "present":         return isCheckIn ? "Present — On Time" : "Checked Out";
      default:                return isCheckIn ? "Signed In" : "Signed Out";
    }
  };

  const statusColor = () => {
    if (isAlreadyCompleted) {
      return "text-blue-700 bg-blue-50 border-blue-200";
    }
    switch (result.attendanceStatus) {
      case "late":            return "text-yellow-700 bg-yellow-50 border-yellow-200";
      case "early_departure": return "text-orange-700 bg-orange-50 border-orange-200";
      case "half_day":        return "text-amber-700 bg-amber-50 border-amber-200";
      default:                return "text-green-700 bg-green-50 border-green-200";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50 px-6">
      <div className="w-full max-w-lg mx-auto flex flex-col items-center text-center space-y-6">
        {/* Icon */}
        <div className="flex items-center justify-center h-24 w-24 rounded-full bg-green-100">
          <CheckCircle2 className="h-14 w-14 text-green-600" />
        </div>

        {/* Staff name + action */}
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-gray-800">{result.staffName}</h2>
          <div className="flex items-center justify-center gap-2 text-xl text-gray-600">
            <ActionIcon className="h-5 w-5" />
            <span>{isCheckIn ? "Signed In" : "Signed Out"}</span>
          </div>
        </div>

        {/* Time card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-8 py-5 space-y-2 w-full">
          <p className="text-sm text-gray-500">Recorded at</p>
          <p className="text-3xl font-semibold text-gray-800 tabular-nums">{result.timestamp}</p>
          <p className="text-sm text-gray-400">{result.date}</p>

          {/* Work hours on checkout */}
          {result.workHours !== undefined && (
            <div className="pt-1 space-y-1">
              <p className="text-sm text-gray-600">
                Hours worked:{" "}
                <span className="font-semibold">{result.workHours.toFixed(1)}h</span>
              </p>
              {result.overtimeHours !== undefined && result.overtimeHours > 0 && (
                <p className="text-sm text-emerald-600">
                  Overtime:{" "}
                  <span className="font-semibold">+{result.overtimeHours.toFixed(1)}h</span>
                </p>
              )}
            </div>
          )}

          {/* Status badge */}
          <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-sm font-medium border ${statusColor()}`}>
            {(result.attendanceStatus === "early_departure" || result.attendanceStatus === "half_day") && (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {statusLabel()}
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
