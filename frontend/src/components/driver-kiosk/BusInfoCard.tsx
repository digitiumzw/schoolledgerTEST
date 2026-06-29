import { Bus } from "lucide-react";
import { KioskBus } from "@/api/api";

interface BusInfoCardProps {
  bus: KioskBus;
}

export default function BusInfoCard({ bus }: BusInfoCardProps) {
  return (
    <div className="flex items-center gap-4 p-5 bg-white rounded-xl border border-blue-200 shadow-sm">
      <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 shrink-0">
        <Bus className="h-6 w-6 text-blue-600" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-blue-500 uppercase tracking-wide">Assigned Bus</p>
        <p className="text-lg font-bold text-gray-900 truncate">{bus.name}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
          {bus.regNumber && (
            <span className="text-sm text-gray-500">{bus.regNumber}</span>
          )}
          <span className="text-sm text-gray-400 capitalize">{bus.type}</span>
          <span className="text-sm text-gray-400">{bus.capacity} seats</span>
        </div>
      </div>
    </div>
  );
}
