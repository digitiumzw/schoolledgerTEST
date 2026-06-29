import { ArrowLeft, CheckCircle2, ChevronRight, Users, Info } from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
  studentCount: number;
  attendanceRecorded: boolean;
}

interface StudentKioskClassListProps {
  teacherName: string;
  classes: ClassItem[];
  onSelectClass: (classId: string) => void;
  onBack: () => void;
}

export function StudentKioskClassList({
  teacherName,
  classes,
  onSelectClass,
  onBack,
}: StudentKioskClassListProps) {
  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-slate-50 to-emerald-50 px-6">
        <div className="w-full max-w-md mx-auto flex flex-col items-center text-center space-y-6">
          <div className="flex items-center justify-center h-20 w-20 rounded-full bg-gray-100">
            <Info className="h-10 w-10 text-gray-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-800">
              Welcome, {teacherName}
            </h2>
            <p className="text-gray-500 text-lg">
              No classes assigned to you. Please contact your administrator.
            </p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 h-12 px-6 text-base font-medium border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition-colors text-gray-700"
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
      {/* Sticky header — mirrors KioskAttendance header style */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Select a Class</h2>
            <p className="text-sm text-gray-500">Welcome, {teacherName}</p>
          </div>
        </div>
      </div>

      {/* Class Cards */}
      <div className="flex-1 px-6 py-6">
        <div className="w-full max-w-lg mx-auto space-y-3">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => onSelectClass(cls.id)}
              className="w-full flex items-center gap-4 bg-white border border-gray-200 hover:border-emerald-400 rounded-xl px-5 py-5 transition-colors shadow-sm text-left group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xl font-semibold text-gray-800 group-hover:text-emerald-700 transition-colors">
                  {cls.name}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-gray-500 text-base">
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {cls.studentCount} {cls.studentCount === 1 ? "student" : "students"}
                  </span>
                </div>
              </div>
              {cls.attendanceRecorded ? (
                <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 text-xs font-medium shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Done
                </div>
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400 shrink-0 group-hover:text-emerald-500 transition-colors" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
