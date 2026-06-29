import { Bus, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DashboardStats } from "@/types/dashboard";

interface TransportOverviewSectionProps {
  stats: DashboardStats | null;
}

export function TransportOverviewSection({ stats }: TransportOverviewSectionProps) {
  const activeRoutes = stats?.activeTransportRoutes ?? 0;
  const studentsOnTransport = stats?.studentsUsingTransport ?? 0;

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Routes</CardTitle>
                <Bus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{activeRoutes}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeRoutes === 0 ? "No active routes configured" : "Currently active transport routes"}
                </p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-sm">
            <p>Transport routes currently marked as active in the system.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Students on Transport</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{studentsOnTransport}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {studentsOnTransport === 0 ? "No active transport allocations" : "With active transport allocation"}
                </p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-sm">
            <p>Active students with an active allocation to at least one active transport route.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
