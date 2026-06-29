import { useState, useMemo, useCallback, useEffect } from "react";
import { Staff, LeaveRequest } from "@/types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Check, X, Loader2, MoreHorizontal, Eye, Edit, Ban, Trash2 } from "lucide-react";
import { getLeaveTypeVariant, formatLeaveType } from "@/lib/attendanceUtils";
import { LeaveRequestModal } from "@/components/modals/LeaveRequestModal";
import { ReviewLeaveModal } from "@/components/modals/ReviewLeaveModal";
import { ViewLeaveDetailsModal } from "@/components/modals/ViewLeaveDetailsModal";
import { EditLeaveRequestModal } from "@/components/modals/EditLeaveRequestModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileCard } from "@/components/MobileCard";
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
  useStaff,
  useLeaveRequests,
  usePaginatedLeaveRequests,
  useCreateLeaveRequestMutation,
  useReviewLeaveRequestMutation,
  useDeleteLeaveRequestMutation,
  useUpdateLeaveRequestMutation
} from "@/hooks/useStaffAttendanceData";
import {
  createStaffNameLookup,
  formatDate,
  getTodayString
} from "@/utils/staffAttendanceUtils";

const ALL_REQUESTS_PAGE_SIZE = 10;

export default function LeaveManagementTab() {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [allRequestsPage, setAllRequestsPage] = useState(1);
  const isMobile = useIsMobile();
  const today = getTodayString();

  // Fetch data using React Query
  const { data: staff = [], loading: staffLoading } = useStaff();
  const { data: leaveRequests = [], loading: leaveLoading } = useLeaveRequests();
  // Backend-driven pagination for All Leave Requests
  const {
    data: paginatedRequests = [],
    pagination: leavePagination,
    loading: paginatedLoading,
    refetch: refetchPaginated,
  } = usePaginatedLeaveRequests(allRequestsPage, ALL_REQUESTS_PAGE_SIZE);

  // Mutations
  const createMutation = useCreateLeaveRequestMutation();
  const reviewMutation = useReviewLeaveRequestMutation();
  const deleteMutation = useDeleteLeaveRequestMutation();
  const updateMutation = useUpdateLeaveRequestMutation();

  const isLoading = staffLoading || leaveLoading || paginatedLoading;

  // Memoized optimized lookups
  const staffNameLookup = useMemo(() => createStaffNameLookup(staff), [staff]);

  // Optimized get staff name
  const getStaffName = useCallback((staffId: string) => {
    return staffNameLookup.get(staffId) || 'Unknown';
  }, [staffNameLookup]);

  // Memoized filtered requests
  const pendingRequests = useMemo(() => {
    return leaveRequests.filter(lr => lr.status === 'pending');
  }, [leaveRequests]);

  // All requests come from backend-paginated hook
  const allRequests = paginatedRequests;
  const allRequestsTotalPages = leavePagination?.totalPages ?? 1;
  const allRequestsTotal = leavePagination?.total ?? allRequests.length;

  const handleReview = useCallback((leave: LeaveRequest) => {
    setSelectedLeave(leave);
    setReviewModalOpen(true);
  }, []);

  const handleView = useCallback((leave: LeaveRequest) => {
    setSelectedLeave(leave);
    setViewModalOpen(true);
  }, []);

  const handleEdit = useCallback((leave: LeaveRequest) => {
    setSelectedLeave(leave);
    setEditModalOpen(true);
  }, []);

  const handleRevoke = useCallback(async (leave: LeaveRequest) => {
    if (!confirm(`Are you sure you want to revoke this leave request for ${getStaffName(leave.staffId)}?`)) {
      return;
    }

    reviewMutation.mutate({
      id: leave.id,
      status: 'rejected',
      reviewedBy: 'admin1',
      reviewNotes: 'Leave revoked'
    });
  }, [getStaffName, reviewMutation]);

  const canEdit = useCallback((leave: LeaveRequest) => {
    return leave.status === 'pending' && leave.startDate > today;
  }, [today]);

  const handleDelete = useCallback(async (leave: LeaveRequest) => {
    const statusNote = leave.status === 'approved'
      ? ' This approved leave and its associated attendance records will be removed.'
      : '';
    if (!confirm(`Are you sure you want to delete this ${leave.status} leave request for ${getStaffName(leave.staffId)}?${statusNote} This action cannot be undone.`)) {
      return;
    }

    deleteMutation.mutate(leave.id);
  }, [getStaffName, deleteMutation]);

  // Clamp the current page when the underlying data changes (e.g. after a delete/refetch)
  useEffect(() => {
    if (allRequestsPage > allRequestsTotalPages) {
      setAllRequestsPage(allRequestsTotalPages);
    }
  }, [allRequestsPage, allRequestsTotalPages]);

  // Refetch paginated data after mutations complete
  useEffect(() => {
    refetchPaginated();
  }, [leaveRequests, refetchPaginated]);

  const paginatedAllRequests = allRequests;

  const renderAllRequestsPagination = () => {
    if (allRequestsTotal === 0) return null;
    const currentPage = allRequestsPage;
    const totalPages = allRequestsTotalPages;

    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
        <p className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * ALL_REQUESTS_PAGE_SIZE) + 1}–
          {Math.min(currentPage * ALL_REQUESTS_PAGE_SIZE, allRequestsTotal)} of {allRequestsTotal}
        </p>
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => { e.preventDefault(); setAllRequestsPage(p => Math.max(1, p - 1)); }}
                aria-disabled={currentPage === 1}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
            {pages.map((p, idx) =>
              p === 'ellipsis' ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === currentPage}
                    onClick={(e) => { e.preventDefault(); setAllRequestsPage(p); }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => { e.preventDefault(); setAllRequestsPage(p => Math.min(totalPages, p + 1)); }}
                aria-disabled={currentPage === totalPages}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending Leave Requests</CardTitle>
              <Badge variant="secondary">{pendingRequests.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isMobile ? (
              <div className="space-y-3">
                {pendingRequests.map((leave) => (
                  <MobileCard key={leave.id}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{getStaffName(leave.staffId)}</p>
                          <Badge variant={getLeaveTypeVariant(leave.leaveType)}>
                            {formatLeaveType(leave.leaveType)}
                          </Badge>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(leave)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleEdit(leave)}
                              disabled={!canEdit(leave)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleReview(leave)}
                              className="text-green-600"
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Review
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleRevoke(leave)}
                              className="text-red-600"
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Revoke
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(leave)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Start Date</p>
                          <p className="font-medium">{new Date(leave.startDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">End Date</p>
                          <p className="font-medium">{new Date(leave.endDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Working Days</p>
                          <p className="font-medium">{leave.days}</p>
                        </div>
                      </div>
                      
                      <div className="pt-2 border-t text-sm">
                        <p className="text-muted-foreground">Reason:</p>
                        <p>{leave.reason}</p>
                      </div>
                    </div>
                  </MobileCard>
                ))}
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Working Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((leave) => (
                      <TableRow key={leave.id}>
                        <TableCell className="font-medium">{getStaffName(leave.staffId)}</TableCell>
                        <TableCell>
                          <Badge variant={getLeaveTypeVariant(leave.leaveType)}>
                            {formatLeaveType(leave.leaveType)}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(leave.startDate).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(leave.endDate).toLocaleDateString()}</TableCell>
                        <TableCell>{leave.days}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{leave.reason}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(leave)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleEdit(leave)}
                                disabled={!canEdit(leave)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleReview(leave)}
                                className="text-green-600"
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Review
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleRevoke(leave)}
                                className="text-red-600"
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Revoke
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(leave)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Requests */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Leave Requests</CardTitle>
            <Button onClick={() => setRequestModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            <div className="space-y-3">
              {allRequests.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No leave requests found
                </p>
              ) : (
                paginatedAllRequests.map((leave) => (
                  <MobileCard key={leave.id}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{getStaffName(leave.staffId)}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant={getLeaveTypeVariant(leave.leaveType)}>
                              {formatLeaveType(leave.leaveType)}
                            </Badge>
                            {getStatusBadge(leave.status)}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(leave)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleEdit(leave)}
                              disabled={!canEdit(leave)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {leave.status === 'pending' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleReview(leave)}
                                  className="text-green-600"
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  Review
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleRevoke(leave)}
                                  className="text-red-600"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Revoke
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(leave)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Start Date</p>
                          <p className="font-medium">{new Date(leave.startDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">End Date</p>
                          <p className="font-medium">{new Date(leave.endDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Working Days</p>
                          <p className="font-medium">{leave.days}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Applied</p>
                          <p className="font-medium">{new Date(leave.appliedDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                      
                      <div className="pt-2 border-t text-sm">
                        <p className="text-muted-foreground">Reason:</p>
                        <p>{leave.reason}</p>
                      </div>
                    </div>
                  </MobileCard>
                ))
              )}
              {renderAllRequestsPagination()}
            </div>
          ) : (
            <div className="space-y-4">
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Working Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No leave requests found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAllRequests.map((leave) => (
                      <TableRow key={leave.id}>
                        <TableCell className="font-medium">{getStaffName(leave.staffId)}</TableCell>
                        <TableCell>
                          <Badge variant={getLeaveTypeVariant(leave.leaveType)}>
                            {formatLeaveType(leave.leaveType)}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(leave.startDate).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(leave.endDate).toLocaleDateString()}</TableCell>
                        <TableCell>{leave.days}</TableCell>
                        <TableCell>{getStatusBadge(leave.status)}</TableCell>
                        <TableCell>{new Date(leave.appliedDate).toLocaleDateString()}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{leave.reason}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(leave)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleEdit(leave)}
                                disabled={!canEdit(leave)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {leave.status === 'pending' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleReview(leave)}
                                    className="text-green-600"
                                  >
                                    <Check className="h-4 w-4 mr-2" />
                                    Review
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleRevoke(leave)}
                                    className="text-red-600"
                                  >
                                    <Ban className="h-4 w-4 mr-2" />
                                    Revoke
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(leave)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {renderAllRequestsPagination()}
            </div>
          )}
        </CardContent>
      </Card>

      <LeaveRequestModal
        open={requestModalOpen}
        onOpenChange={setRequestModalOpen}
        onSuccess={() => {
          // Data will be automatically refetched by React Query
        }}
      />

      <ReviewLeaveModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        leave={selectedLeave}
        onSuccess={() => {
          // Data will be automatically refetched by React Query
        }}
      />

      <ViewLeaveDetailsModal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        leave={selectedLeave}
        staffName={selectedLeave ? getStaffName(selectedLeave.staffId) : ''}
      />

      <EditLeaveRequestModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        leave={selectedLeave}
        onSuccess={() => {
          // Data will be automatically refetched by React Query
        }}
      />
    </div>
  );
}
