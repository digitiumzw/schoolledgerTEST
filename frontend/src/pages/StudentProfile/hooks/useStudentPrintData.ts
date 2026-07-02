import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/api/api';
import { calculateAge } from '@/lib/studentUtils';
import type {
  Student,
  AttendanceSummary,
  TransportAllocation,
  TransportRoute,
  Enrollment,
  StudentTimelineResponse,
} from '@/types/dashboard';
import type {
  StudentPrintData,
  PrintFinance,
} from '../types/print-data';

interface LocalFeeStatement {
  summary: {
    totalCharged: number;
    totalPaid: number;
    creditAdjustments: number;
    debitAdjustments: number;
    balance: number;
    feeBalance: number;
    transportBalance: number;
  };
}

interface UseStudentPrintDataOptions {
  studentId: string;
  student: Student | null;
  feeStatement: LocalFeeStatement | null;
  timeline: StudentTimelineResponse | null;
  attendanceSummary: AttendanceSummary | null;
  transportAssignment: TransportAllocation | null;
  transportRoute: TransportRoute | null;
  currentEnrollment: Enrollment | null;
  className: string | null;
  teacherName: string | null;
  classStudentCount: number;
  balanceData: {
    balance: number;
    feeBalance?: number;
    transportBalance?: number;
  } | null;
}

interface UseStudentPrintDataResult {
  isPreparing: boolean;
  isReady: boolean;
  handlePrint: () => void;
  printData: StudentPrintData | null;
}

function assemblePrintData(
  opts: Omit<UseStudentPrintDataOptions, 'studentId'> & {
    feeStatement: LocalFeeStatement;
    timeline: StudentTimelineResponse;
    schoolName: string;
  }
): StudentPrintData {
  const {
    student,
    feeStatement,
    timeline,
    attendanceSummary,
    transportAssignment,
    transportRoute,
    currentEnrollment,
    className,
    teacherName,
    classStudentCount,
    schoolName,
  } = opts;

  if (!student) throw new Error('Student data is required');

  const finance: PrintFinance = {
    totalCharged: feeStatement.summary.totalCharged,
    totalPaid: feeStatement.summary.totalPaid,
    creditAdjustments: feeStatement.summary.creditAdjustments,
    debitAdjustments: feeStatement.summary.debitAdjustments,
    feeBalance: feeStatement.summary.feeBalance,
    transportBalance: feeStatement.summary.transportBalance,
    overallBalance: feeStatement.summary.balance,
  };

  const presentCount = attendanceSummary?.present ?? 0;
  const absentCount = attendanceSummary?.absent ?? 0;
  const lateCount = attendanceSummary?.late ?? 0;
  const excusedCount = attendanceSummary?.excused ?? 0;
  const totalCount = attendanceSummary?.total ?? 0;
  const attendanceRate = totalCount > 0
    ? Math.round(((presentCount + lateCount + excusedCount) / totalCount) * 100)
    : 0;

  return {
    meta: {
      schoolName,
      printedAt: new Date().toISOString(),
    },
    identity: {
      fullName: `${student.firstName} ${student.lastName}`,
      status: student.status,
      admissionNumber: student.admissionNumber,
      dateOfBirth: student.dateOfBirth ?? null,
      age: student.dateOfBirth ? calculateAge(student.dateOfBirth) : null,
      gender: (student as unknown as { gender?: string }).gender ?? null,
      nationalId: student.nationalId ?? null,
      enrollmentDate: student.enrollmentDate ?? null,
      bursaryStatus: student.bursaryStatus ?? null,
    },
    contact: {
      email: student.email ?? null,
      address: student.address ?? null,
      guardian1: student.guardian
        ? {
            name: student.guardian.name,
            relationship: student.guardian.relationship ?? null,
            phone: student.guardian.phone ?? null,
            email: student.guardian.email ?? null,
          }
        : null,
      guardian2: student.guardian2
        ? {
            name: student.guardian2.name,
            relationship: student.guardian2.relationship ?? null,
            phone: student.guardian2.phone ?? null,
            email: student.guardian2.email ?? null,
          }
        : null,
    },
    academic: {
      className: className ?? null,
      teacherName: teacherName ?? null,
      classSize: classStudentCount > 0 ? classStudentCount : null,
      academicSession: currentEnrollment?.academicSession ?? null,
    },
    finance,
    attendance: {
      attendanceRate,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
    },
    transport: {
      hasAssignment: transportAssignment !== null,
      routeName: transportRoute?.routeName ?? transportAssignment?.routeName ?? null,
      stopName: transportAssignment?.stopName ?? null,
      direction: transportAssignment?.direction ?? null,
    },
    timeline: {
      events: timeline.events.slice(0, 20).map((e) => ({
        eventType: e.eventType,
        occurredAt: e.eventDate,
        title: e.title,
        summary: e.summary ? (e.summary.length > 200 ? e.summary.slice(0, 200) + '…' : e.summary) : null,
      })),
    },
  };
}

export function useStudentPrintData(
  opts: UseStudentPrintDataOptions
): UseStudentPrintDataResult {
  const {
    studentId,
    student,
    feeStatement,
    timeline,
    attendanceSummary,
    transportAssignment,
    transportRoute,
    currentEnrollment,
    className,
    teacherName,
    classStudentCount,
    balanceData,
  } = opts;

  const [isPreparing, setIsPreparing] = useState(false);
  const [printData, setPrintData] = useState<StudentPrintData | null>(null);

  const isReady = printData !== null && !isPreparing;

  const handlePrint = useCallback(async () => {
    if (!student) return;
    setIsPreparing(true);
    try {
      const [feeData, timelineData, tenantInfo] = await Promise.all([
        feeStatement
          ? Promise.resolve(feeStatement)
          : api.getFeeStatement(studentId),
        timeline
          ? Promise.resolve(timeline)
          : api.getStudentTimeline(studentId, { limit: 20 }),
        api.getCurrentTenant(),
      ]);

      const schoolName: string =
        (tenantInfo as { schoolName?: string; name?: string })?.schoolName ??
        (tenantInfo as { schoolName?: string; name?: string })?.name ??
        'School';

      const assembled = assemblePrintData({
        student,
        feeStatement: feeData as LocalFeeStatement,
        timeline: timelineData as StudentTimelineResponse,
        attendanceSummary,
        transportAssignment,
        transportRoute,
        currentEnrollment,
        className,
        teacherName,
        classStudentCount,
        balanceData,
        schoolName,
      });

      setPrintData(assembled);

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );

      window.print();
    } catch (err) {
      console.error('[useStudentPrintData] Print preparation failed:', err);
      toast.error('Could not prepare print data. Please try again.');
    } finally {
      setIsPreparing(false);
    }
  }, [
    student,
    studentId,
    feeStatement,
    timeline,
    attendanceSummary,
    transportAssignment,
    transportRoute,
    currentEnrollment,
    className,
    teacherName,
    classStudentCount,
    balanceData,
  ]);

  return { isPreparing, isReady, handlePrint, printData };
}
