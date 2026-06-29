import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api } from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";

const FEE_DISMISS_KEY = "unbilled_charges_alert_dismissed";
const FEE_OUTSIDE_TERM_DISMISS_KEY = "unbilled_charges_outside_term_dismissed";
const TRANSPORT_DISMISS_KEY = "transport_charges_alert_dismissed";
const UNASSIGNED_DISMISS_KEY = "unassigned_students_alert_dismissed";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(yyyyMM: string): string {
  const [year, month] = yyyyMM.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function UnbilledChargesAlertBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [feeDismissed, setFeeDismissed] = useState(
    () => sessionStorage.getItem(FEE_DISMISS_KEY) === "1"
  );
  const [feeOutsideTermDismissed, setFeeOutsideTermDismissed] = useState(
    () => sessionStorage.getItem(FEE_OUTSIDE_TERM_DISMISS_KEY) === "1"
  );
  const [transportDismissed, setTransportDismissed] = useState(
    () => sessionStorage.getItem(TRANSPORT_DISMISS_KEY) === "1"
  );
  const [unassignedDismissed, setUnassignedDismissed] = useState(
    () => sessionStorage.getItem(UNASSIGNED_DISMISS_KEY) === "1"
  );

  const canView =
    user?.role === "admin" ||
    user?.role === "super_admin" ||
    user?.role === "bursar";

  const canViewUnassigned =
    user?.role === "admin" || user?.role === "super_admin";

  const { data: feeAlert } = useQuery({
    queryKey: ["unbilled-charges-alert"],
    queryFn: () => api.getFeeRuleUnbilledAlert(),
    enabled: canView && !feeDismissed,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const month = currentMonth();
  const { data: transportData } = useQuery({
    queryKey: ["missing-transport-charges", month, null, null],
    queryFn: () => api.getMissingTransportCharges({ month }),
    enabled: canView && !transportDismissed,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: unassignedData } = useQuery({
    queryKey: ["students", "unassigned-count"],
    queryFn: () => api.getStudentsOptimized({ status: "active", unassignedOnly: true, limit: 1, page: 1 }),
    enabled: canViewUnassigned && !unassignedDismissed,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
  const unassignedCount: number = unassignedData?.pagination?.total ?? 0;

  if (!canView && !canViewUnassigned) return null;

  const outsideTerm = feeAlert?.hasActiveTerm === false;
  const showFee = !feeDismissed && !!feeAlert && !outsideTerm && feeAlert.unbilledStudentCount > 0;
  const showFeeOutsideTerm = !feeOutsideTermDismissed && !!feeAlert && outsideTerm && feeAlert.eligibleStudentCount > 0;
  const showTransport = !transportDismissed && !!transportData && transportData.totalMissing > 0;
  const showUnassigned = canViewUnassigned && !unassignedDismissed && unassignedCount > 0;

  if (!showFee && !showFeeOutsideTerm && !showTransport && !showUnassigned) return null;

  const handleDismissFee = () => {
    sessionStorage.setItem(FEE_DISMISS_KEY, "1");
    setFeeDismissed(true);
  };

  const handleDismissFeeOutsideTerm = () => {
    sessionStorage.setItem(FEE_OUTSIDE_TERM_DISMISS_KEY, "1");
    setFeeOutsideTermDismissed(true);
  };

  const handleDismissTransport = () => {
    sessionStorage.setItem(TRANSPORT_DISMISS_KEY, "1");
    setTransportDismissed(true);
  };

  const handleDismissUnassigned = () => {
    sessionStorage.setItem(UNASSIGNED_DISMISS_KEY, "1");
    setUnassignedDismissed(true);
  };

  const BANNER_CLASS =
    "rounded-none border-x-0 border-t-0 mb-0 py-2.5 print:hidden";
  const AMBER_CLASS =
    "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100";
  const ORANGE_CLASS =
    "bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-100";
  const DISMISS_BTN =
    "rounded p-0.5 transition-colors";

  const INFO_CLASS =
    "bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-100";

  return (
    <>
      {showFeeOutsideTerm && (
        <Alert className={`${BANNER_CLASS} ${INFO_CLASS}`}>
          <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <strong>Tuition charges ready to bill:</strong>{" "}
              {feeAlert!.eligibleStudentCount} eligible student{feeAlert!.eligibleStudentCount === 1 ? "" : "s"} can be billed once an active term begins.
              Charges cannot be generated outside a configured term period.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDismissFeeOutsideTerm}
                aria-label="Dismiss tuition charges outside term notice"
                className={`${DISMISS_BTN} text-sky-600 hover:bg-sky-100 dark:text-sky-400 dark:hover:bg-sky-900/50`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {showFee && (
        <Alert className={`${BANNER_CLASS} ${AMBER_CLASS}`}>
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <strong>Tuition charges not yet billed:</strong>{" "}
              {feeAlert!.unbilledStudentCount} of {feeAlert!.eligibleStudentCount}{" "}
              eligible student{feeAlert!.eligibleStudentCount === 1 ? "" : "s"} have
              not been billed for <strong>{feeAlert!.billingPeriod} fees</strong>.
            </span>
            <div className="flex items-center gap-2 shrink-0"> 
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-amber-300 bg-transparent text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/50"
                onClick={() => navigate("/payments?tab=billing")}
              >
                Generate Charges
              </Button>
              <button
                onClick={handleDismissFee}
                aria-label="Dismiss tuition charges alert"
                className={`${DISMISS_BTN} text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {showTransport && (
        <Alert className={`${BANNER_CLASS} ${ORANGE_CLASS}`}>
          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <strong>Transport charges not yet billed:</strong>{" "}
              {transportData!.totalMissing} student
              {transportData!.totalMissing === 1 ? "" : "s"} missing transport
              charges for{" "}
              <strong>{formatMonthLabel(transportData!.month)}</strong>.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-orange-300 bg-transparent text-orange-900 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-100 dark:hover:bg-orange-900/50"
                onClick={() => navigate("/payments?tab=billing")}
              >
                Generate Charges
              </Button>
              <button
                onClick={handleDismissTransport}
                aria-label="Dismiss transport charges alert"
                className={`${DISMISS_BTN} text-orange-600 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-900/50`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {showUnassigned && (
        <Alert className={`${BANNER_CLASS} bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-100`}>
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <strong>Students not assigned to a class:</strong>{" "}
              {unassignedCount} active student{unassignedCount === 1 ? "" : "s"} {unassignedCount === 1 ? "has" : "have"} not been placed in a class yet.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-blue-300 bg-transparent text-blue-900 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-100 dark:hover:bg-blue-900/50"
                onClick={() => navigate("/classes/unassigned")}
              >
                View &amp; Assign
              </Button>
              <button
                onClick={handleDismissUnassigned}
                aria-label="Dismiss unassigned students alert"
                className={`${DISMISS_BTN} text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/50`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
