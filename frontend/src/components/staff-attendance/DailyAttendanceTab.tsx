import { useState, useMemo, useCallback, useEffect } from "react";
import { Staff, StaffAttendanceRecord } from "@/types/dashboard";
import { AttendanceAlert } from "@/components/AttendanceAlert";
import { AttendanceStatusModal } from "@/components/AttendanceStatusModal";
import { useTodayAttendance } from "@/hooks/useTodayAttendance";
import { TodayStaffEntry } from "@/api/attendance";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LogIn, LogOut, Loader2, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAttendanceStatusColor, formatTime, calculateWorkHours, formatWorkHours } from "@/lib/attendanceUtils";
import { CheckInModal } from "@/components/modals/CheckInModal";
import { CheckOutModal } from "@/components/modals/CheckOutModal";
import { StatusReasonPanel } from "@/components/staff-attendance/StatusReasonPanel";
import { useAutoMarkAbsent } from "@/hooks/useAutoMarkAbsent";
import { useCurrentTime } from "@/hooks/useCurrentTime";
import { 
  useDailyAttendanceData, 
  useCheckInMutation, 
  useCheckOutMutation,
  useUpdateAttendanceMutation,
  clearDataCache
} from "@/hooks/useStaffAttendanceData";
import {
  createStaffMap,
  createStaffNameLookup,
  getWorkHours,
  calculateAttendanceStatus,
  getStatusDisplayInfo,
  canCheckIn,
  canCheckOut,
  getTodayString,
  isStaffInactive,
  formatDate
} from "@/utils/staffAttendanceUtils";
import { getCurrentAttendancePeriod } from "@/utils/attendancePeriodUtils";


export default function DailyAttendanceTab() {
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<{ staff: Staff; status: string; attendance?: StaffAttendanceRecord } | null>(null);
  const [alertModalStaff, setAlertModalStaff] = useState<TodayStaffEntry | null>(null);

  const queryClient = useQueryClient();
  const { data: todayData } = useTodayAttendance();
  const uncheckedStaff = todayData?.staff.filter((s) => !s.has_record) ?? [];
  
  // State for collapsible sections
  const [notArrivedOpen, setNotArrivedOpen] = useState(true);
  const [presentOpen, setPresentOpen] = useState(false);
  const [lateOpen, setLateOpen] = useState(true);
  const [absentOpen, setAbsentOpen] = useState(true);
  const [onLeaveOpen, setOnLeaveOpen] = useState(false);

  const today = getTodayString();
  const todayFormatted = formatDate(new Date(), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Use optimized data hooks
  const {
    staff,
    attendanceRecords,
    leaveRequests,
    settings,
    isLoading,
    error,
    refetch
  } = useDailyAttendanceData(today);

  // Mutations
  const checkInMutation = useCheckInMutation();
  const checkOutMutation = useCheckOutMutation();
  const updateAttendanceMutation = useUpdateAttendanceMutation();

  // Memoized optimized lookups
  const staffMap = useMemo(() => createStaffMap(staff), [staff]);
  const staffNameLookup = useMemo(() => createStaffNameLookup(staff), [staff]);
  const workHours = useMemo(() => getWorkHours(settings), [settings]);

  // Create attendance lookup map
  const attendanceMap = useMemo(() => {
    const map = new Map<string, StaffAttendanceRecord>();
    attendanceRecords.forEach(record => {
      map.set(record.staffId, record);
    });
    return map;
  }, [attendanceRecords]);

  // Use auto-mark absent hook
  const { checkAndMarkAbsent, checkPreviousDays } = useAutoMarkAbsent(
    staff,
    attendanceRecords,
    workHours,
    refetch
  );

  // Get current time that updates every minute
  const currentTime = useCurrentTime();
  
  // Get current attendance period
  const currentPeriod = getCurrentAttendancePeriod(currentTime, workHours);

  // Optimized get staff attendance
  const getStaffAttendance = useCallback((staffId: string) => {
    return attendanceMap.get(staffId);
  }, [attendanceMap]);

  // Optimized status calculation
  const calculateStatus = useCallback((attendance: StaffAttendanceRecord | undefined, staffId: string): string => {
    const staffMember = staffMap.get(staffId);
    return calculateAttendanceStatus(attendance, staffId, workHours, leaveRequests, settings, staffMember);
  }, [staffMap, workHours, leaveRequests, settings]);

  const handleCheckIn = useCallback((staffMember: Staff) => {
    setSelectedStaff(staffMember);
    setCheckInModalOpen(true);
  }, []);

  const handleCheckOut = useCallback((staffMember: Staff) => {
    setSelectedStaff(staffMember);
    setCheckOutModalOpen(true);
  }, []);

  const handleStatusClick = useCallback((staffMember: Staff, status: string, attendance?: StaffAttendanceRecord) => {
    if (status === 'present' || status === 'on_leave' || status === 'half_day' || status === 'checked_out' || status === 'inactive') {
      return;
    }
    setSelectedStatus({ staff: staffMember, status, attendance });
    setStatusPanelOpen(true);
  }, []);

  const handleReasonSubmit = async (reason: string) => {
    if (!selectedStatus) return;
    
    try {
      const attendanceRecord = attendanceMap.get(selectedStatus.staff.id);
      
      if (attendanceRecord) {
        await updateAttendanceMutation.mutate({
          id: attendanceRecord.id,
          updates: { remarks: reason }
        });
      }
    } catch (error) {
      console.error("Failed to save reason:", error);
    }
  };

  // Optimized status badge component - memoized to prevent re-renders
  const StatusBadge = useCallback(({ attendance, staffMember }: { attendance: StaffAttendanceRecord | undefined; staffMember: Staff }) => {
    const status = calculateStatus(attendance, staffMember.id);
    const { displayStatus, isClickable } = getStatusDisplayInfo(status);
    
    return (
      <Badge 
        variant={getAttendanceStatusColor(status)}
        className={isClickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}
        onClick={() => isClickable && handleStatusClick(staffMember, status, attendance)}
      >
        {displayStatus}
      </Badge>
    );
  }, [calculateStatus, handleStatusClick]);

  // Memoize staff list to prevent unnecessary re-renders
  const staffList = useMemo(() => staff.map((staffMember) => {
    const attendance = getStaffAttendance(staffMember.id);
    const status = calculateStatus(attendance, staffMember.id);
    const hasCheckedIn = !!attendance?.checkIn;
    const hasCheckedOut = !!attendance?.checkOut;
    const isInactive = isStaffInactive(staffMember);
    const canCheckInStaff = canCheckIn(attendance, status);
    const canCheckOutStaff = canCheckOut(attendance, status);

    return {
      staffMember,
      attendance,
      status,
      hasCheckedIn,
      hasCheckedOut,
      isInactive,
      canCheckInStaff,
      canCheckOutStaff
    };
  }), [staff, getStaffAttendance, calculateStatus]);

  // Group staff by status for scalable layout
  const staffByStatus = useMemo(() => {
    const groups = {
      notArrived: [] as typeof staffList,
      present: [] as typeof staffList,
      late: [] as typeof staffList,
      absent: [] as typeof staffList,
      onLeave: [] as typeof staffList,
      inactive: [] as typeof staffList,
      others: [] as typeof staffList
    };

    staffList.forEach((staff) => {
      switch (staff.status) {
        case 'pending':
          groups.notArrived.push(staff);
          break;
        case 'present':
        case 'checked_out':
        case 'early_departure':
          groups.present.push(staff);
          break;
        case 'late':
          groups.late.push(staff);
          break;
        case 'absent':
          groups.absent.push(staff);
          break;
        case 'on_leave':
        case 'half_day':
        case 'excused':
          groups.onLeave.push(staff);
          break;
        case 'inactive':
          groups.inactive.push(staff);
          break;
        default:
          groups.others.push(staff);
      }
    });

    return groups;
  }, [staffList]);

  const attendanceOverview = useMemo(() => {
    const activeStaffCount = staffList.filter((entry) => !entry.isInactive).length;
    const attendedCount = staffList.filter((entry) =>
      ['present', 'checked_out', 'late', 'half_day', 'early_departure'].includes(entry.status)
    ).length;
    const excludedCount = staffList.filter((entry) =>
      ['on_leave', 'excused'].includes(entry.status)
    ).length;
    const eligibleStaffCount = Math.max(activeStaffCount - excludedCount, 0);
    const attendanceRate = eligibleStaffCount > 0
      ? Math.round((attendedCount / eligibleStaffCount) * 100)
      : 0;

    return {
      activeStaffCount,
      attendedCount,
      eligibleStaffCount,
      attendanceRate,
    };
  }, [staffList]);

  // Compact table row component for checked-in staff
  const CompactStaffRow = ({ staff }: { staff: typeof staffList[0] }) => (
    <TableRow>
      <TableCell className="font-medium">
        {staff.staffMember.firstName} {staff.staffMember.lastName}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {staff.staffMember.position}
      </TableCell>
      <TableCell>
        <StatusBadge attendance={staff.attendance} staffMember={staff.staffMember} />
      </TableCell>
      <TableCell className="text-sm">
        {staff.attendance?.checkIn ? formatTime(staff.attendance.checkIn) : '-'}
      </TableCell>
      <TableCell className="text-sm">
        {staff.attendance?.checkOut ? formatTime(staff.attendance.checkOut) : '-'}
      </TableCell>
      <TableCell className="text-sm">
        {staff.attendance?.checkIn && staff.attendance?.checkOut 
          ? formatWorkHours(calculateWorkHours(staff.attendance.checkIn, staff.attendance.checkOut))
          : 'Incomplete'
        }
      </TableCell>
      <TableCell>
        {staff.status === 'on_leave' || staff.status === 'half_day' ? (
          <span className="text-sm text-muted-foreground italic">On active leave</span>
        ) : (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={staff.canCheckInStaff ? "default" : "outline"}
              onClick={() => handleCheckIn(staff.staffMember)}
              disabled={!staff.canCheckInStaff || staff.isInactive || checkInMutation.isLoading}
              className="h-8 px-2"
            >
              <LogIn className="h-3 w-3" />
            </Button>
            {!staff.canCheckOutStaff && !staff.isInactive && !checkOutMutation.isLoading && !staff.attendance?.checkIn ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCheckOut(staff.staffMember)}
                      disabled
                      className="h-8 px-2"
                    >
                      <LogOut className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Check-in required before check-out.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                size="sm"
                variant={staff.canCheckOutStaff ? "default" : "outline"}
                onClick={() => handleCheckOut(staff.staffMember)}
                disabled={!staff.canCheckOutStaff || staff.isInactive || checkOutMutation.isLoading}
                className="h-8 px-2"
              >
                <LogOut className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );

  if (isLoading) {
    return (
      <div className="space-y-6 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <QueryErrorState
        title="Could not load attendance data"
        description="Failed to fetch today's attendance. Please check your connection and try again."
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Today's Attendance</CardTitle>
            <CardDescription>{todayFormatted}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Alert for unchecked staff — only shown when unchecked_count > 0 */}
            {uncheckedStaff.length > 0 && (
              <AttendanceAlert
                uncheckedCount={uncheckedStaff.length}
                uncheckedStaff={uncheckedStaff}
                onMarkStaff={setAlertModalStaff}
              />
            )}

            {/* Global Attendance Overview */}
            <div className="bg-muted/30 border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Today's Attendance Overview</h3>
                <div className="text-sm text-muted-foreground">
                  {currentTime} • {currentPeriod.label}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="text-center p-3 bg-background rounded-lg border">
                  <div className="text-2xl font-bold text-green-600">{staffByStatus.present.length}</div>
                  <div className="text-sm text-green-600 dark:text-green-400 font-medium">Present</div>
                  <div className="text-xs text-muted-foreground">On time</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg border">
                  <div className="text-2xl font-bold text-yellow-600">{staffByStatus.late.length}</div>
                  <div className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Late</div>
                  <div className="text-xs text-muted-foreground">After start time</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg border">
                  <div className="text-2xl font-bold text-destructive">{staffByStatus.absent.length}</div>
                  <div className="text-sm text-destructive font-medium">Absent</div>
                  <div className="text-xs text-muted-foreground">No check-in</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg border">
                  <div className="text-2xl font-bold text-orange-600">{staffByStatus.notArrived.length}</div>
                  <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Not Arrived</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg border">
                  <div className="text-2xl font-bold text-blue-600">{staffByStatus.onLeave.length}</div>
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">On Leave</div>
                  <div className="text-xs text-muted-foreground">Approved</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg border">
                  <div className="text-2xl font-bold text-muted-foreground">{attendanceOverview.activeStaffCount}</div>
                  <div className="text-sm text-muted-foreground font-medium">Total Staff</div>
                  <div className="text-xs text-muted-foreground">Active only</div>
                </div>
              </div>
              
              {/* Attendance Rate */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Attendance Rate:</span>
                    <span className="ml-2 font-bold text-foreground">
                      {attendanceOverview.attendanceRate}%
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {attendanceOverview.attendedCount} of {attendanceOverview.eligibleStaffCount} eligible active staff attended
                  </div>
                </div>
              </div>
            </div>
            {/* Not Arrived — Compact Card View */}
            {staffByStatus.notArrived.length > 0 && (
              <Collapsible open={notArrivedOpen} onOpenChange={setNotArrivedOpen}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        NOT ARRIVED
                      </Badge>
                      <span className="text-sm font-normal text-muted-foreground">
                        ({staffByStatus.notArrived.length} staff)
                      </span>
                    </h3>
                    <ChevronDown className={`h-4 w-4 transition-transform ${notArrivedOpen ? '' : '-rotate-90'}`} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {staffByStatus.notArrived.map((staff) => {
                      const initials = `${staff.staffMember.firstName?.[0] ?? ''}${staff.staffMember.lastName?.[0] ?? ''}`.toUpperCase();
                      return (
                        <div
                          key={staff.staffMember.id}
                          className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm hover:shadow transition-shadow"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-orange-100 text-orange-700 text-xs font-semibold">
                              {initials || '?'}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="break-words text-sm font-semibold leading-tight">
                                {staff.staffMember.firstName} {staff.staffMember.lastName}
                              </span>
                              <span className="shrink-0">
                                <StatusBadge attendance={staff.attendance} staffMember={staff.staffMember} />
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-tight">
                              {staff.staffMember.position}
                            </p>
                          </div>

                          <div className="flex shrink-0 gap-1">
                            <Button
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleCheckIn(staff.staffMember)}
                              disabled={!staff.canCheckInStaff || staff.isInactive || checkInMutation.isLoading}
                            >
                              <LogIn className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              disabled
                            >
                              <LogOut className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Present - Compact Table View */}
            {staffByStatus.present.length > 0 && (
              <Collapsible open={presentOpen} onOpenChange={setPresentOpen}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-600 dark:border-green-400">
                        PRESENT
                      </Badge>
                      <span className="text-sm font-normal text-muted-foreground">
                        ({staffByStatus.present.length} staff)
                      </span>
                    </h3>
                    <ChevronDown className={`h-4 w-4 transition-transform ${presentOpen ? '' : '-rotate-90'}`} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Check-in</TableHead>
                          <TableHead>Check-out</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffByStatus.present.map((staff) => (
                          <CompactStaffRow key={staff.staffMember.id} staff={staff} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Late - Compact Table View */}
            {staffByStatus.late.length > 0 && (
              <Collapsible open={lateOpen} onOpenChange={setLateOpen}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 border-yellow-600 dark:border-yellow-400">
                        LATE
                      </Badge>
                      <span className="text-sm font-normal text-muted-foreground">
                        ({staffByStatus.late.length} staff)
                      </span>
                    </h3>
                    <ChevronDown className={`h-4 w-4 transition-transform ${lateOpen ? '' : '-rotate-90'}`} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Check-in</TableHead>
                          <TableHead>Check-out</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffByStatus.late.map((staff) => (
                          <CompactStaffRow key={staff.staffMember.id} staff={staff} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Absent - Compact Table View */}
            {staffByStatus.absent.length > 0 && (
              <Collapsible open={absentOpen} onOpenChange={setAbsentOpen}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Badge variant="destructive">
                        ABSENT
                      </Badge>
                      <span className="text-sm font-normal text-muted-foreground">
                        ({staffByStatus.absent.length} staff)
                      </span>
                    </h3>
                    <ChevronDown className={`h-4 w-4 transition-transform ${absentOpen ? '' : '-rotate-90'}`} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Check-in</TableHead>
                          <TableHead>Check-out</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffByStatus.absent.map((staff) => (
                          <CompactStaffRow key={staff.staffMember.id} staff={staff} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* On Leave - Compact Table View */}
            {staffByStatus.onLeave.length > 0 && (
              <Collapsible open={onLeaveOpen} onOpenChange={setOnLeaveOpen}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400">
                        ON LEAVE
                      </Badge>
                      <span className="text-sm font-normal text-muted-foreground">
                        ({staffByStatus.onLeave.length} staff)
                      </span>
                    </h3>
                    <ChevronDown className={`h-4 w-4 transition-transform ${onLeaveOpen ? '' : '-rotate-90'}`} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Check-in</TableHead>
                          <TableHead>Check-out</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffByStatus.onLeave.map((staff) => (
                          <CompactStaffRow key={staff.staffMember.id} staff={staff} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Empty State */}
            {staffByStatus.notArrived.length === 0 && 
             staffByStatus.present.length === 0 && 
             staffByStatus.late.length === 0 && 
             staffByStatus.absent.length === 0 && 
             staffByStatus.onLeave.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No staff records found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CheckInModal
        open={checkInModalOpen}
        onOpenChange={setCheckInModalOpen}
        staff={selectedStaff}
        onSuccess={() => {
          clearDataCache();
          refetch();
        }}
      />

      <CheckOutModal
        open={checkOutModalOpen}
        onOpenChange={setCheckOutModalOpen}
        staff={selectedStaff}
        onSuccess={() => {
          clearDataCache();
          refetch();
        }}
      />

      <StatusReasonPanel
        isOpen={statusPanelOpen}
        onClose={() => {
          setStatusPanelOpen(false);
          setSelectedStatus(null);
        }}
        status={selectedStatus?.status || ""}
        staffName={selectedStatus ? `${selectedStatus.staff.firstName} ${selectedStatus.staff.lastName}` : ""}
        checkInTime={selectedStatus?.attendance?.checkIn}
        workHours={getWorkHours(settings)}
        existingRemarks={selectedStatus?.attendance?.remarks}
        onReasonSubmit={handleReasonSubmit}
      />

      {alertModalStaff && (
        <AttendanceStatusModal
          staff={alertModalStaff}
          onClose={() => setAlertModalStaff(null)}
          onSuccess={() => {
            setAlertModalStaff(null);
            queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
            refetch();
          }}
        />
      )}
    </div>
  );
}
