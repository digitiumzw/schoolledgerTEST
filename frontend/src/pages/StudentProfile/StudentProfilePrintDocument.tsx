import { formatCurrency, getGenderLabel } from '@/lib/studentUtils';
import type { StudentPrintData, PrintGuardian, PrintTimelineEvent } from './types/print-data';

interface Props {
  data: StudentPrintData;
}

function fmt(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function SectionHeading({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <h2
      className="text-base font-bold uppercase tracking-wide text-gray-700 border-b border-gray-300 pb-1 mt-6 mb-3"
      style={first ? undefined : { breakBefore: 'avoid', pageBreakBefore: 'avoid' }}
    >
      {children}
    </h2>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <td className="py-1 pr-4 text-xs font-semibold text-gray-500 whitespace-nowrap w-40">{label}</td>
      <td className="py-1 text-sm text-gray-900">{value ?? '—'}</td>
    </tr>
  );
}

function GuardianBlock({ guardian, label }: { guardian: PrintGuardian; label: string }) {
  return (
    <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }} className="mb-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <table className="w-full text-sm">
        <tbody>
          <Row label="Name" value={guardian.name} />
          <Row label="Relationship" value={guardian.relationship} />
          <Row label="Phone" value={guardian.phone} />
          {guardian.email && <Row label="Email" value={guardian.email} />}
        </tbody>
      </table>
    </div>
  );
}

function TimelineEventRow({ event }: { event: PrintTimelineEvent }) {
  const label: Record<string, string> = {
    profile_change: 'Profile',
    status_change: 'Status',
    enrollment: 'Enroll',
    payment: 'Payment',
    charge: 'Charge',
    transport: 'Transport',
    attendance: 'Attend.',
  };
  return (
    <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <td className="py-1 pr-3 text-xs text-gray-500 whitespace-nowrap w-28">
        {fmt(event.occurredAt)}
      </td>
      <td className="py-1 pr-3 text-xs text-gray-500 whitespace-nowrap w-20">
        {label[event.eventType] ?? event.eventType}
      </td>
      <td className="py-1 text-sm text-gray-900 font-medium">{event.title}</td>
      <td className="py-1 pl-3 text-xs text-gray-600 max-w-xs">{event.summary ?? ''}</td>
    </tr>
  );
}

function directionLabel(d: string | null): string {
  if (!d) return '—';
  if (d === 'both') return 'Both ways';
  if (d === 'inbound') return 'Inbound (to school)';
  if (d === 'outbound') return 'Outbound (from school)';
  return d;
}

function bursaryLabel(s: string | null): string | null {
  if (!s || s === 'none') return null;
  if (s === 'full') return 'Full Scholarship';
  if (s === 'partial') return 'Partial Scholarship';
  return s;
}

export function StudentProfilePrintDocument({ data }: Props) {
  const { meta, identity, contact, academic, finance, attendance, transport, timeline } = data;

  const printedDate = new Date(meta.printedAt).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="font-sans text-gray-900 bg-white p-8" style={{ fontFamily: 'sans-serif' }}>

      {/* ── Document Header ─────────────────────────────────────── */}
      <div className="text-center border-b-2 border-gray-700 pb-4 mb-2">
        <h1 className="text-2xl font-bold text-gray-900">{meta.schoolName}</h1>
        <p className="text-sm font-semibold text-gray-600 mt-1 uppercase tracking-widest">Student Profile</p>
      </div>
      <div className="flex justify-between text-xs text-gray-500 mb-2">
        <span>{identity.fullName} — {identity.admissionNumber}</span>
        <span>Printed: {printedDate}</span>
      </div>

      {/* ── Identity ────────────────────────────────────────────── */}
      <SectionHeading first>Identity</SectionHeading>
      <table className="w-full">
        <tbody>
          <Row label="Full Name"        value={identity.fullName} />
          <Row label="Status"           value={identity.status.charAt(0).toUpperCase() + identity.status.slice(1).replace('_', ' ')} />
          <Row label="Admission No."    value={identity.admissionNumber} />
          <Row label="Date of Birth"    value={fmt(identity.dateOfBirth)} />
          <Row label="Age"              value={identity.age !== null ? `${identity.age} years` : null} />
          <Row label="Gender"           value={getGenderLabel(identity.gender ?? undefined)} />
          <Row label="National ID"      value={identity.nationalId} />
          <Row label="Enrollment Date"  value={fmt(identity.enrollmentDate)} />
          {bursaryLabel(identity.bursaryStatus) && (
            <Row label="Bursary" value={bursaryLabel(identity.bursaryStatus)} />
          )}
        </tbody>
      </table>

      {/* ── Contact ─────────────────────────────────────────────── */}
      <SectionHeading>Contact</SectionHeading>
      {contact.email && <Row label="Email" value={contact.email} />}
      {contact.address && <Row label="Address" value={contact.address} />}
      {!contact.email && !contact.address && (
        <p className="text-sm text-gray-500 italic">No contact details recorded.</p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-6">
        {contact.guardian1 && (
          <GuardianBlock guardian={contact.guardian1} label="Primary Guardian" />
        )}
        {contact.guardian2 && (
          <GuardianBlock guardian={contact.guardian2} label="Secondary Guardian" />
        )}
      </div>

      {/* ── Academic ────────────────────────────────────────────── */}
      <SectionHeading>Academic</SectionHeading>
      <table className="w-full">
        <tbody>
          <Row label="Class"            value={academic.className} />
          <Row label="Class Teacher"    value={academic.teacherName} />
          <Row label="Class Size"       value={academic.classSize !== null ? `${academic.classSize} students` : null} />
          <Row label="Academic Session" value={academic.academicSession} />
        </tbody>
      </table>

      {/* ── Finance Summary ──────────────────────────────────────── */}
      <SectionHeading>Finance Summary</SectionHeading>
      <table className="w-full border border-gray-200">
        <tbody>
          {[
            { label: 'Total Charged',       value: formatCurrency(finance.totalCharged) },
            { label: 'Total Paid',          value: formatCurrency(finance.totalPaid) },
            { label: 'Credit Adjustments',  value: formatCurrency(finance.creditAdjustments) },
            { label: 'Debit Adjustments',   value: formatCurrency(finance.debitAdjustments) },
            { label: 'Fee Balance',         value: formatCurrency(finance.feeBalance) },
            { label: 'Transport Balance',   value: formatCurrency(finance.transportBalance) },
          ].map(({ label, value }) => (
            <tr key={label} className="border-b border-gray-100" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <td className="py-1.5 px-3 text-xs font-semibold text-gray-500 w-52">{label}</td>
              <td className="py-1.5 px-3 text-sm text-gray-900">{value}</td>
            </tr>
          ))}
          <tr className="bg-gray-50" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <td className="py-2 px-3 text-sm font-bold text-gray-900">Overall Balance</td>
            <td className={`py-2 px-3 text-sm font-bold ${finance.overallBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {formatCurrency(finance.overallBalance)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Attendance Summary ───────────────────────────────────── */}
      <SectionHeading>Attendance Summary</SectionHeading>
      <table className="w-full">
        <tbody>
          <Row label="Attendance Rate" value={`${attendance.attendanceRate}%`} />
          <Row label="Present"         value={attendance.presentCount} />
          <Row label="Absent"          value={attendance.absentCount} />
          <Row label="Late"            value={attendance.lateCount} />
          <Row label="Excused"         value={attendance.excusedCount} />
        </tbody>
      </table>

      {/* ── Transport ────────────────────────────────────────────── */}
      <SectionHeading>Transport</SectionHeading>
      {transport.hasAssignment ? (
        <table className="w-full">
          <tbody>
            <Row label="Route"     value={transport.routeName} />
            <Row label="Stop"      value={transport.stopName} />
            <Row label="Direction" value={directionLabel(transport.direction)} />
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-gray-500 italic">No transport assignment.</p>
      )}

      {/* ── Recent Timeline ──────────────────────────────────────── */}
      <SectionHeading>Recent Activity</SectionHeading>
      {timeline.events.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No timeline events recorded.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="py-1 pr-3 text-xs font-semibold text-gray-500 text-left w-28">Date</th>
              <th className="py-1 pr-3 text-xs font-semibold text-gray-500 text-left w-20">Type</th>
              <th className="py-1 text-xs font-semibold text-gray-500 text-left">Event</th>
              <th className="py-1 pl-3 text-xs font-semibold text-gray-500 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {timeline.events.map((event, idx) => (
              <TimelineEventRow key={idx} event={event} />
            ))}
          </tbody>
        </table>
      )}

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
        Printed from SchoolLedger &mdash; {printedDate}
      </div>
    </div>
  );
}
