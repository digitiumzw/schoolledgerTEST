/**
 * ================================================================================
 * dashboard.ts - Master Type Definitions for School Management System
 * ================================================================================
 * 
 * PURPOSE:
 * This is the central type definition file for the entire school management
 * application. It defines TypeScript interfaces for ALL major entities like
 * students, staff, classes, payments, attendance, transport, and settings.
 * 
 * WHY THIS EXISTS:
 * TypeScript needs to know the "shape" of our data. By defining interfaces here,
 * we ensure that:
 * 1. Data is consistent across the entire app
 * 2. IDE auto-complete works correctly
 * 3. Bugs are caught at compile-time, not runtime
 * 4. Developers know exactly what fields are available
 * 
 * WHAT IS AN INTERFACE:
 * Think of an interface as a "contract" or "blueprint". If a variable is typed
 * as `Student`, it MUST have all the fields defined in the Student interface.
 * TypeScript will prevent you from forgetting fields or misspelling them.
 * 
 * MAIN SECTIONS:
 * 1. Financial Types (Charge, Payment, DashboardStats)
 * 2. Core Entities (Student, Class, Staff, Guardian)
 * 3. Attendance (Student & Staff attendance records)
 * 4. Leave Management (Staff leave requests and balances)
 * 5. Transport Management (Routes and assignments)
 * 6. Settings & Configuration (School settings, fees, calendar, users)
 * 7. Ledger Accounting (Student financial ledger)
 * 
 * RELATED FILES:
 * - API: src/api/api.ts uses these types for all CRUD operations
 * - Components: All pages and components import types from this file
 * 
 * FOR BEGINNERS:
 * This file doesn't contain any logic or code - just type definitions.
 * Think of it as a reference manual that defines "what is a student?" or
 * "what is a payment?" so everyone in the codebase uses the same structure.
 * ================================================================================
 */


export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface ImportValidationResult {
  valid: boolean;
  totalRows: number;
  errorCount: number;
  errors: ImportRowError[];
}

export interface ImportExecuteResult {
  imported: number;
  skipped: number;
}

// ==================== FINANCIAL TYPES ====================
// Purpose: Track tuition, levies, and payments

/**
 * Charge - A fee levied against a student's account
 * 
 * WHAT IT DOES:
 * Represents a tuition charge, levy, or fee added to a student's account.
 * Charges are generated per term and must be paid off by payments.
 * 
 * HOW IT WORKS:
 * At the start of each term, charges are created for all students based on
 * their class fee structure. Student balance = Total Charges - Total Payments.
 * 
 * EXAMPLE:
 * {
 *   id: "ch_12345",
 *   tenantId: "t1",
 *   studentId: "s789",
 *   termId: "term_1_2025",
 *   category: "Tuition",
 *   amount: 500,
 *   dateGenerated: "2025-01-15",
 *   academicYear: "2025",
 *   description: "Term 1 Tuition Fee"
 * }
 */
export type ChargeType = 'fee_structure' | 'transport' | 'other';
export type ChargeStatus = 'pending' | 'partial' | 'paid' | 'waived' | 'cancelled';

export interface Charge {
  id: string;                             // Unique charge ID (e.g., "ch_12345")
  tenantId: string;                       // School ID (for multi-tenancy)
  studentId: string;                      // Which student this charge is for
  termId: string | null;                  // Which term (or null for annual fees)
  category: string;                       // Fee category/name (e.g., "Tuition", "Sports", "Books")
  chargeType: ChargeType;                 // Type of charge: fee_structure, transport, or other
  status: ChargeStatus;                   // Charge payment status
  amount: number;                         // Charge amount in USD
  dateGenerated: string;                  // Date charge was created (ISO format: YYYY-MM-DD)
  dueDate?: string | null;                // Payment due date (ISO format: YYYY-MM-DD)
  academicSession?: string;               // Academic session (e.g., "2024/2025")
  academicYear?: string;                  // Academic year (e.g., "2025") - legacy field
  term?: string;                          // Term name for reference
  description?: string;                   // Optional notes (e.g., "Balance Brought Forward")
  generationBatchId?: string;             // Batch ID linking charges from same generation event
  createdBy?: string;                     // Admin user ID who triggered charge generation
  routeId?: string | null;                // Transport route ID (for transport charges)
  deletedAt?: string;                     // ISO date when charge was reversed/deleted (soft delete)
  deletionReason?: string;                // Reason for deletion/reversal (e.g., "Undo generation", "Correction")
  currencyCode?: string | null;           // Transaction currency code; null = base currency (feature 094)
  originalAmount?: number | null;         // Amount in currencyCode; null when currencyCode is null (feature 094)
  exchangeRate?: number | null;           // Rate applied at creation (immutable); null/1.0 for base currency (feature 094)
  rateManualOverride?: boolean;           // true = user manually overrode the auto-applied rate (feature 094)
}

/**
 * Payment - A payment made by a student/guardian
 * 
 * WHAT IT DOES:
 * Represents a payment received from a student or guardian. Payments reduce
 * the student's outstanding balance and grant access to services (like transport).
 * 
 * HOW IT WORKS:
 * When recording a payment, it's linked to:
 * - A specific student
 * - A payment category (Tuition, Transport Fee, etc.)
 * - Either a term (for tuition) OR a month (for transport)
 * 
 * PAYMENT CATEGORIES:
 * - Tuition: Regular school fees (linked to termId)
 * - Transport Fee: Monthly transport access (linked to month + routeId)
 * - Development: School infrastructure fees
 * - Sports: Sports equipment/activities
 * - Other: Miscellaneous payments
 * 
 * EXAMPLE:
 * {
 *   id: "p_67890",
 *   studentId: "s789",
 *   tenantId: "t1",
 *   amount: 250,
 *   date: "2025-01-20",
 *   method: "Cash",
 *   description: "Partial tuition payment",
 *   category: "Tuition",
 *   termId: "term_1_2025",
 *   month: null,
 *   routeId: null
 * }
 */
export interface Payment {
  id: string;                             // Unique payment ID (e.g., "p_67890")
  studentId: string;                      // Which student made this payment
  tenantId: string;                       // School ID (for multi-tenancy)
  amount: number;                         // Payment amount in USD
  date: string;                           // Payment date (ISO format: YYYY-MM-DD)
  method: string;                         // Payment method (e.g., "Cash", "EcoCash", "Bank Transfer")
  description: string;                    // Payment description/notes
  category: string;                       // Free-form category name (incl. system: "Fees", "Transport", "Transport + Fees")
  termId?: string | null;                 // Term ID for tuition payments (null for transport)
  month?: string | null;                  // Month for transport payments (YYYY-MM format, null for tuition)
  routeId?: string | null;                // Route ID for transport payments (null for tuition)
  balanceAfterPayment?: number | null;    // Student ledger balance immediately after this payment
  feeBalanceAfterPayment?: number | null; // Fee-only balance after this payment (for receipt display)
  transportBalanceAfterPayment?: number | null; // Transport-only balance after this payment (for receipt display)
  receiptNumber?: string | null;          // YYYY.MM.DD.HHmmss.X (feature 057); null for legacy payments
  snapshot?: PaymentSnapshot | null;      // Point-in-time student/class data snapshot (feature 057)
  isGeneralPayment?: boolean;             // true = user-defined category (non-ledger); false = system category (feature 061)
  paymentGroupId?: string | null;         // Groups rows from the same multi-category transaction (feature 061)
  categoryLines?: Array<{ category: string; amount: number }>; // Per-category breakdown for multi-category receipts (feature 061)
  feeCampaignId?: string | null;          // Campaign ID if this payment belongs to a fee campaign (feature 062)
  campaignName?: string;                  // Display name derived from category when feeCampaignId is set (feature 062)
  isVoided?: boolean;                     // true when payment has been voided (feature 085)
  voidedAt?: string | null;               // ISO datetime when payment was voided (feature 085)
  voidReason?: string | null;             // Reason recorded when voiding (feature 085)
  voidedBy?: string | null;               // User ID who performed the void (feature 085)
  currencyCode?: string | null;           // Transaction currency code; null = base currency (feature 094)
  originalAmount?: number | null;         // Amount in currencyCode; null when currencyCode is null (feature 094)
  exchangeRate?: number | null;           // Rate applied at creation (immutable); null/1.0 for base currency (feature 094)
  rateManualOverride?: boolean;           // true = user manually overrode the auto-applied rate (feature 094)
}

export interface PaymentPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaymentStudentDisplay {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string | null;
  classId: string | null;
  className: string | null;
  currentBalance?: number;
}

export interface PaymentHistoryRecord extends Payment {
  student?: PaymentStudentDisplay | null;
}

export interface PaymentSummaryBreakdown {
  label: string;
  count: number;
  total: number;
}

export interface PaymentSummary {
  totalAmount: number;
  totalCount: number;
  totalThisMonth: number;
  paymentsToday: number;
  totalOutstanding: number;
  byMethod: PaymentSummaryBreakdown[];
  byCategory: PaymentSummaryBreakdown[];
}

export interface PaymentResultPage {
  data: PaymentHistoryRecord[];
  pagination: PaymentPaginationMeta;
  summary: PaymentSummary;
}

/**
 * PaymentSnapshot - Immutable point-in-time capture of student/class data.
 *
 * Feature: 057-payment-billing-ux (research.md §D5)
 *
 * Stored alongside the payment so historical receipts remain accurate even
 * after later data changes (e.g. class rename). ReceiptController prefers
 * snapshot.className over the live JOIN when rendering the receipt.
 */
export interface PaymentSnapshot {
  studentName:   string;
  className:     string;
  balanceBefore: number;
  feeBalanceBefore?: number;       // Fee-only balance before this payment
  transportBalanceBefore?: number;   // Transport-only balance before this payment
  paymentMethod: string;
  paymentDate:   string;
  amount:        number;
  category:      string;
}

export type SetupGuideStepKey = 'add-staff' | 'add-classes' | 'add-students' | 'configure-billing';
export type SetupGuideStepStatus = 'pending' | 'active' | 'completed' | 'skipped';

export interface SetupGuideStep {
  key: SetupGuideStepKey;
  label: string;
  status: SetupGuideStepStatus;
  optional: boolean;
  route: string;
  description: string;
}

export interface SetupGuideResponse {
  current_step: SetupGuideStepKey | null;
  completed: boolean;
  dismissed: boolean;
  tenant_id?: string;
  steps: SetupGuideStep[];
}

export type TutorialStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

export interface TutorialModule {
  module_key: string;
  module_name: string;
  summary: string;
  contains: string[];
  primary_actions: string[];
  tips?: string[];
  route: string;
  order: number;
}

export interface TutorialResponse {
  status: TutorialStatus;
  should_show: boolean;
  last_seen_step: string | null;
  seen_module_keys?: string[];
  modules: TutorialModule[];
}

/**
 * Dashboard Statistics - Aggregated metrics for the admin dashboard
 * 
 * WHAT IT DOES:
 * Provides all the key metrics displayed on the main dashboard. These are
 * calculated dynamically from students, payments, classes, and staff data.
 * 
 * HOW IT'S CALCULATED:
 * The mockApi.getDashboardStats() method aggregates data from multiple
 * JSON files to compute these statistics in real-time.
 * 
 * SECTIONS:
 * 1. Student Financial Stats - Payment status and outstanding balances
 * 2. Financial Overview - Revenue and collection rates
 * 3. School Overview - Classes, staff, and transport usage
 * 4. Critical Alerts - Issues requiring attention
 */
export interface DashboardStats {
  // ===== STUDENT FINANCIAL STATS =====
  totalStudents: number;                  // Total enrolled students
  graduatedStudents?: number;
  paidInFull: number;                     // Students with zero balance (current term)
  withOutstanding: number;                // Students with any balance > 0 (current term)
  partialOrOverdue: number;               // Students with balance > $100 (overdue threshold)
  totalOutstanding: number;               // All-time sum of all student balances (USD)

  // ===== FINANCIAL OVERVIEW =====
  totalRevenueThisTerm: number;           // Total payments received this term (USD)
  collectionRate: number;                 // Current-term collection rate (0-100)
  studentsOnBursary: number;              // Students with full or partial scholarships
  totalBursarySavings: number;            // Total dollar amount of bursary discounts (USD)
  currentTermName: string | null;         // Name of the current academic term (null if between terms)

  // ===== SCHOOL OVERVIEW =====
  totalClasses: number;                   // Total number of classes
  activeEnrollment?: number;
  activeClasses?: number;
  averageClassSize: number;               // Average students per class
  avgClassSize?: number;
  totalStaff: number;                     // Total active staff members
  allActiveStaff?: number;
  teachingStaff: number;                  // Staff members who teach classes
  nonTeachingStaff?: number;
  teachingStaffWithClasses?: number;
  staffOnLeave: number;                   // Staff currently on leave (employment_status = on_leave)
  staffOnLeaveToday?: number;
  staffAttendanceRate: number;            // Today's staff attendance rate (0-100)
  activeTransportRoutes: number;          // Active transport routes
  studentsUsingTransport: number;         // Students with active transport access

  // ===== CRITICAL ALERTS =====
  lowAttendanceStudents: number;          // Students with <75% attendance
  highOverdueBalances: number;            // Students with balance > $100
  outstandingBalanceStudents?: number;
  pendingLeaveRequests: number;           // Staff leave requests awaiting approval
  overCapacityClasses: number;            // Classes exceeding their capacity limit
  overCapacityClassNames?: string[];
}

// ==================== CORE ENTITY TYPES ====================
// Purpose: Define students, guardians, classes, and staff

/**
 * Guardian - Student's parent or legal guardian
 * 
 * WHAT IT DOES:
 * Stores emergency contact information for a student. Each student has
 * one primary guardian (though this could be extended to multiple in future).
 * 
 * WHY THIS EXISTS:
 * Schools need to contact parents for emergencies, payment reminders,
 * attendance issues, etc. This data is nested inside each Student record.
 * 
 * EXAMPLE:
 * {
 *   name: "Mary Moyo",
 *   phone: "+263 77 123 4567",
 *   email: "mary.moyo@email.com",
 *   relationship: "Mother"
 * }
 */
export interface Guardian {
  name: string;                           // Guardian's full name
  phone: string;                          // Guardian's phone number (primary contact)
  email?: string;                         // Optional: Guardian's email address
  relationship: string;                   // Relationship to student (e.g., "Mother", "Father", "Uncle")
}

/**
 * Student - Core student record
 * 
 * WHAT IT DOES:
 * Represents a student enrolled in the school. This is one of the most
 * important entities in the system, containing personal info, enrollment
 * details, and financial information.
 * 
 * HOW IT WORKS:
 * - Each student belongs to one class (via classId)
 * - Each student has one guardian (emergency contact)
 * - Balance is dynamically calculated (charges - payments)
 * - Status determines if student is active (enrolled) or not
 * 
 * BURSARY (SCHOLARSHIP) FIELDS:
 * - bursaryStatus: 'full' (100% discount), 'partial' (% discount), 'none' (no discount)
 * - bursaryPercentage: 0-100 (percent discount on fees)
 * - bursaryReason: Why scholarship was granted (for record-keeping)
 * 
 * EXAMPLE:
 * {
 *   id: "s123",
 *   tenantId: "t1",
 *   firstName: "Tendai",
 *   lastName: "Moyo",
 *   classId: "c456",
 *   balance: 150.00,
 *   dateOfBirth: "2010-05-15",
 *   email: "tendai@school.com",
 *   address: "123 Main St, Harare",
 *   guardian: { name: "Mary Moyo", phone: "...", ... },
 *   enrollmentDate: "2023-01-10",
 *   status: "active",
 *   bursaryStatus: "partial",
 *   bursaryPercentage: 50,
 *   bursaryReason: "Financial hardship"
 * }
 */
export interface Student {
  id: string;                             // Unique student ID (e.g., "s123")
  tenantId: string;                       // School ID (for multi-tenancy)
  firstName: string;                      // Student's first name
  lastName: string;                       // Student's last name
  admissionNumber: string;               // School-assigned admission number (e.g., "2026/001")
  gender?: 'male' | 'female' | 'other'; // Student's gender
  classId: string;                        // ID of class student is enrolled in
  className: string;                      // Name of class student is enrolled in
  balance: number;                        // Outstanding balance in USD (dynamically calculated)
  dateOfBirth?: string;                   // Optional: Date of birth (YYYY-MM-DD)
  nationalId?: string;                    // Optional: National ID or birth certificate number
  email?: string;                         // Optional: Student's email
  address?: string;                       // Optional: Home address
  photoUrl?: string;                      // Optional: URL to student photo
  guardian: Guardian;                     // Primary guardian/parent contact
  guardian2?: Guardian;                   // Optional: Second emergency contact
  enrollmentDate: string;                 // Date student enrolled (YYYY-MM-DD)
  status: 'active' | 'inactive' | 'graduated' | 'transferred' | 'dropped_out'; // Student status
  bursaryStatus?: 'full' | 'partial' | 'none'; // Optional: Scholarship status
  bursaryPercentage?: number;             // Optional: Scholarship percentage (0-100)
  bursaryReason?: string;                 // Optional: Reason for scholarship
  currentEnrollment?: Enrollment;         // Optional: Current enrollment record
}

export type StudentProfileChangeType = 'correction' | 'historical_change';

export interface StudentIdentitySummary {
  enrollmentRecords: number;
  profileHistoryRecords: number;
  statusHistoryRecords?: number;
  transportAssignments: number;
  charges: number;
  payments: number;
  hasActiveTransport: boolean;
}

export interface StudentIdentity {
  student: Student;
  currentEnrollment: Enrollment | null;
  activeTransport: Record<string, unknown> | null;
  summary: StudentIdentitySummary;
}

export interface StudentProfileHistoryEntry {
  id: string;
  studentId: string;
  fieldName: string;
  previousValue: string | null;
  newValue: string | null;
  changeType: StudentProfileChangeType;
  effectiveDate: string;
  reason: string;
  changedByUserId: string;
  changedByName?: string;
  createdAt: string;
}

export interface StudentProfileHistoryInput {
  fieldName: string;
  newValue: string | null;
  changeType: StudentProfileChangeType;
  effectiveDate: string;
  reason: string;
}

export interface StudentProfileHistoryResponse {
  studentId: string;
  history: StudentProfileHistoryEntry[];
}

export type StudentTimelineEventType =
  | 'profile_change'
  | 'status_change'
  | 'enrollment'
  | 'transport_assignment'
  | 'charge'
  | 'payment'
  | 'ledger_adjustment';

export interface StudentTimelineFilters {
  from?: string;
  to?: string;
  academicYear?: string;
  types?: StudentTimelineEventType[];
  limit?: number;
  page?: number;
}

export interface StudentTimelineEvent {
  id: string;
  eventType: StudentTimelineEventType;
  eventDate: string;
  title: string;
  summary: string;
  sourceType: string;
  sourceId: string;
  metadata: Record<string, unknown>;
}

export interface StudentTimelineResponse {
  studentId: string;
  studentName: string;
  filters: {
    from: string | null;
    to: string | null;
    academicYear: string | null;
    types: StudentTimelineEventType[];
  };
  events: StudentTimelineEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * StatusHistoryEntry - Immutable audit record of a student status change
 */
export interface StatusHistoryEntry {
  id: string;
  studentId: string;
  previousStatus: Student['status'] | null; // null for initial enrollment
  newStatus: Student['status'];
  effectiveDate: string;                  // YYYY-MM-DD
  reason?: string;
  changedByUserId: string;
  changedByName?: string;
  createdAt: string;                      // ISO datetime
}

/**
 * Enrollment - Student's academic enrollment record
 * 
 * WHAT IT DOES:
 * Tracks a student's enrollment in a specific class for an academic session.
 * Each student has one enrollment per academic year, maintaining a historical
 * record of their academic journey.
 * 
 * HOW IT WORKS:
 * - Links student to a class for a specific academic session
 * - Tracks status: ACTIVE, PROMOTED, REPEATED, GRADUATED, etc.
 * - Records enrollment and completion dates
 * - Used for academic history and reporting
 * 
 * EXAMPLE:
 * {
 *   id: "enrollment_123",
 *   studentId: "student_456",
 *   classId: "class_789",
 *   academicSession: "2024/2025",
 *   status: "ACTIVE",
 *   enrollmentDate: "2024-01-15"
 * }
 */
export interface Enrollment {
  id: string;                             // Unique enrollment ID
  studentId: string;                      // Student ID
  classId: string;                        // Class ID for this enrollment
  academicSession: string;                // Academic session (e.g., "2024/2025")
  status: 'ACTIVE' | 'PROMOTED' | 'REPEATED' | 'GRADUATED' | 'TRANSFERRED' | 'DROPPED_OUT'; // Enrollment status
  enrollmentDate: string;                 // Date of enrollment (YYYY-MM-DD)
  completionDate?: string;                // Date of completion (if completed)
  remarks?: string;                       // Optional notes
}

/**
 * Class - A class/form group in the school
 * 
 * WHAT IT DOES:
 * Represents a single class (like "Form 1A" or "Grade 5"). Each class has:
 * - A name (display name)
 * - An assigned teacher
 * - A level (for sorting and promotions, e.g., "1.1", "1.2", "2.1")
 * - A capacity (maximum students)
 * 
 * HOW LEVELS WORK:
 * Level is a decimal number used for sorting and auto-promotion:
 * - 0.1 = ECD A
 * - 0.2 = ECD B
 * - 1.1 = Form 1A
 * - 1.2 = Form 1B
 * - 2.1 = Form 2A
 * 
 * When promoting students, they move to the next level up (1.1 → 1.2 → 2.1).
 * 
 * EXAMPLE:
 * {
 *   id: "c456",
 *   tenantId: "t1",
 *   name: "Form 1A",
 *   teacherId: "staff_1",
 *   level: "1.1",
 *   capacity: 35
 * }
 */
export interface Class {
  id: string;                             // Unique class ID (e.g., "c456")
  tenantId: string;                       // School ID (for multi-tenancy)
  name: string;                           // Display name (e.g., "Form 1A")
  teacherId: string;                      // ID of staff member who teaches this class
  capacity: number;                       // Maximum students allowed in this class
  nextClassId?: string;                   // Next class in promotion sequence (optional)
}

/**
 * Staff - School staff member (teaching or non-teaching)
 * 
 * WHAT IT DOES:
 * Represents a staff member employed at the school. Staff can be teachers
 * (assigned to classes) or non-teaching staff (admin, support).
 * 
 * HOW IT WORKS:
 * - isTeaching: true = can be assigned to teach classes
 * - status: 'active' = currently employed, 'inactive' = terminated, 'on_leave' = temporary leave
 * - position: Job title (e.g., "Math Teacher", "Principal", "Secretary")
 * - department: Organizational unit (e.g., "Science", "Administration", "Support")
 * 
 * EXAMPLE:
 * {
 *   id: "staff_1",
 *   tenantId: "t1",
 *   firstName: "John",
 *   lastName: "Banda",
 *   email: "jbanda@school.com",
 *   phone: "+263 77 999 8888",
 *   employeeId: "EMP001",
 *   position: "Math Teacher",
 *   department: "Science",
 *   isTeaching: true,
 *   hireDate: "2020-01-15",
 *   status: "active"
 * }
 */
export interface Staff {
  id: string;                             // Unique staff ID (e.g., "staff_1")
  tenantId: string;                       // School ID (for multi-tenancy)
  firstName: string;                      // Staff member's first name
  lastName: string;                       // Staff member's last name
  email: string;                          // Staff member's email
  phone: string;                          // Staff member's phone number
  dateOfBirth?: string;                   // Staff member's date of birth (YYYY-MM-DD)
  address?: string;                       // Staff member's residential address
  employeeId?: string;                    // Auto-generated kiosk login ID (e.g., "EMP0042")
  position: string;                       // Job title (e.g., "Math Teacher", "Principal")
  department: string;                     // Department (e.g., "Science", "Administration")
  isTeaching: boolean;                    // Can this staff member teach classes?
  hireDate: string;                       // Date of hire (YYYY-MM-DD)
  employmentStatus?: 'active' | 'on_leave' | 'suspended' | 'resigned' | 'retired'; // Employment lifecycle status
  nextOfKin?: {                           // Next of kin information
    name: string;                         // Full name of next of kin
    relationship: string;                 // Relationship to staff member
    phone: string;                        // Contact phone number
    email?: string;                       // Contact email (optional)
    address: string;                      // Physical address
  };
}

/**
 * Teacher - Simplified teacher view (for dropdowns and quick access)
 * 
 * WHAT IT DOES:
 * A lightweight version of Staff containing only ID and name. Used in
 * dropdowns when assigning teachers to classes.
 * 
 * HOW IT WORKS:
 * mockApi.getTeachers() filters Staff where isTeaching=true and returns
 * this simplified format instead of full Staff objects.
 * 
 * EXAMPLE:
 * {
 *   id: "staff_1",
 *   name: "John Banda"
 * }
 */
export interface Teacher {
  id: string;                             // Staff ID
  name: string;                           // Full name (firstName + lastName)
}

// ==================== STUDENT ATTENDANCE TYPES ====================
// Purpose: Track daily student attendance

/**
 * AttendanceRecord - Daily attendance record for a student
 * 
 * WHAT IT DOES:
 * Records whether a student was present, absent, late, or excused on a
 * specific date. Teachers mark attendance daily for their classes.
 * 
 * HOW IT WORKS:
 * - One record per student per date per class
 * - Teachers mark attendance through the Attendance page
 * - Duplicate prevention: Can't create two records for same student/date/class
 * - recordedBy tracks which user (teacher/admin) marked attendance
 * 
 * STATUS MEANINGS:
 * - present: Student attended and was on time
 * - absent: Student did not attend
 * - late: Student arrived late
 * - excused: Student absent with valid excuse (sick note, etc.)
 * 
 * EXAMPLE:
 * {
 *   id: "a789",
 *   studentId: "s123",
 *   classId: "c456",
 *   date: "2025-01-20",
 *   status: "present",
 *   remarks: "",
 *   recordedBy: "u_teacher_1"
 * }
 */
export interface AttendanceRecord {
  id: string;                             // Unique attendance record ID
  studentId: string;                      // Which student this record is for
  classId: string;                        // Which class (to prevent duplicate marking)
  date: string;                           // Date of attendance (YYYY-MM-DD)
  status: 'present' | 'absent' | 'late' | 'excused'; // Attendance status
  remarks?: string;                       // Optional notes (e.g., "Doctor's appointment")
  recordedBy: string;                     // User ID of who recorded this (teacher or admin)
}

/**
 * AttendanceSummary - Aggregated attendance counts
 * 
 * WHAT IT DOES:
 * Provides a quick summary of attendance statistics (total days, present days,
 * absent days, etc.). Used in dashboards and student profiles.
 * 
 * EXAMPLE:
 * {
 *   total: 20,
 *   present: 18,
 *   absent: 1,
 *   late: 1,
 *   excused: 0
 * }
 */
export interface AttendanceSummary {
  total: number;                          // Total attendance records
  present: number;                        // Days marked present
  absent: number;                         // Days marked absent
  late: number;                           // Days marked late
  excused: number;                        // Days marked excused
}

/**
 * StudentAttendanceSummary - Per-student attendance summary for a date range
 * 
 * WHAT IT DOES:
 * Calculates attendance statistics for one student over a date range.
 * Used in the Teacher Dashboard to show class-wide attendance analytics.
 * 
 * HOW IT'S CALCULATED:
 * attendancePercentage = (presentDays + lateDays) / totalDays * 100
 * (Late counts as attended for percentage calculation)
 * 
 * EXAMPLE:
 * {
 *   studentId: "s123",
 *   studentName: "Tendai Moyo",
 *   presentDays: 18,
 *   absentDays: 1,
 *   lateDays: 1,
 *   excusedDays: 0,
 *   totalDays: 20,
 *   attendancePercentage: 95  // (18+1)/20 * 100
 * }
 */
export interface StudentAttendanceSummary {
  studentId: string;                      // Student ID
  studentName: string;                    // Student's full name
  presentDays: number;                    // Days marked present
  absentDays: number;                     // Days marked absent
  lateDays: number;                       // Days marked late
  excusedDays: number;                    // Days marked excused
  totalDays: number;                      // Total days in date range
  attendancePercentage: number;           // Attendance rate (0-100)
}

// ==================== CHARGES TYPES ====================
// Purpose: Track charge generation history

/**
 * ChargeGenerationRecord - Record of charge generation operations
 * 
 * WHAT IT DOES:
 * Tracks when fees/charges are generated for students, including
 * which term, how many students were affected, and who performed it.
 * 
 * EXAMPLE:
 * {
 *   id: "cg_001",
 *   termId: "term_2024_1",
 *   termName: "Term 1 2024",
 *   generatedAt: "2024-01-15T10:30:00Z",
 *   generatedBy: "admin_001",
 *   generatedByName: "John Admin",
 *   studentCount: 150,
 *   totalAmount: 75000,
 *   status: "completed"
 * }
 */
export interface ChargeGenerationRecord {
  id: string;                              // Unique record ID
  termId: string;                          // Term ID for which charges were generated
  termName: string;                        // Human-readable term name
  generatedAt: string;                     // ISO timestamp when generated
  generatedBy: string;                     // User ID who generated charges
  generatedByName: string;                 // User's name who generated charges
  studentCount: number;                    // Number of students affected
  totalAmount: number;                     // Total amount of charges generated
  status: 'completed' | 'partial' | 'failed'; // Generation status
}

// ==================== STAFF ATTENDANCE TYPES ====================
// Purpose: Track staff check-in/check-out and work hours

/**
 * StaffAttendanceRecord - Daily staff check-in/check-out record
 * 
 * WHAT IT DOES:
 * Tracks when staff members check in and out each day, automatically
 * calculating work hours and detecting late arrivals.
 * 
 * HOW IT WORKS:
 * 1. Staff checks in (records time)
 * 2. Late detection: After 8:30 AM = marked late
 * 3. Staff checks out (records time + calculates work hours)
 * 4. Admin can manually record for absent staff
 * 
 * STATUS MEANINGS:
 * - present: Checked in on time
 * - absent: Did not check in
 * - late: Checked in after 8:30 AM
 * - half_day: Worked less than 4 hours
 * - on_leave: Approved leave (auto-created from leave requests)
 * 
 * WORK HOURS CALCULATION:
 * workHours = (checkOut time - checkIn time) in hours
 * Example: 8:00 AM - 5:00 PM = 9 hours
 * 
 * EXAMPLE:
 * {
 *   id: "sa456",
 *   staffId: "staff_1",
 *   date: "2025-01-20",
 *   checkIn: "08:15",
 *   checkOut: "17:00",
 *   status: "present",
 *   workHours: 8.75,
 *   remarks: ""
 * }
 */
export interface StaffAttendanceRecord {
  id: string;                             // Unique attendance record ID
  staffId: string;                        // Which staff member
  staffName?: string;                     // Full name (present on paginated responses)
  date: string;                           // Date (YYYY-MM-DD)
  checkIn?: string;                       // Check-in time (HH:mm format, e.g., "08:30")
  checkOut?: string;                      // Check-out time (HH:mm format, e.g., "17:00")
  status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' | 'excused' | 'early_departure'; // Attendance status
  workHours?: number;                     // Calculated work hours (hours worked)
  overtimeHours?: number;                 // Hours worked beyond standard hours
  remarks?: string;                       // Optional notes
  comment?: string;                       // Admin comment for absent/excused status
}

/**
 * LeaveRequest - Staff leave application
 * 
 * WHAT IT DOES:
 * Represents a staff member's request for time off. Leave requests go through
 * an approval workflow: pending → approved/rejected.
 * 
 * HOW IT WORKS:
 * 1. Staff submits leave request with dates and reason
 * 2. Request status = 'pending'
 * 3. Admin reviews and approves/rejects
 * 4. If approved: Attendance records auto-created for leave dates
 * 5. Leave balance is updated (if applicable)
 * 
 * LEAVE TYPES:
 * - sick: Illness (typically short-term)
 * - vacation: Planned time off
 * - personal: Personal matters
 * - unpaid: Leave without pay
 * - maternity: Maternity leave
 * - emergency: Unexpected emergency
 * 
 * EXAMPLE:
 * {
 *   id: "lr123",
 *   staffId: "staff_1",
 *   leaveType: "sick",
 *   startDate: "2025-01-22",
 *   endDate: "2025-01-24",
 *   days: 3,
 *   reason: "Flu",
 *   status: "pending",
 *   appliedDate: "2025-01-20",
 *   reviewedBy: null,
 *   reviewedDate: null,
 *   reviewNotes: null
 * }
 */
export interface LeaveRequest {
  id: string;                             // Unique leave request ID
  staffId: string;                        // Staff member requesting leave
  leaveType: 'annual' | 'sick' | 'maternity' | 'paternity' | 'study' | 'unpaid' | 'compassionate'; // Type of leave
  startDate: string;                      // Leave start date (YYYY-MM-DD)
  endDate: string;                        // Leave end date (YYYY-MM-DD)
  days: number;                           // Number of days (inclusive)
  reason: string;                         // Reason for leave
  status: 'pending' | 'approved' | 'rejected'; // Approval status
  appliedDate: string;                    // Date request was submitted (YYYY-MM-DD)
  reviewedBy?: string;                    // User ID who reviewed (if reviewed)
  reviewedDate?: string;                  // Date reviewed (if reviewed)
  reviewNotes?: string;                   // Admin's notes on approval/rejection
}

/**
 * StaffAttendanceSummary - Monthly attendance summary for a staff member
 * 
 * WHAT IT DOES:
 * Aggregates attendance data for one staff member for one month. Includes
 * totals, averages, and work hour calculations.
 * 
 * HOW IT'S CALCULATED:
 * - Filters all attendance records for specified month
 * - Counts by status (present, absent, late, etc.)
 * - Sums total work hours
 * - Calculates average check-in and check-out times
 * 
 * EXAMPLE:
 * {
 *   staffId: "staff_1",
 *   month: "2025-01",
 *   totalDays: 22,
 *   present: 20,
 *   absent: 1,
 *   late: 1,
 *   halfDay: 0,
 *   onLeave: 0,
 *   totalWorkHours: 176,
 *   averageCheckIn: "08:15",
 *   averageCheckOut: "17:05"
 * }
 */
export interface StaffAttendanceSummary {
  staffId: string;                        // Staff member ID
  month: string;                          // Month (YYYY-MM format)
  totalDays: number;                      // Total attendance records
  present: number;                        // Days marked present
  absent: number;                         // Days marked absent
  late: number;                           // Days marked late
  halfDay: number;                        // Days marked half day
  onLeave: number;                        // Days on leave
  totalWorkHours: number;                 // Total hours worked this month
  averageCheckIn: string;                 // Average check-in time (HH:mm)
  averageCheckOut: string;                // Average check-out time (HH:mm)
}

/**
 * StudentFormData - Data submitted from Add/Edit Student forms
 * 
 * WHAT IT DOES:
 * Defines the shape of data collected from the student form. Used for
 * validation and type-checking when creating or updating students.
 * 
 * WHY SEPARATE FROM STUDENT:
 * Form data doesn't include auto-generated fields like ID, tenantId,
 * enrollmentDate, or status. Those are added by the API when creating.
 * 
 * OPTIONAL FIELDS:
 * Fields with "?" are optional and may not be filled in by user.
 */
export interface StudentFormData {
  firstName: string;                      // Student's first name (required)
  lastName: string;                       // Student's last name (required)
  admissionNumber?: string;              // Admission number (optional — auto-generated if blank)
  gender?: 'male' | 'female' | 'other'; // Gender (optional)
  classId: string;                        // Class to enroll in (required)
  dateOfBirth?: string;                   // Date of birth (optional)
  nationalId?: string;                    // National ID or birth cert number (optional)
  email?: string;                         // Email address (optional)
  address?: string;                       // Home address (optional)
  guardianName: string;                   // Guardian's name (required)
  guardianPhone: string;                  // Guardian's phone (required)
  guardianEmail?: string;                 // Guardian's email (optional)
  guardianRelationship: string;           // Relationship (required, e.g., "Mother")
  guardian2Name?: string;                // Second guardian name (optional)
  guardian2Phone?: string;               // Second guardian phone (optional)
  guardian2Relationship?: string;        // Second guardian relationship (optional)
  bursaryStatus?: 'full' | 'partial' | 'none'; // Scholarship status (optional)
  bursaryPercentage?: number;             // Scholarship % (optional, 0-100)
  bursaryReason?: string;                 // Scholarship reason (optional)
  openingBalance?: number;                // Starting balance (optional, for transfers)
  balanceReason?: string;                 // Reason for opening balance (optional)
  enrollmentDate?: string;                // Enrollment date in YYYY-MM-DD format (optional, defaults to today; used for proration)
}

// ==================== TRANSPORT MANAGEMENT TYPES ====================
// Purpose: School transport routes and student assignments

export interface TransportStop {
  id: string;
  name: string;
  pickupTime: string | null;
  orderPosition: number;
}

export interface TransportVehicle {
  id: string;
  name: string;
  regNumber: string | null;
  type: 'bus' | 'minibus' | 'van' | 'other';
  capacity: number;
  status: 'active' | 'inactive';
  activeAllocations?: number;
}

export interface TransportDriver {
  id: string;
  staffId: string | null;
  staffEmployeeId: string | null;
  name: string;
  phone: string | null;
  licenseNumber: string | null;
  status: 'active' | 'inactive';
  activeRoutes?: number;
}

export interface TransportRoutePeriod {
  id: string;
  vehicleId: string;
  vehicleName: string;
  regNumber: string | null;
  vehicleType: string;
  capacity: number;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  status: 'active' | 'inactive';
}

export interface RouteBalanceSummary {
  totalStudents: number;
  studentsWithBalance: number;
  totalOutstandingBalance: number;
}

export interface TransportRoute {
  id: string;
  tenantId: string;
  routeName: string;
  monthlyFee: number;
  status: 'active' | 'inactive';
  stops: TransportStop[];
  stopCount: number;
  vehicle: { id: string; name: string; regNumber: string | null; type: string; capacity: number } | null;
  driver: { id: string; name: string; phone: string | null } | null;
  periodId: string | null;
  students?: TransportAllocationStudent[];
  activeCount?: number;
  balanceSummary?: RouteBalanceSummary;
}

export interface TransportAllocationStudent {
  allocationId: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  stopId: string | null;
  stopName: string | null;
  direction: 'both' | 'inbound' | 'outbound';
  status: 'Active' | 'inactive';
  balance: number | null;
}

export interface TransportAllocation {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  routeId: string;
  routeName: string;
  stopId: string | null;
  stopName: string | null;
  direction: 'both' | 'inbound' | 'outbound';
  status: 'active' | 'inactive';
  notes: string | null;
}

export interface TransportRouteFormData {
  routeName: string;
  monthlyFee: number;
}

// ==================== SETTINGS & CONFIGURATION TYPES ====================
// Purpose: School-wide settings and admin configuration

/**
 * Settings - General school settings
 * 
 * WHAT IT DOES:
 * Stores school-wide configuration like name, contact info, branding,
 * currency, and current academic year.
 * 
 * HOW IT'S USED:
 * - Displayed in headers and reports
 * - Used for email notifications
 * - Currency setting affects payment formatting
 * - Academic year affects charge generation
 * 
 * EXAMPLE:
 * {
 *   tenantId: "t1",
 *   schoolName: "St. Mary's High School",
 *   contactEmail: "admin@stmarys.ac.zw",
 *   contactPhone: "+263 24 555 1234",
 *   address: "123 School Road, Harare, Zimbabwe",
 *   academicYear: "2025"
 * }
 */
export interface Settings {
  tenantId: string;                       // School ID
  schoolName: string;                     // School's official name
  contactEmail: string;                   // School admin email
  contactPhone: string;                   // School phone number
  address: string;                        // Physical address
  academicYear: string;                   // Current year (e.g., "2025")
  activeAcademicSession?: string | null;  // Active session in YYYY/YYYY+1 format (e.g., "2026/2027")
  staffWorkHours?: WorkHours;             // Staff work hour configuration (optional for backward compatibility)
  studentWorkHours?: WorkHours;           // Student work hour configuration (optional for backward compatibility)
  kioskModeEnabled?: boolean;             // Whether the staff attendance kiosk page is active
  studentKioskModeEnabled?: boolean;      // Whether the student attendance kiosk page is active
  driverKioskModeEnabled?: boolean;       // Whether the driver kiosk page is active
  kioskCode?: string;                     // Opaque kiosk access code (replaces tenant_id in URL)
  chargeProrationEnabled?: boolean;       // Whether mid-period charges are prorated (feature 060)
}

/**
 * WorkHours - Configurable work start and end times
 * 
 * WHAT IT DOES:
 * Defines the working hours for attendance status calculation
 * 
 * HOW IT WORKS:
 * Used to determine if someone is present, late, or absent based on check-in times
 */
export interface WorkHours {
  startTime: string;                      // Start time in "HH:mm" format (e.g., "08:30")
  endTime: string;                        // End time in "HH:mm" format (e.g., "17:00")
}

/**
 * FeeStructure - School fee structure configuration
 * 
 * WHAT IT DOES:
 * Defines how fees are charged (termly/monthly), default fee amounts,
 * and per-class overrides for different fee amounts.
 * 
 * HOW IT WORKS:
 * - structureType: 'termly' = one charge per fee per term;
 *                  'monthly' = charges split into installments by calendar months in the term.
 *                  Controls charge generation behaviour, not just labelling.
 * - termsPerYear: Number of terms (typically 3 in Zimbabwe)
 * - defaultFees: Fee amounts applied to all classes (e.g., { tuition: 500 })
 * - classOverrides: Per-class custom fees (e.g., { c1: { tuition: 600 } })
 * 
 * EXAMPLE:
 * {
 *   tenantId: "t1",
 *   structureType: "termly",
 *   termsPerYear: 3,
 *   defaultFees: {
 *     "Tuition": 500,
 *     "Books": 50,
 *     "Sports": 30
 *   },
 *   classOverrides: {
 *     "c_form6": {
 *       "Tuition": 700  // Form 6 has higher tuition
 *     }
 *   }
 * }
 */
export interface FeeStructure {
  tenantId: string;                       // School ID
  structureType: 'termly' | 'monthly'; // Fee billing structure
  termsPerYear: number;                   // Number of terms per year
  defaultFees: Record<string, number>;    // Default fee amounts (e.g., { Tuition: 500 })
  classOverrides?: Record<string, Record<string, number>>; // Optional: Per-class fee overrides
}

/**
 * PaymentCategory - Payment category configuration
 * 
 * WHAT IT DOES:
 * Defines available payment categories (like "Tuition", "Sports Fee") that
 * can be selected when recording payments. Admins can add/edit categories.
 * 
 * HOW IT WORKS:
 * - name: Display name shown in dropdowns
 * - defaultAmount: Optional pre-filled amount when selected
 * - active: Only active categories shown in payment form
 * 
 * EXAMPLE:
 * {
 *   id: "cat1",
 *   tenantId: "t1",
 *   name: "Tuition",
 *   defaultAmount: 500,
 *   active: true
 * }
 */
export interface PaymentCategory {
  id: string;                             // Unique category ID
  tenantId: string;                       // School ID
  name: string;                           // Category name (e.g., "Tuition", "Sports Fee")
  defaultAmount: number | null;           // Optional: Default amount (or null for manual entry)
  active: boolean;                        // Is this category active/visible?
  system?: boolean;                       // True for hard-coded system categories (feature 057)
}

/**
 * AcademicCalendar - School calendar with terms
 * 
 * WHAT IT DOES:
 * Defines the school year calendar with term dates. Used to:
 * - Determine current term
 * - Generate term charges
 * 
 * EXAMPLE:
 * {
 *   tenantId: "t1",
 *   terms: [
 *     { id: "term_1", name: "Term 1", start: "2025-01-15", end: "2025-04-30" },
 *     { id: "term_2", name: "Term 2", start: "2025-05-10", end: "2025-08-30" },
 *     { id: "term_3", name: "Term 3", start: "2025-09-10", end: "2025-12-15" }
 *   ]
 * }
 */
export interface AcademicCalendar {
  tenantId: string;  // School ID
  terms: Term[];     // Array of term definitions
}

/**
 * Term - Individual term definition
 * 
 * WHAT IT DOES:
 * Defines one academic term with start/end dates.
 */
export interface Term {
  id: string;                             // Unique term ID (e.g., "term_1_2025")
  name: string;                           // Term name (e.g., "Term 1")
  start: string;                          // Start date (YYYY-MM-DD)
  end: string;                            // End date (YYYY-MM-DD)
}

/**
 * User - User account for login/authentication
 * 
 * WHAT IT DOES:
 * Represents a user account that can log in to the system. Different roles
 * have different permissions.
 * 
 * ROLES:
 * - admin: Full access to everything
 * - teacher: Can mark attendance for their classes
 * - bursar: Can manage payments and view financial data
 * 
 * STATUS:
 * - active: Can log in
 * - inactive: Cannot log in (account disabled)
 * 
 * EXAMPLE:
 * {
 *   id: "u1",
 *   tenantId: "t1",
 *   role: "admin",
 *   email: "admin@school.com",
 *   password: "hashed_value",
 *   name: "John Admin",
 *   status: "active",
 *   createdDate: "2024-01-01"
 * }
 */
export interface User {
  id: string;                             // Unique user ID
  tenantId: string;                       // School ID (for multi-tenancy)
  role: 'super_admin' | 'admin' | 'teacher' | 'bursar';  // User role (determines permissions)
  email: string;                          // Login email (unique)
  password: string;                       // Password (hashed, never returned from API)
  name: string;                           // Display name
  status?: 'active' | 'inactive' | 'invited'; // Account status (invited = pending invitation acceptance)
  createdDate?: string;                   // Date account created (optional)
}

// ==================== LEDGER ACCOUNTING TYPES ====================
// Purpose: Student financial tracking

/**
 * StudentLedger - Student financial ledger (charges vs payments)
 * 
 * WHAT IT DOES:
 * Represents a student's complete financial record. Shows all charges
 * (amounts owed), all payments (amounts paid), and the resulting balance.
 * 
 * HOW IT WORKS (LEDGER ACCOUNTING):
 * - Charges are "debits" (money owed)
 * - Payments are "credits" (money paid)
 * - Balance = Total Charges - Total Payments
 * 
 * WHY CALCULATED DYNAMICALLY:
 * Student.balance field is deprecated. Instead, balance is calculated on-the-fly
 * from charges and payments. This ensures accuracy and prevents sync issues.
 * 
 * EXAMPLE:
 * {
 *   studentId: "s123",
 *   termId: "term_1_2025",
 *   totalCharges: 600,    // Sum of all charges
 *   totalPayments: 450,   // Sum of all payments
 *   balance: 150,         // 600 - 450 = 150 owed
 *   charges: [...],       // Array of Charge objects
 *   payments: [...]       // Array of Payment objects
 * }
 */
export interface StudentLedger {
  studentId: string;                      // Student ID
  termId?: string;                        // Optional: Filter by term
  totalCharges: number;                   // Sum of all charges (USD)
  totalPayments: number;                  // Sum of all payments (USD)
  balance: number;                        // Outstanding balance (charges - payments)
  charges: Charge[];                      // Array of all charge records
  payments: Payment[];                    // Array of all payment records
}

/**
 * TransportAccessRecord - Student transport history record
 * 
 * WHAT IT DOES:
 * Represents one month of transport access for a student. Shows route,
 * fee, payment status, and whether access was granted.
 * 
 * HOW IT'S USED:
 * Displayed on student profile to show transport payment history and
 * which months they had access to which routes.
 * 
 * EXAMPLE:
 * {
 *   month: "2025-01",
 *   routeId: "r1",
 *   routeName: "Harare North Route",
 *   fee: 30,
 *   paid: true,
 *   paymentDate: "2025-01-05",
 *   access: true
 * }
 */
export interface TransportAccessRecord {
  month: string;                          // Month (YYYY-MM format)
  routeId: string;                        // Route ID
  routeName: string;                      // Route name
  fee: number;                            // Monthly fee amount
  paid: boolean;                          // Was fee paid for this month?
  paymentDate: string | null;             // Date of payment (null if unpaid)
  access: boolean;                        // Does student have access this month?
}

// ==================== FEE CAMPAIGN TYPES (Feature 059) ====================
// Purpose: Event-based fee tracking separate from standard billing

export type CampaignScopeType = 'school_wide' | 'class';
export type CampaignStatus = 'active' | 'closed';
export type CampaignStudentStatus = 'unpaid' | 'partially_paid' | 'fully_paid';

export interface FeeCampaign {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  targetScopeType: CampaignScopeType;
  targetScopeId: string | string[] | null;
  amount: number;
  dueDate: string | null;
  status: CampaignStatus;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  summary?: FeeCampaignSummary;
}

export interface FeeCampaignSummary {
  totalStudents: number;
  totalExpected: number;
  totalCollected: number;
  totalOutstanding: number;
  fullyPaidCount: number;
  partiallyPaidCount: number;
  unpaidCount: number;
}

export interface CampaignStudent {
  id: string;
  tenantId: string;
  feeCampaignId: string;
  studentId: string;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: CampaignStudentStatus;
  studentName?: string;
  className?: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface StudentCampaignMembership {
  feeCampaignId: string;
  campaignName: string;
  campaignStatus: CampaignStatus;
  dueDate: string | null;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: CampaignStudentStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASS-LINKED STUDENT ATTENDANCE (feature 068)
// ─────────────────────────────────────────────────────────────────────────────

export type ClassAttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'half_day';

export interface StudentAttendanceEvent {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  classInstanceId?: string | null; // Optional: historical records may have this
  academicSession: string;
  date: string;
  periodKey: string | null;
  status: ClassAttendanceStatus;
  isEffective: boolean;
  submittedBy: string;
  submittedAt: string;
  remarks: string;
}

export interface ClassAttendanceRegister {
  classId: string;
  date: string;
  periodKey: string | null;
  records: Pick<StudentAttendanceEvent, 'id' | 'studentId' | 'studentName' | 'status' | 'remarks' | 'submittedBy' | 'submittedAt'>[];
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  halfDayCount: number;
  summary?: {
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    halfDayCount: number;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters?: {
    classId: string;
    date: string;
    periodKey: string | null;
    search: string;
    status: string;
  };
  sort?: {
    sortBy: 'studentName' | 'status' | 'submittedAt';
    sortOrder: 'asc' | 'desc';
  };
}

export interface ClassAttendanceBatchRecord {
  studentId: string;
  status: ClassAttendanceStatus;
  remarks?: string;
}

export interface ClassAttendanceBatchInput {
  classId: string;
  date: string;
  periodKey?: string | null;
  records: ClassAttendanceBatchRecord[];
}

export interface ClassAttendanceBatchResult {
  saved: number;
  skipped: { studentId: string; reason: string }[];
  date: string;
  classId: string;
  periodKey: string | null;
}

export interface ClassAttendanceStudentSummary {
  classId: string;
  classInstanceId?: string | null; // Optional: historical records may have this
  className: string;
  academicYear: string;
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  halfDay: number;
  attendanceRate: number;
}

export interface StudentClassAttendanceSummary {
  studentId: string;
  studentName: string;
  academicSession: string;
  startDate: string | null;
  endDate: string | null;
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  halfDay: number;
  attendanceRate: number;
  classBreakdown: ClassAttendanceStudentSummary[];
}

export interface ClassAttendanceSummaryStudent {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  halfDay: number;
  attendanceRate: number;
}

export interface ClassAttendanceSummary {
  classId: string;
  className: string;
  academicSession: string;
  startDate: string;
  endDate: string;
  classAttendanceRate: number;
  totalStudents: number;
  students: ClassAttendanceSummaryStudent[];
}

export interface SessionClassAttendanceSummary {
  classId: string;
  classInstanceId?: string | null; // Optional: historical records may have this
  className: string;
  academicYear: string;
  totalStudents: number;
  totalDaysRecorded: number;
  classAttendanceRate: number;
}

export interface SessionAttendanceSummary {
  academicSession: string;
  classes: SessionClassAttendanceSummary[];
}

export interface AttendanceAuditEvent {
  id: string;
  status: ClassAttendanceStatus;
  isEffective: boolean;
  submittedBy: string;
  submittedAt: string;
  remarks: string;
}

export interface AttendanceAuditLog {
  studentId: string;
  classId: string;
  date: string;
  periodKey: string | null;
  events: AttendanceAuditEvent[];
}

// ==================== TENANT DELETION TYPES ====================
// Purpose: Account deletion request and management

/**
 * Tenant Deletion Status - Current deletion state for a tenant
 */
export interface TenantDeletionStatus {
  tenantId: string;
  tenantName: string;
  deletionRequested: boolean;
  requestedAt: string | null;
  expiresAt: string | null;
  remainingDays: number | null;
  canUndo: boolean;
  accountStatus: 'active' | 'pending_deletion';
}

/**
 * Deletion Request Input - When requesting account deletion
 */
export interface DeletionRequestInput {
  confirmDelete: boolean;
  reason?: string;
}

/**
 * Deletion Request Response - Result of requesting deletion
 */
export interface DeletionRequestResponse {
  tenantId: string;
  status: 'pending_deletion';
  requestedAt: string;
  expiresAt: string;
  remainingDays: number;
  message: string;
}

/**
 * Undo Deletion Input - When canceling a deletion request
 */
export interface UndoDeletionInput {
  confirmUndo: boolean;
}

/**
 * Undo Deletion Response - Result of undoing deletion
 */
export interface UndoDeletionResponse {
  tenantId: string;
  status: 'active';
  deletionCanceled: boolean;
  restoredAt: string;
  message: string;
}

// ==================== PAGINATION TYPES (Feature 084) ====================

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface StaffListParams {
  search?: string;
  department?: string;
  isTeaching?: 'yes' | 'no';
  employmentStatus?: string;
  sortBy?: 'name' | 'department' | 'employmentStatus' | 'hireDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface StaffSummary {
  totalCount: number;
  activeCount: number;
  teachingCount: number;
  departmentBreakdown: Record<string, number>;
}

export interface StaffListResponse extends PaginatedResponse<Staff> {
  summary: StaffSummary;
}

export interface TransportListParams {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RouteStudentsParams {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'class' | 'balance';
  sortOrder?: 'asc' | 'desc';
}

export type PaginatedRouteStudentsResponse = PaginatedResponse<TransportAllocationStudent>;

// ──────────────────────────────────────────────────────────────────────────────
// Feature 094: Multi-Currency Support
// ──────────────────────────────────────────────────────────────────────────────

export interface CurrencyConfiguration {
  baseCurrency: string;
  enabledCurrencies: string[];
  supportedCurrencies: string[];
  baseCurrencyLocked: boolean;
  multiCurrencyEnabled: boolean;
}

export interface ExchangeRate {
  id: string;
  currencyCode: string;
  rateToBase: number;
  effectiveDate: string;
  createdBy: string | null;
  createdAt: string | null;
}

export interface ExchangeRateLookupResult {
  currencyCode: string;
  date: string;
  rateToBase: number | null;
  found: boolean;
}
