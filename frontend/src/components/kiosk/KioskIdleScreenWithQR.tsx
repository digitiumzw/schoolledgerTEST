import { useEffect, useRef, useState } from "react";
import { Clock, QrCode, Keyboard } from "lucide-react";
import { QRScanner } from "./QRScanner";
import { KioskIdleScreenProps } from "./KioskIdleScreen";

type InputMode = "manual" | "qr";

export function KioskIdleScreenWithQR({
  schoolName,
  workHours,
  onSubmit,
  errorMessage,
}: KioskIdleScreenProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [time, setTime] = useState(() => new Date());
  const [inputMode, setInputMode] = useState<InputMode>("manual");
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
    if (inputMode === "manual") inputRef.current?.focus();
  }, [inputMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = employeeId.trim();
    if (!trimmed) return;
    setEmployeeId("");
    onSubmit(trimmed);
  };

  // QR scan yields the employee ID — same flow as manual entry
  const handleQRScanSuccess = (scannedId: string) => {
    onSubmit(scannedId);
  };

  const handleQRScanError = (error: string) => {
    setDisplayError(error);
    setTimeout(() => setDisplayError(null), 5000);
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
    // h-screen + overflow-hidden keeps the kiosk non-scrollable
    <div className="flex flex-col items-center justify-center h-screen overflow-hidden w-full bg-gradient-to-br from-slate-50 to-blue-50 px-6">
      {/* School Name + Date */}
      <div className="text-center mb-4">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 tracking-tight">
          {schoolName || "Staff Attendance Kiosk"}
        </h1>
        <p className="text-gray-500 mt-1 text-lg">{formattedDate}</p>
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
        <p className="text-gray-500 text-lg mb-4">
          Shift: {workHours.startTime} – {workHours.endTime}
        </p>
      )}

      {/* Mode Toggle */}
      <div className="w-full max-w-md mt-4 mb-3">
        <div className="flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setInputMode("manual")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-all ${
              inputMode === "manual"
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Keyboard className="w-4 h-4" />
            Manual Entry
          </button>
          <button
            type="button"
            onClick={() => setInputMode("qr")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-all ${
              inputMode === "qr"
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <QrCode className="w-4 h-4" />
            QR Scan
          </button>
        </div>
      </div>

      {/* Hint text */}
      <p className="text-sm text-gray-500 mb-4">
        {inputMode === "manual"
          ? "Enter your Employee ID below"
          : "Point your QR code at the camera"}
      </p>

      {/* Manual entry */}
      {inputMode === "manual" ? (
        <div className="w-full max-w-md space-y-3">
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
              className="w-full h-16 px-4 text-2xl text-center font-mono text-gray-900 bg-white border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
            />
            <button
              type="submit"
              disabled={!employeeId.trim()}
              className="w-full h-14 text-lg font-semibold rounded-xl transition-colors shadow bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
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
      ) : (
        /* QR Scanner — constrained to fit viewport */
        <div className="w-full max-w-md space-y-3">
          <QRScanner
            onScanSuccess={handleQRScanSuccess}
            onScanError={handleQRScanError}
            className="shadow-md rounded-xl overflow-hidden"
          />

          {displayError && (
            <div className="text-center text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm font-medium">
              {displayError}
            </div>
          )}
        </div>
      )}

      {/* Footer — only shown in manual mode; QR mode already has instructions in the scanner */}
      {inputMode === "manual" && (
        <p className="absolute bottom-4 text-gray-400 text-sm">
          Type your Employee ID and press Enter
        </p>
      )}
    </div>
  );
}
