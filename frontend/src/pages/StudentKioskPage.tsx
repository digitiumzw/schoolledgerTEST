import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertTriangle, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  studentKioskApi,
  StudentKioskClass,
  StudentKioskStudent,
} from "@/api/api";
import { StudentKioskIdEntry } from "@/components/kiosk/StudentKioskIdEntry";
import { StudentKioskClassList } from "@/components/kiosk/StudentKioskClassList";
import { StudentKioskAttendance } from "@/components/kiosk/StudentKioskAttendance";
import { StudentKioskConfirmation } from "@/components/kiosk/StudentKioskConfirmation";

type KioskView = "loading" | "idle" | "classSelection" | "attendance" | "processing" | "confirmation" | "error";

interface ConfirmationData {
  classId: string;
  className: string;
  totalStudents: number;
  date: string;
}

export default function StudentKioskPage() {
  const { code } = useParams<{ code: string }>();

  const [view, setView] = useState<KioskView>("loading");
  const [schoolName, setSchoolName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [idError, setIdError] = useState("");

  // Teacher state
  const [employeeId, setEmployeeId] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [classes, setClasses] = useState<StudentKioskClass[]>([]);

  // Class / student state
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedClassName, setSelectedClassName] = useState("");
  const [students, setStudents] = useState<StudentKioskStudent[]>([]);
  const [todayDate, setTodayDate] = useState("");

  // Confirmation state
  const [confirmationData, setConfirmationData] = useState<ConfirmationData | null>(null);

  // ── Initial status check ──────────────────────────────────────────────────
  useEffect(() => {
    if (!code) {
      setErrorMessage("No kiosk code provided in URL.");
      setView("error");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await studentKioskApi.getStatus(code);
        if (cancelled) return;
        if (!data.kioskEnabled) {
          setErrorMessage("Student attendance kiosk is not enabled for this school.");
          setView("error");
          return;
        }
        setSchoolName(data.schoolName);
        setTodayDate(data.date);
        setView("idle");
      } catch (err: any) {
        if (cancelled) return;
        setErrorMessage(err?.message || "Unable to connect to kiosk. Please check the URL.");
        setView("error");
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleIdSubmit = useCallback(async (id: string) => {
    if (!code) return;
    setIdError("");
    try {
      const data = await studentKioskApi.validateTeacher(code, id);
      setEmployeeId(id);
      setTeacherName(data.teacherName);
      setClasses(data.classes);
      setView("classSelection");
    } catch (err: any) {
      setIdError(err?.message || "Employee ID not recognized");
    }
  }, [code]);

  const handleClassSelect = useCallback(async (classId: string) => {
    if (!code) return;
    try {
      const data = await studentKioskApi.getClassStudents(code, employeeId, classId);
      setSelectedClassId(classId);
      setSelectedClassName(data.className);
      setStudents(data.students);
      setTodayDate(data.date);
      setView("attendance");
    } catch (err: any) {
      setIdError(err?.message || "Unable to load students");
      setView("idle");
    }
  }, [code, employeeId]);

  const handleAttendanceSubmit = useCallback(async (
    records: Array<{ studentId: string; status: "present" | "absent" | "late" | "excused" | "half_day"; remarks?: string }>
  ) => {
    if (!code) return;
    setView("processing");
    try {
      const result = await studentKioskApi.submitAttendance({
        kiosk_code: code,
        employee_id: employeeId,
        class_id: selectedClassId,
        date: todayDate,
        records,
      });
      setConfirmationData({
        classId: result.classId,
        className: result.className,
        totalStudents: result.saved,
        date: result.date,
      });
      setView("confirmation");
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save attendance. Please try again.");
      setView("error");
    }
  }, [code, employeeId, selectedClassId, todayDate]);

  const handleConfirmationDone = useCallback(() => {
    // Reset all state back to idle
    setEmployeeId("");
    setTeacherName("");
    setClasses([]);
    setSelectedClassId("");
    setSelectedClassName("");
    setStudents([]);
    setConfirmationData(null);
    setIdError("");
    setView("idle");
  }, []);

  const handleClassListBack = useCallback(() => {
    setEmployeeId("");
    setTeacherName("");
    setClasses([]);
    setIdError("");
    setView("idle");
  }, []);

  const handleAttendanceBack = useCallback(() => {
    setSelectedClassId("");
    setSelectedClassName("");
    setStudents([]);
    setView("classSelection");
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (view === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
        <p className="text-gray-500 text-lg">Loading kiosk…</p>
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-md mx-auto flex flex-col items-center space-y-6">
          <div className="flex items-center justify-center h-20 w-20 rounded-full bg-red-100">
            {errorMessage.toLowerCase().includes("network") || errorMessage.toLowerCase().includes("connect") ? (
              <WifiOff className="h-10 w-10 text-red-500" />
            ) : (
              <AlertTriangle className="h-10 w-10 text-red-500" />
            )}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-800">Kiosk Unavailable</h2>
            <p className="text-gray-600 max-w-sm">{errorMessage}</p>
          </div>
          <Button
            size="lg"
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (view === "idle") {
    return (
      <StudentKioskIdEntry
        schoolName={schoolName}
        onSubmit={handleIdSubmit}
        errorMessage={idError}
      />
    );
  }

  if (view === "classSelection") {
    return (
      <StudentKioskClassList
        teacherName={teacherName}
        classes={classes}
        onSelectClass={handleClassSelect}
        onBack={handleClassListBack}
      />
    );
  }

  if (view === "attendance") {
    return (
      <StudentKioskAttendance
        className={selectedClassName}
        date={todayDate}
        students={students}
        onSubmit={handleAttendanceSubmit}
        onBack={handleAttendanceBack}
      />
    );
  }

  if (view === "processing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
        <p className="text-gray-500 text-lg">Saving attendance…</p>
      </div>
    );
  }

  if (view === "confirmation" && confirmationData) {
    return (
      <StudentKioskConfirmation
        className={confirmationData.className}
        totalStudents={confirmationData.totalStudents}
        date={confirmationData.date}
        onDone={handleConfirmationDone}
      />
    );
  }

  return null;
}
