import { Bus, Users } from "lucide-react";
import { MetricTile } from "@/components/dashboard/MetricTile";
import { DashboardStats } from "@/types/dashboard";
import { Skeleton } from "@/components/ui/skeleton";

interface TransportSectionProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function TransportSection({ stats, loading }: TransportSectionProps) {
  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
      <MetricTile
        title="Active Routes"
        value={stats?.activeTransportRoutes ?? 0}
        icon={Bus}
        description="Transport routes in service"
        tooltip="The number of transport routes currently in service. Each route has an assigned driver and vehicle."
      />
      <MetricTile
        title="Students on Transport"
        value={stats?.studentsUsingTransport ?? 0}
        icon={Users}
        description="With active transport access"
        tooltip="The number of students who have an active transport assignment and are currently using school transport services."
      />
    </div>
  );
}
