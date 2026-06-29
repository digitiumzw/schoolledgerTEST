import { UserPlus, CreditCard, ClipboardCheck, BarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface QuickActionsProps {
  onAddStudent: () => void;
  onRecordPayment: () => void;
  hasActivePlan: boolean;
}

export function QuickActions({ onAddStudent, onRecordPayment, hasActivePlan }: QuickActionsProps) {
  const navigate = useNavigate();
  const disabledTitle = "Subscribe to a plan to use this feature";

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2 sm:gap-3" role="toolbar" aria-label="Quick actions">
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={hasActivePlan ? undefined : 0}>
              <Button
                onClick={onAddStudent}
                size="sm"
                aria-label="Add new student"
                disabled={!hasActivePlan}
              >
                <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />
                Add Student
              </Button>
            </span>
          </TooltipTrigger>
          {!hasActivePlan && (
            <TooltipContent>
              <p>{disabledTitle}. <Link to="/billing" className="underline">Subscribe now</Link></p>
            </TooltipContent>
          )}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={hasActivePlan ? undefined : 0}>
              <Button
                onClick={onRecordPayment}
                variant="outline"
                size="sm"
                aria-label="Record a payment"
                disabled={!hasActivePlan}
              >
                <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" />
                Record Payment
              </Button>
            </span>
          </TooltipTrigger>
          {!hasActivePlan && (
            <TooltipContent>
              <p>{disabledTitle}. <Link to="/billing" className="underline">Subscribe now</Link></p>
            </TooltipContent>
          )}
        </Tooltip>

        <Button
          onClick={() => navigate("/attendance")}
          variant="outline"
          size="sm"
          aria-label="Mark attendance"
        >
          <ClipboardCheck className="h-4 w-4 mr-2" aria-hidden="true" />
          Mark Attendance
        </Button>
        <Button
          onClick={() => navigate("/payments")}
          variant="outline"
          size="sm"
          aria-label="View reports"
        >
          <BarChart className="h-4 w-4 mr-2" aria-hidden="true" />
          View Reports
        </Button>
      </div>
    </TooltipProvider>
  );
}
