import { useState, useMemo, useCallback } from "react";
import { subDays, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, format } from "date-fns";
import { StaffAttendanceRecord } from "@/types/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { getAttendanceStatusColor, formatTime, formatWorkHours } from "@/lib/attendanceUtils";
import { ManualAttendanceModal } from "@/components/modals/ManualAttendanceModal";
import { useIsMobile } from "@/hooks/use-mobile";
import { StatusReasonPanel } from "@/components/staff-attendance/StatusReasonPanel";
import { MobileCard } from "@/components/MobileCard";
import { MobileActionMenu, DropdownMenuItem } from "@/components/MobileActionMenu";
import { useWorkHours } from "@/hooks/useWorkHours";
import {
  usePagedStaffAttendance,
  useUpdateAttendanceMutation,
  useDeleteAttendanceMutation,
  useStaffAttendanceFilterMetadata,
} from "@/hooks/useStaffAttendanceData";
import { getStatusDisplayInfo } from "@/utils/staffAttendanceUtils";

const ITEMS_PER_PAGE = 20;

type DateRangePreset = 'all' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

export default function AttendanceRecordsTab() {
  // Dynamic filter metadata from backend
  const { data: filterMetadata } = useStaffAttendanceFilterMetadata();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StaffAttendanceRecord | null>(null);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<{ record: StaffAttendanceRecord; staffName: string } | null>(null);
  const isMobile = useIsMobile();
  const { workHours: staffWorkHours } = useWorkHours('staff');

  const updateMutation = useUpdateAttendanceMutation();
  const deleteMutation = useDeleteAttendanceMutation();

  // Convert date range preset to API date strings
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    switch (dateRangePreset) {
      case 'last7days':
        return { startDate: format(subDays(today, 6), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
      case 'last30days':
        return { startDate: format(subDays(today, 29), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
      case 'thisMonth':
        return { startDate: format(startOfMonth(today), 'yyyy-MM-dd'), endDate: format(endOfMonth(today), 'yyyy-MM-dd') };
      case 'lastMonth': {
        const lm = subMonths(today, 1);
        return { startDate: format(startOfMonth(lm), 'yyyy-MM-dd'), endDate: format(endOfMonth(lm), 'yyyy-MM-dd') };
      }
      case 'thisYear':
        return { startDate: format(startOfYear(today), 'yyyy-MM-dd'), endDate: format(endOfYear(today), 'yyyy-MM-dd') };
      case 'custom':
        if (customStartDate && customEndDate && customStartDate <= customEndDate) {
          return { startDate: format(customStartDate, 'yyyy-MM-dd'), endDate: format(customEndDate, 'yyyy-MM-dd') };
        }
        return { startDate: undefined, endDate: undefined };
      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [dateRangePreset, customStartDate, customEndDate]);

  const { records, pagination, summary, loading, refetch } = usePagedStaffAttendance({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    search,
    status: statusFilter,
    department: departmentFilter === 'all' ? undefined : departmentFilter,
    staffId: staffFilter === 'all' ? undefined : staffFilter,
    startDate,
    endDate,
  });

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setCurrentPage(1);
      setSearch(searchInput);
    }
  }, [searchInput]);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  const handleDepartmentFilterChange = useCallback((value: string) => {
    setDepartmentFilter(value);
    setStaffFilter('all'); // Reset staff filter when department changes
    setCurrentPage(1);
  }, []);

  const handleStaffFilterChange = useCallback((value: string) => {
    setStaffFilter(value);
    setCurrentPage(1);
  }, []);

  const handleDateRangeChange = useCallback((value: string) => {
    setDateRangePreset(value as DateRangePreset);
    setCurrentPage(1);
    if (value !== 'custom') {
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
    }
  }, []);

  const handleEdit = useCallback((record: StaffAttendanceRecord) => {
    setEditingRecord(record);
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const handleStatusClick = useCallback((record: StaffAttendanceRecord, staffName: string) => {
    if (record.status === 'present' || record.status === 'on_leave' || record.status === 'half_day') return;
    setSelectedStatus({ record, staffName });
    setStatusPanelOpen(true);
  }, []);

  const handleReasonSubmit = async (reason: string) => {
    if (!selectedStatus) return;
    updateMutation.mutate({ id: selectedStatus.record.id, updates: { remarks: reason } });
  };

  const getStatusBadge = useCallback((record: StaffAttendanceRecord, staffName: string) => {
    const status = record.status || 'pending';
    const { displayStatus, isClickable } = getStatusDisplayInfo(status);
    return (
      <Badge
        variant={getAttendanceStatusColor(status)}
        className={isClickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}
        onClick={() => isClickable && handleStatusClick(record, staffName)}
      >
        {displayStatus}
      </Badge>
    );
  }, [handleStatusClick]);

  const handleAddNew = useCallback(() => {
    setEditingRecord(null);
    setModalOpen(true);
  }, []);

  const filtersActive = search !== '' || statusFilter !== 'all' || departmentFilter !== 'all' || staffFilter !== 'all' || dateRangePreset !== 'all';

  const handleResetFilters = useCallback(() => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setStaffFilter('all');
    setDateRangePreset('all');
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
    setCurrentPage(1);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Attendance Records</CardTitle>
              <CardDescription>
                Historical attendance records
                <span className="ml-2 text-xs bg-muted px-2 py-1 rounded">
                  Staff Hours: {staffWorkHours.startTime} - {staffWorkHours.endTime}
                </span>
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add Record
              </Button>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                Manually add or correct attendance records (logged)
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by staff name… (press Enter)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
                <SelectItem value="half_day">Half Day</SelectItem>
                <SelectItem value="early_departure">Early Departure</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={handleDepartmentFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {filterMetadata?.departments?.map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={staffFilter} onValueChange={handleStaffFilterChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {filterMetadata?.staff
                  ?.filter((s) => departmentFilter === 'all' || s.department === departmentFilter)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={dateRangePreset} onValueChange={handleDateRangeChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="last7days">Last 7 Days</SelectItem>
                <SelectItem value="last30days">Last 30 Days</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={handleResetFilters} className="w-full sm:w-auto">
                Reset Filters
              </Button>
            )}
          </div>

          {dateRangePreset === 'custom' && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full sm:w-auto justify-start text-left font-normal", !customStartDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={customStartDate} onSelect={(date) => { setCustomStartDate(date); setCurrentPage(1); }} initialFocus />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full sm:w-auto justify-start text-left font-normal", !customEndDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={customEndDate} onSelect={(date) => { setCustomEndDate(date); setCurrentPage(1); }} initialFocus />
                </PopoverContent>
              </Popover>
              {customStartDate && customEndDate && customStartDate > customEndDate && (
                <p className="text-sm text-destructive self-center">Start date must be before end date</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Attendance Rate</p>
              <p className="text-lg font-semibold">{summary.attendanceRate}%</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Present / Late</p>
              <p className="text-lg font-semibold">{summary.present} / {summary.late}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Absent / Leave</p>
              <p className="text-lg font-semibold">{summary.absent} / {summary.onLeave}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Overtime</p>
              <p className="text-lg font-semibold">{summary.totalOvertimeHours.toFixed(1)}h</p>
            </div>
          </div>

          <div className="border rounded-lg">
            {loading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : isMobile ? (
              <div className="space-y-3 p-4">
                {records.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No attendance records found</p>
                ) : (
                  records.map((record) => {
                    const staffName = record.staffName ?? record.staffId;
                    return (
                      <MobileCard key={record.id}>
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold">{staffName}</p>
                              <p className="text-sm text-muted-foreground">{new Date(record.date).toLocaleDateString()}</p>
                            </div>
                            <MobileActionMenu>
                              <DropdownMenuItem onClick={() => handleEdit(record)}>
                                <Edit className="h-4 w-4 mr-2" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(record.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />Delete
                              </DropdownMenuItem>
                            </MobileActionMenu>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Check In</p>
                              <p className="font-medium">{record.checkIn ? formatTime(record.checkIn) : '-'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Check Out</p>
                              <p className="font-medium">{record.checkOut ? formatTime(record.checkOut) : '-'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Work Hours</p>
                              <p className="font-medium">
                                {record.workHours != null
                                  ? formatWorkHours(record.workHours)
                                  : 'Incomplete'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Status</p>
                              {getStatusBadge(record, staffName)}
                            </div>
                          </div>
                          {(record.comment || record.remarks) && (
                            <div className="pt-2 border-t text-sm">
                              <p className="text-muted-foreground">{record.comment ? 'Comment:' : 'Remarks:'}</p>
                              <p>{record.comment || record.remarks}</p>
                            </div>
                          )}
                        </div>
                      </MobileCard>
                    );
                  })
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Work Hours</TableHead>
                    <TableHead>Overtime</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks / Comment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No attendance records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record) => {
                      const staffName = record.staffName ?? record.staffId;
                      return (
                        <TableRow key={record.id}>
                          <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">{staffName}</TableCell>
                          <TableCell>{record.checkIn ? formatTime(record.checkIn) : '-'}</TableCell>
                          <TableCell>{record.checkOut ? formatTime(record.checkOut) : '-'}</TableCell>
                          <TableCell>
                            {record.workHours != null
                              ? formatWorkHours(record.workHours)
                              : 'Incomplete'}
                          </TableCell>
                          <TableCell>
                            {record.overtimeHours != null && record.overtimeHours > 0
                              ? `+${record.overtimeHours.toFixed(1)}h`
                              : '—'}
                          </TableCell>
                          <TableCell>{getStatusBadge(record, staffName)}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {record.comment || record.remarks || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(record)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(record.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="px-2">
            {pagination.total === 0 ? (
              <p className="text-sm text-muted-foreground">
                {filtersActive ? 'No records match your filters' : 'No attendance records found'}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
              </p>
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-end px-2">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm">Page {pagination.page} of {pagination.totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ManualAttendanceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        record={editingRecord}
        onSuccess={() => refetch()}
      />

      <StatusReasonPanel
        isOpen={statusPanelOpen}
        onClose={() => { setStatusPanelOpen(false); setSelectedStatus(null); }}
        status={selectedStatus?.record.status || ""}
        staffName={selectedStatus?.staffName || ""}
        checkInTime={selectedStatus?.record.checkIn}
        workHours={staffWorkHours || { startTime: "08:30", endTime: "17:00" }}
        existingRemarks={selectedStatus?.record.remarks}
        onReasonSubmit={handleReasonSubmit}
      />
    </div>
  );
}
