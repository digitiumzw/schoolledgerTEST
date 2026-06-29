import { useState } from "react";
import { ArrowLeft, Info } from "lucide-react";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "half_day";

interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  currentStatus: AttendanceStatus | null;
  remarks?: string;
}

interface StudentKioskAttendanceProps {
  className: string;
  date: string;
  students: StudentItem[];
  onSubmit: (records: Array<{ studentId: string; status: AttendanceStatus; remarks?: string }>) => void;
  onBack: () => void;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string; activeColor: string }[] = [
  { value: "present",  label: "Present",   color: "text-gray-500 border-gray-200 bg-white", activeColor: "text-white bg-emerald-600 border-emerald-600" },
  { value: "absent",   label: "Absent",    color: "text-gray-500 border-gray-200 bg-white", activeColor: "text-white bg-red-600 border-red-600" },
  { value: "late",     label: "Late",      color: "text-gray-500 border-gray-200 bg-white", activeColor: "text-white bg-yellow-600 border-yellow-600" },
  { value: "excused",  label: "Excused",   color: "text-gray-500 border-gray-200 bg-white", activeColor: "text-white bg-blue-600 border-blue-600" },
  { value: "half_day", label: "Half Day",  color: "text-gray-500 border-gray-200 bg-white", activeColor: "text-white bg-amber-600 border-amber-600" },
];

export function StudentKioskAttendance({
  className,
  date,
  students,
  onSubmit,
  onBack,
}: StudentKioskAttendanceProps) {
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() => {
    const initial: Record<string, AttendanceStatus> = {};
    for (const student of students) {
      initial[student.id] = student.currentStatus ?? "present";
    }
    return initial;
  });

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSubmit = () => {
    const records = students.map((s) => ({
      studentId: s.id,
      status: statuses[s.id] ?? "present",
      remarks: s.remarks,
    }));
    onSubmit(records);
  };

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-slate-50 to-emerald-50 px-6">
        <div className="w-full max-w-md mx-auto flex flex-col items-center text-center space-y-6">
          <div className="flex items-center justify-center h-20 w-20 rounded-full bg-gray-100">
            <Info className="h-10 w-10 text-gray-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-800">{className}</h2>
            <p className="text-gray-500 text-lg">
              No enrolled students found for this class. Please contact your administrator.
            </p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 h-14 px-6 text-base font-medium border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen w-full bg-gradient-to-br from-slate-50 to-emerald-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{className}</h2>
              <p className="text-sm text-gray-500">{formattedDate}</p>
            </div>
          </div>
          <span className="text-sm font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1">
            {students.length} {students.length === 1 ? "student" : "students"}
          </span>
        </div>
      </div>

      {/* Student List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-2">
          {students.map((student, index) => (
            <div
              key={student.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-4 gap-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 font-mono w-6 text-right shrink-0">
                  {index + 1}
                </span>
                <span className="text-lg font-semibold text-gray-800">
                  {student.lastName}, {student.firstName}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 ml-9 sm:ml-0">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(student.id, opt.value)}
                    className={`min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl border transition-colors ${
                      statuses[student.id] === opt.value ? opt.activeColor : opt.color
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed Submit Bar */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 h-12 px-5 text-base font-medium border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition-colors text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 max-w-xs h-14 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow"
          >
            Submit ({students.length} students)
          </button>
        </div>
      </div>
    </div>
  );
}
