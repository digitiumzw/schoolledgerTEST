/**
 * StudentCampaignsCard (Feature 059 — Fee Campaigns)
 *
 * Shows a student's campaign memberships on their profile page.
 * Displays campaign name, amount, status, and remaining balance.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Megaphone,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { api, StudentCampaignMembership } from "@/api/api";

interface StudentCampaignsCardProps {
  studentId: string;
}

export function StudentCampaignsCard({ studentId }: StudentCampaignsCardProps) {
  const [memberships, setMemberships] = useState<StudentCampaignMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    api
      .getStudentCampaigns(studentId)
      .then(setMemberships)
      .catch(() => setMemberships([]))
      .finally(() => setLoading(false));
  }, [studentId]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const statusIcon = (status: string) => {
    switch (status) {
      case "fully_paid":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
      case "partially_paid":
        return <Clock className="h-3.5 w-3.5 text-yellow-600" />;
      default:
        return <XCircle className="h-3.5 w-3.5 text-red-600" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Fee Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (memberships.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Fee Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No campaign memberships</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="h-4 w-4" /> Fee Campaigns
          <Badge variant="secondary" className="ml-auto text-xs">
            {memberships.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {memberships.map((m) => (
          <div
            key={m.feeCampaignId}
            className="flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => navigate(`/fee-campaigns/${m.feeCampaignId}`)}
          >
            <div className="flex items-center gap-2">
              {statusIcon(m.status)}
              <div>
                <p className="text-sm font-medium">{m.campaignName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(m.paidAmount)} / {formatCurrency(m.expectedAmount)}
                  {m.dueDate && (
                    <> · Due {new Date(m.dueDate).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {m.remainingAmount > 0 && (
                <span className="text-xs text-red-600 font-medium">
                  {formatCurrency(m.remainingAmount)} due
                </span>
              )}
              <Badge
                variant={m.campaignStatus === "active" ? "default" : "secondary"}
                className="text-xs"
              >
                {m.campaignStatus}
              </Badge>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
