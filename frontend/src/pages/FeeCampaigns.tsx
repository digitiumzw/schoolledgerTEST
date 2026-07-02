/**
 * FeeCampaigns Page (Feature 059 — Fee Campaigns)
 *
 * Lists all campaigns in a structured list view with collection progress.
 * Admin/bursar can create new campaigns and navigate to detail views.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Megaphone,
  Users,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  GraduationCap,
  HelpCircle,
  Search,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { useFeeCampaigns } from "@/hooks/useFeeCampaigns";
import { CreateCampaignModal } from "@/components/modals/CreateCampaignModal";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import ContextualHelpLink from "@/components/help/ContextualHelpLink";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { useDebounce } from "@/hooks/use-debounce";
import type { FeeCampaign, CampaignStatus } from "@/api/api";

const ITEMS_PER_PAGE = 12;

export default function FeeCampaigns() {
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("fee-campaigns-onboarding-dismissed");
    if (!dismissed) {
      setOnboardingOpen(true);
    }
  }, []);

  const handleDismissOnboarding = () => {
    if (dontShowAgain) {
      localStorage.setItem("fee-campaigns-onboarding-dismissed", "true");
    }
    setOnboardingOpen(false);
    setDontShowAgain(false);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, debouncedSearchQuery]);

  const {
    campaigns: filtered,
    loading,
    isError,
    saving,
    isPending,
    createCampaign,
    refetch,
    pagination,
  } = useFeeCampaigns({
    status: statusFilter !== "all" ? (statusFilter as CampaignStatus) : undefined,
    search: debouncedSearchQuery || undefined,
    page: currentPage,
    limit: ITEMS_PER_PAGE,
  });

  const totalPages = pagination?.totalPages ?? 1;
  const totalCampaigns = pagination?.total ?? 0;

  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const getProgress = (c: FeeCampaign) => {
    const s = c.summary;
    if (!s || s.totalExpected === 0) return 0;
    return Math.round((s.totalCollected / s.totalExpected) * 100);
  };

  const renderPaginationItems = () => {
    const items = [];
    const showEllipsisStart = currentPage > 3;
    const showEllipsisEnd = currentPage < totalPages - 2;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              onClick={() => setCurrentPage(i)}
              isActive={currentPage === i}
              className="cursor-pointer"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      } else if (i === currentPage - 2 && showEllipsisStart) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      } else if (i === currentPage + 2 && showEllipsisEnd) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
    }

    return items;
  };

  return (
    <SubscriptionGuard>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
            Fee Campaigns
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Create and manage event-based fees for students
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ContextualHelpLink sectionId="fee-campaigns" label="Fee Campaigns Help" />
          <Button variant="ghost" size="sm" onClick={() => setOnboardingOpen(true)} className="hidden sm:flex">
            <HelpCircle className="h-4 w-4 mr-2" />
            Campaign guide
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-muted/30 rounded-xl border p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search campaigns by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-background shadow-sm border-input focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[140px] h-10 bg-background shadow-sm border-input">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            {(statusFilter !== "active" || debouncedSearchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter("active");
                  setSearchQuery("");
                }}
                className="h-10 px-3 text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            )}
            <Button onClick={() => setShowCreate(true)} disabled={isPending}>
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && !loading && (
        <QueryErrorState
          title="Could not load campaigns"
          description="Something went wrong while fetching fee campaigns. Please check your connection."
          onRetry={() => refetch()}
        />
      )}

      {/* Results summary */}
      {!loading && !isError && totalCampaigns > 0 && (statusFilter !== "active" || debouncedSearchQuery) && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Showing {filtered.length} of {totalCampaigns} campaign{totalCampaigns !== 1 ? "s" : ""}
            {debouncedSearchQuery && ` matching "${debouncedSearchQuery}"`}
            {statusFilter !== "active" && ` with status "${statusFilter}"`}
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Campaign</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-[180px]">Progress</TableHead>
                <TableHead className="w-[80px] text-right">Students</TableHead>
                <TableHead className="w-[100px] text-right">Amount</TableHead>
                <TableHead className="w-[110px]">Due Date</TableHead>
                <TableHead className="w-[140px]">Payment Status</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2 mt-1" />
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell>
                    <Skeleton className="h-2 w-full mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium">
              {debouncedSearchQuery
                ? "No campaigns match your search"
                : statusFilter === "active"
                ? "No active campaigns"
                : statusFilter === "closed"
                ? "No closed campaigns"
                : "No campaigns yet"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {debouncedSearchQuery
                ? "Try a different search term or clear the filters."
                : statusFilter === "active"
                ? "There are no active campaigns. Create one to start collecting event-based fees."
                : "Create your first fee campaign to start collecting event-based fees."}
            </p>
            {!debouncedSearchQuery && (
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Campaign
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Campaign list */}
      {!loading && filtered.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Campaign</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-[180px]">Progress</TableHead>
                <TableHead className="w-[80px] text-right">Students</TableHead>
                <TableHead className="w-[100px] text-right">Amount</TableHead>
                <TableHead className="w-[110px]">Due Date</TableHead>
                <TableHead className="w-[140px]">Payment Status</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((campaign) => {
                const progress = getProgress(campaign);
                const s = campaign.summary;

                return (
                  <TableRow
                    key={campaign.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/fee-campaigns/${campaign.id}`)}
                  >
                    {/* Campaign name + description */}
                    <TableCell>
                      <div className="font-medium text-sm leading-tight">
                        {campaign.name}
                      </div>
                      {campaign.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {campaign.description}
                        </p>
                      )}
                    </TableCell>

                    {/* Status badge */}
                    <TableCell>
                      <Badge
                        variant={campaign.status === "active" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {campaign.status}
                      </Badge>
                    </TableCell>

                    {/* Progress bar */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatCurrency(s?.totalCollected ?? 0)}</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                        <p className="text-xs text-muted-foreground">
                          of {formatCurrency(s?.totalExpected ?? 0)}
                        </p>
                      </div>
                    </TableCell>

                    {/* Students count */}
                    <TableCell className="text-right">
                      <span className="flex items-center justify-end gap-1 text-sm">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {s?.totalStudents ?? 0}
                      </span>
                    </TableCell>

                    {/* Amount per student */}
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(campaign.amount)}
                    </TableCell>

                    {/* Due date */}
                    <TableCell>
                      {campaign.dueDate ? (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(campaign.dueDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">—</span>
                      )}
                    </TableCell>

                    {/* Payment status breakdown */}
                    <TableCell>
                      {s && s.totalStudents > 0 ? (
                        <div className="flex items-center gap-2.5 text-xs">
                          <span className="flex items-center gap-1 text-green-600" title="Fully paid">
                            <CheckCircle2 className="h-3 w-3" />
                            {s.fullyPaidCount}
                          </span>
                          <span className="flex items-center gap-1 text-yellow-600" title="Partially paid">
                            <Clock className="h-3 w-3" />
                            {s.partiallyPaidCount}
                          </span>
                          <span className="flex items-center gap-1 text-red-600" title="Unpaid">
                            <XCircle className="h-3 w-3" />
                            {s.unpaidCount}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">—</span>
                      )}
                    </TableCell>

                    {/* Chevron indicator */}
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(currentPage * ITEMS_PER_PAGE, totalCampaigns)} of{" "}
            {totalCampaigns} campaigns
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={
                    currentPage === 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              <span className="px-4 sm:hidden">
                Page {currentPage} of {totalPages}
              </span>
              <span className="hidden sm:inline-flex">{renderPaginationItems()}</span>
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Create Modal */}
      <CreateCampaignModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={createCampaign}
        saving={saving}
      />

      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Getting Started with Fee Campaigns
            </DialogTitle>
            <DialogDescription>
              How to create and manage event-based fees for your students.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {[
              ["1", "What is a Campaign", "A campaign is a one-time or recurring fee collection for a specific event, trip, project, or cause. Each student gets a charge on their ledger automatically.", Megaphone],
              ["2", "Create a Campaign", "Choose a name, amount, due date, and scope. You can target the entire school, specific classes, or pick individual students.", Plus],
              ["3", "Track Payments", "Each campaign shows a progress bar with collected vs expected amounts, plus a breakdown of fully paid, partially paid, and unpaid students.", DollarSign],
              ["4", "Record Payments", "Open a campaign detail page to record payments for individual students or groups. Payments are linked to the campaign for easy tracking.", CheckCircle2],
              ["5", "Close Campaigns", "When collection ends, close the campaign. Closed campaigns remain visible for reporting but no longer accept new payments.", Clock],
            ].map(([step, title, detail, Icon]) => (
              <div key={step} className="flex items-start gap-3 border-b py-2.5 last:border-0">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary mt-0.5">
                  {step}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold">{title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fc-dont-show-again"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label htmlFor="fc-dont-show-again" className="text-sm cursor-pointer">
                Don&apos;t show this again
              </Label>
            </div>
            <Button onClick={handleDismissOnboarding}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </SubscriptionGuard>
  );
}
