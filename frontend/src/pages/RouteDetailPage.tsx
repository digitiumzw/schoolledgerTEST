import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/api/api";
import type { TransportRoute, TransportAllocationStudent, RouteStudentsParams } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, Bus, Phone, Users, DollarSign, UserMinus, Loader2, Car, MapPin,
  Plus, Edit, Settings, UserCheck, Info, Download, Wallet, Search,
  ChevronLeft, ChevronRight, ArrowUpDown, ChevronDown, Eye, EyeOff,
} from "lucide-react";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error-state";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { StopsManagerModal } from "@/components/modals/StopsManagerModal";
import { RoutePeriodModal } from "@/components/modals/RoutePeriodModal";
import { AllocateStudentModal } from "@/components/modals/AllocateStudentModal";

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);
  const [showStopsModal, setShowStopsModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showBalance, setShowBalance] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<RouteStudentsParams['sortBy']>('name');
  const [sortOrder, setSortOrder] = useState<RouteStudentsParams['sortOrder']>('asc');
  const pageSize = 20;

  const { data: route, isLoading, isError } = useQuery<TransportRoute>({
    queryKey: ['route', id],
    queryFn: () => api.getRouteById(id!),
    enabled: !!id,
  });

  // Paginated students query
  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['route-students', id, page, searchTerm, sortBy, sortOrder],
    queryFn: () => api.getRouteStudents(id!, {
      page,
      limit: pageSize,
      search: searchTerm || undefined,
      sortBy,
      sortOrder,
    }),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['route', id] });
    queryClient.invalidateQueries({ queryKey: ['route-students', id] });
    queryClient.invalidateQueries({ queryKey: ['transport-routes'] });
    queryClient.invalidateQueries({ queryKey: ['transport-allocations'] });
  };

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1); // Reset to first page on search
  }, []);

  const handleSort = useCallback((field: RouteStudentsParams['sortBy']) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  }, [sortBy]);

  const handleDownloadPdf = async () => {
    if (!id) return;
    setIsDownloading(true);
    try {
      await api.downloadRoutePdf(id, showBalance);
    } catch {
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;
    try {
      setRemovingId(confirmRemove.id);
      await api.removeAllocation(confirmRemove.id);
      toast.success(`${confirmRemove.name} removed from route`);
      refetch();
    } catch {
      toast.error("Failed to remove student");
    } finally {
      setRemovingId(null);
      setConfirmRemove(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-16" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-32" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-12 w-full" />
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !route) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/transport')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Transport
        </Button>
        <QueryErrorState
          title="Could not load route details"
          description="Failed to fetch this route. It may have been deleted or you may not have access."
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['route', id] })}
        />
      </div>
    );
  }

  const students: TransportAllocationStudent[] = studentsData?.data ?? [];
  const pagination = studentsData?.pagination;
  const hasStops = route.stops.length > 0;
  const totalStudents = route.balanceSummary?.totalStudents ?? route.students?.length ?? 0;

  return (
    <SubscriptionGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/transport')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold truncate">{route.routeName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={route.status === "active" ? "secondary" : "outline"}>{route.status}</Badge>
              <span className="text-sm text-muted-foreground">${route.monthlyFee.toFixed(2)}/month</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-1 space-y-4">

            {/* Vehicle & Driver */}
            <Collapsible defaultOpen>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CollapsibleTrigger className="group flex items-center gap-2 flex-1 text-left cursor-pointer">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Vehicle & Driver
                      </CardTitle>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <Button variant="link" size="sm" className="h-7 px-2 text-xs font-medium" onClick={() => setShowPeriodModal(true)}>
                      {route.vehicle ? <Edit className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                      {route.vehicle ? "Change" : "Assign"}
                    </Button>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-3">
                    {route.vehicle ? (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Car className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{route.vehicle.name}</p>
                            {route.vehicle.regNumber && (
                              <p className="text-xs text-muted-foreground">{route.vehicle.regNumber}</p>
                            )}
                            <p className="text-xs text-muted-foreground capitalize">
                              {route.vehicle.type} · {route.vehicle.capacity} seats
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No vehicle assigned for this period.</p>
                    )}

                    {route.driver ? (
                      <div className="flex items-center gap-3 pt-1">
                        <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <UserCheck className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{route.driver.name}</p>
                          {route.driver.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span>{route.driver.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No driver assigned.</p>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Stops */}
            <Collapsible defaultOpen>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CollapsibleTrigger className="group flex items-center gap-2 flex-1 text-left cursor-pointer">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Stops ({route.stops.length})
                      </CardTitle>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <Button variant="link" size="sm" className="h-7 px-2 text-xs font-medium" onClick={() => setShowStopsModal(true)}>
                      <Settings className="h-3.5 w-3.5 mr-1" /> Manage
                    </Button>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {!hasStops ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground italic">
                          Create at least one stop before assigning students to this route.
                        </p>
                        <Button variant="secondary" size="sm" onClick={() => setShowStopsModal(true)}>
                          <Plus className="h-4 w-4 mr-1" /> Add First Stop
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {route.stops.map((stop, idx) => (
                          <div key={stop.id} className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground w-5 text-right text-xs">{idx + 1}.</span>
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="flex-1">{stop.name}</span>
                            {stop.pickupTime && (
                              <span className="text-xs text-muted-foreground">{stop.pickupTime}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Summary */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Active students</span>
                  </div>
                  <span className="font-medium">{students.length}</span>
                </div>
                {route.vehicle && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Car className="h-4 w-4" />
                      <span>Capacity</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{students.length}/{route.vehicle.capacity}</span>
                      {students.length >= route.vehicle.capacity && (
                        <Badge variant="destructive" className="text-xs">Full</Badge>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span>Monthly revenue</span>
                  </div>
                  <span className="font-medium">${(students.length * route.monthlyFee).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Balance Summary */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Total students</span>
                  </div>
                  <span className="font-medium">{route.balanceSummary?.totalStudents ?? students.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Wallet className="h-4 w-4" />
                    <span>Students with balance</span>
                  </div>
                  <span className="font-medium">{route.balanceSummary?.studentsWithBalance ?? 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span>Total outstanding</span>
                  </div>
                  <span className="font-medium">
                    ${(route.balanceSummary?.totalOutstandingBalance ?? 0).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column: students */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <CardTitle>Students ({pagination?.total ?? totalStudents})</CardTitle>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-7 px-2 text-xs font-medium"
                        onClick={() => setShowBalance(v => !v)}
                      >
                        {showBalance
                          ? <><EyeOff className="h-3.5 w-3.5 mr-1" /> Hide Balances</>
                          : <><Eye className="h-3.5 w-3.5 mr-1" /> Show Balances</>}
                      </Button>
                      <span className="text-muted-foreground/40 text-xs">·</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-7 px-2 text-xs font-medium"
                        onClick={handleDownloadPdf}
                        disabled={isDownloading}
                      >
                        {isDownloading
                          ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating…</>
                          : <><Download className="h-3.5 w-3.5 mr-1" /> Download PDF</>}
                      </Button>
                      <span className="text-muted-foreground/40 text-xs">·</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-7 px-2 text-xs font-medium"
                        onClick={() => setShowAllocateModal(true)}
                        disabled={!hasStops}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Allocate
                      </Button>
                    </div>
                  </div>
                  {/* Search and Sort Controls */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search students..."
                        value={searchTerm}
                        onChange={handleSearch}
                        className="pl-10 h-9"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground hidden sm:inline">Sort:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => handleSort('name')}
                      >
                        Name
                        {sortBy === 'name' && <ArrowUpDown className="h-3 w-3 ml-1" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => handleSort('balance')}
                      >
                        Balance
                        {sortBy === 'balance' && <ArrowUpDown className="h-3 w-3 ml-1" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {!hasStops ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Create route stops before assigning students.</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowStopsModal(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Add Stops
                    </Button>
                  </div>
                ) : totalStudents === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Bus className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No students allocated yet.</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAllocateModal(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Allocate First Student
                    </Button>
                  </div>
                ) : (
                  <>
                    {isLoadingStudents && (
                      <div className="py-8 text-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm">Loading students...</p>
                      </div>
                    )}
                    {!isLoadingStudents && students.length === 0 && searchTerm && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No students match your search.</p>
                        <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setPage(1); }}>
                          Clear Search
                        </Button>
                      </div>
                    )}
                    {!isLoadingStudents && students.length > 0 && (
                      <div className="space-y-1">
                        {students.map((student, idx) => (
                          <div key={student.allocationId}>
                            {idx > 0 && <Separator className="my-1" />}
                            <div className="flex items-center justify-between gap-2 py-1.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                              {student.studentName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{student.studentName}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">{student.studentClass}</span>
                                {student.stopName && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span>{student.stopName}</span>
                                  </div>
                                )}
                                {student.direction !== "both" && (
                                  <Badge variant="outline" className="text-xs capitalize">{student.direction}</Badge>
                                )}
                                {showBalance && student.balance !== null && student.balance > 0 && (
                                  <span className="text-xs font-medium text-amber-600">
                                    ${student.balance.toFixed(2)} owed
                                  </span>
                                )}
                                {showBalance && student.balance !== null && student.balance <= 0 && (
                                  <span className="text-xs text-emerald-600 font-medium">Paid</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-8 w-8 p-0 flex-shrink-0"
                            disabled={removingId === student.allocationId}
                            onClick={() => setConfirmRemove({ id: student.allocationId, name: student.studentName })}
                          >
                            {removingId === student.allocationId
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <UserMinus className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4 border-t mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1 || isLoadingStudents}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-4">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={page >= pagination.totalPages || isLoadingStudents}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>



      <StopsManagerModal
        open={showStopsModal}
        onOpenChange={setShowStopsModal}
        routeId={id!}
        routeName={route.routeName}
        onChange={refetch}
      />

      <RoutePeriodModal
        open={showPeriodModal}
        onOpenChange={setShowPeriodModal}
        routeId={id!}
        period={route.periodId ? {
          id: route.periodId,
          vehicleId: route.vehicle?.id ?? "",
          vehicleName: route.vehicle?.name ?? "",
          regNumber: route.vehicle?.regNumber ?? null,
          vehicleType: route.vehicle?.type ?? "",
          capacity: route.vehicle?.capacity ?? 0,
          driverId: route.driver?.id ?? null,
          driverName: route.driver?.name ?? null,
          driverPhone: route.driver?.phone ?? null,
          status: "active",
        } : null}
        onSuccess={refetch}
      />

      <AllocateStudentModal
        open={showAllocateModal}
        onOpenChange={setShowAllocateModal}
        routeId={id!}
        routeName={route.routeName}
        stops={route.stops}
        onSuccess={refetch}
      />

      <AlertDialog open={!!confirmRemove} onOpenChange={open => { if (!open) setConfirmRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student from Route</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{confirmRemove?.name}</strong> from this route? Their allocation will be ended today.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Student
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SubscriptionGuard>
  );
}
