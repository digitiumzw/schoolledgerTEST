export interface StudentPrintData {
  meta: PrintMeta;
  identity: PrintIdentity;
  contact: PrintContact;
  academic: PrintAcademic;
  finance: PrintFinance;
  attendance: PrintAttendance;
  transport: PrintTransport;
  timeline: PrintTimeline;
}

export interface PrintMeta {
  schoolName: string;
  printedAt: string;
}

export interface PrintIdentity {
  fullName: string;
  status: string;
  admissionNumber: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  nationalId: string | null;
  enrollmentDate: string | null;
  bursaryStatus: string | null;
}

export interface PrintContact {
  email: string | null;
  address: string | null;
  guardian1: PrintGuardian | null;
  guardian2: PrintGuardian | null;
}

export interface PrintGuardian {
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
}

export interface PrintAcademic {
  className: string | null;
  teacherName: string | null;
  classSize: number | null;
  academicSession: string | null;
}

export interface PrintFinance {
  totalCharged: number;
  totalPaid: number;
  creditAdjustments: number;
  debitAdjustments: number;
  feeBalance: number;
  transportBalance: number;
  overallBalance: number;
}

export interface PrintAttendance {
  attendanceRate: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
}

export interface PrintTransport {
  hasAssignment: boolean;
  routeName: string | null;
  stopName: string | null;
  direction: string | null;
}

export interface PrintTimeline {
  events: PrintTimelineEvent[];
}

export interface PrintTimelineEvent {
  eventType: string;
  occurredAt: string;
  title: string;
  summary: string | null;
}
