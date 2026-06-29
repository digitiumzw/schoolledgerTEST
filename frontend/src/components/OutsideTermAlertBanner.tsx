import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api } from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";
import { useCalendarValidation } from "@/hooks/useCalendarValidation";

const DISMISS_KEY = "outside_term_alert_dismissed";

export function OutsideTermAlertBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === "1"
  );

  const canView =
    user?.role === "admin" ||
    user?.role === "super_admin" ||
    user?.role === "bursar";

  const { data: calendar } = useQuery({
    queryKey: ["calendar"],
    queryFn: () => api.getCalendar(),
    enabled: canView && !dismissed,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const validation = useCalendarValidation(calendar ?? null);

  if (!canView || dismissed || !validation.isOutsideAllTerms) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <Alert className="rounded-none border-x-0 border-t-0 mb-0 py-2.5 print:hidden bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          <strong>Current date is outside all configured terms.</strong>{" "}
          Today does not fall within any term. You may be in a holiday or inter-term break period.
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-amber-300 bg-transparent text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/50"
            onClick={() => navigate("/settings/calendar")}
          >
            Update Calendar
          </Button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss outside term alert"
            className="rounded p-0.5 transition-colors text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
