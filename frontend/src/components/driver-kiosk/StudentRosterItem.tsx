import { User, MapPin, AlertCircle } from "lucide-react";
import { DriverKioskStudent } from "@/api/api";

interface StudentRosterItemProps {
  student: DriverKioskStudent;
  index: number;
  showPaymentStatus?: boolean;
}

const DIRECTION_LABELS: Record<string, string> = {
  both: "Both ways",
  inbound: "To school",
  outbound: "From school",
};

export default function StudentRosterItem({
  student,
  index,
  showPaymentStatus = true,
}: StudentRosterItemProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-4">
      <span className="text-sm font-medium text-gray-400 w-6 text-right shrink-0 mt-1">
        {index + 1}
      </span>
      <div className="flex items-center justify-center h-9 w-9 rounded-full bg-blue-100 shrink-0">
        <User className="h-4 w-4 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-semibold text-gray-900">
            {student.lastName}, {student.firstName}
          </span>
          {showPaymentStatus && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                student.paymentStatus === "paid"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {student.paymentStatus === "paid" ? "Paid" : "Unpaid"}
            </span>
          )}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {DIRECTION_LABELS[student.direction] ?? student.direction}
          </span>
          {student.transportBalance !== null && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                student.transportBalance > 0
                  ? "bg-blue-100 text-blue-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {student.transportBalance > 0
                ? `Transport Balance: $${student.transportBalance.toFixed(2)} due`
                : student.transportBalance < 0
                  ? `Transport Balance: $${Math.abs(student.transportBalance).toFixed(2)} credit`
                  : "Transport Balance: cleared"}
            </span>
          )}
        </div>

        {student.stop ? (
          <div className="flex items-center gap-1 mt-0.5 text-sm text-gray-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{student.stop.name}</span>
            {student.stop.pickupTime && (
              <span className="text-gray-400">· {student.stop.pickupTime}</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 mt-0.5 text-sm text-amber-500">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Stop not assigned</span>
          </div>
        )}

        {student.notes && (
          <p className="mt-0.5 text-xs text-gray-400 italic">{student.notes}</p>
        )}
      </div>
    </div>
  );
}
