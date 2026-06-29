import { MapPin, Clock } from "lucide-react";
import { KioskStop } from "@/api/api";

interface RouteStopsListProps {
  stops: KioskStop[];
}

export default function RouteStopsList({ stops }: RouteStopsListProps) {
  if (stops.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400">
        <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No stops configured for this route.</p>
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {stops.map((stop, index) => (
        <li key={stop.id} className="flex items-start gap-3">
          <div className="flex flex-col items-center shrink-0">
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
              {index + 1}
            </div>
            {index < stops.length - 1 && (
              <div className="w-0.5 h-4 bg-blue-200 mt-0.5" />
            )}
          </div>
          <div className="pb-3 min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{stop.name}</p>
            {stop.pickupTime && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                <Clock className="h-3 w-3" />
                {stop.pickupTime}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
