import { Users } from "lucide-react";

interface PaidOnlyFilterProps {
  paidOnly: boolean;
  onChange: (value: boolean) => void;
  paidCount: number;
  totalCount: number;
}

export default function PaidOnlyFilter({
  paidOnly,
  onChange,
  paidCount,
  totalCount,
}: PaidOnlyFilterProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Paid students only</span>
        <span className="text-xs text-gray-400">
          ({paidCount}/{totalCount} paid)
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={paidOnly}
        onClick={() => onChange(!paidOnly)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          paidOnly ? "bg-blue-600" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            paidOnly ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
