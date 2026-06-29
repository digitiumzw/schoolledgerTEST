import { DollarSign, TrendingUp, CheckCircle } from "lucide-react";
import { MetricTile } from "@/components/dashboard/MetricTile";
import { DashboardStats } from "@/types/dashboard";
import { formatCurrencyCompact } from "@/lib/studentUtils";
import { Skeleton } from "@/components/ui/skeleton";

interface FinancialSectionProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function FinancialSection({ stats, loading }: FinancialSectionProps) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 sm:h-32 rounded-lg" />)}
      </div>
    );
  }

  const collectionRate = isNaN(stats?.collectionRate ?? NaN) ? 0 : (stats?.collectionRate ?? 0);
  const totalOutstanding = stats?.totalOutstanding ?? 0;
  const withOutstanding = stats?.withOutstanding ?? 0;
  const paidInFull = stats?.paidInFull ?? 0;
  const termRevenue = stats?.totalRevenueThisTerm ?? 0;
  const termLabel = stats?.currentTermName ?? null;
  const termSuffix = termLabel ? ` (${termLabel})` : "";
  const noActiveTerm = termLabel === null;

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      <MetricTile
        title="Total Outstanding"
        value={formatCurrencyCompact(totalOutstanding)}
        icon={DollarSign}
        description={
          withOutstanding === 0
            ? "All fees collected — all time"
            : `${withOutstanding} student${withOutstanding !== 1 ? "s" : ""} with balance (all time)`
        }
        variant={totalOutstanding > 0 ? "warning" : "success"}
        tooltip="The total unpaid balance across all students, accumulated over all terms. This is the all-time amount still owed to the school."
      />
      <MetricTile
        title={`Collection Rate${termSuffix}`}
        value={noActiveTerm ? "—" : `${collectionRate.toFixed(1)}%`}
        icon={TrendingUp}
        description={noActiveTerm ? "No active term configured" : collectionRate === 0 ? "No charges recorded yet" : "Payments vs charges this term"}
        variant={noActiveTerm ? "default" : collectionRate >= 75 ? "success" : collectionRate > 0 ? "warning" : "default"}
        tooltip="The percentage of charges that have been collected as payments during the current term. A higher rate means better fee recovery."
      />
      <MetricTile
        title="Paid in Full"
        value={paidInFull}
        icon={CheckCircle}
        description={paidInFull === 0 ? "No students with zero balance" : "Active students with zero all-time balance"}
        variant={paidInFull > 0 ? "success" : "default"}
        tooltip="The number of active students whose total outstanding balance across all terms is zero. These students have no fees owed at all."
      />
      <MetricTile
        title={`Term Revenue${termSuffix}`}
        value={noActiveTerm ? "—" : formatCurrencyCompact(termRevenue)}
        icon={DollarSign}
        description={noActiveTerm ? "No active term configured" : termRevenue === 0 ? "No payments recorded" : "Collected this term"}
        tooltip="The total amount of payments received during the current academic term, including all payment methods."
      />
    </div>
  );
}
