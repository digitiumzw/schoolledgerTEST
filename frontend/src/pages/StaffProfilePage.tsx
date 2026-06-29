import { useState, useEffect, useCallback, useMemo } from 'react';
import { SubscriptionGuard } from '@/components/subscription/SubscriptionGuard';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar,
  Mail,
  Phone,
  MapPin,
  User,
  BookOpen,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Heart,
  ArrowLeft,
  Edit,
  Trash2,
  Briefcase,
  GraduationCap,
  Copy
} from 'lucide-react';
import { Staff, StaffAttendanceRecord, LeaveRequest } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { DeleteStaffModal } from '@/components/modals/DeleteStaffModal';
import { StaffFormModal } from '@/components/modals/StaffFormModal';
import {
  useStaffAttendanceSummary,
  useStaffAttendanceHistory,
  useStaffLeaveHistory,
  useTeacherClasses
} from '@/hooks/useStaffAttendanceData';
import { formatDate, calculateAttendanceStats } from '@/utils/staffAttendanceUtils';
import { VirtualizedList } from '@/components/VirtualizedList';
import { QRCodeDisplay } from '@/components/staff/QRCodeDisplay';

interface Role {
  title: string;
  department: string;
  startDate: string;
  description?: string;
}

// Move static functions outside component to avoid recreation
const getEmploymentStatusBadge = (employmentStatus: Staff['employmentStatus']) => {
  const variants = {
    active: 'default',
    on_leave: 'secondary',
    suspended: 'destructive',
    resigned: 'destructive',
    retired: 'destructive',
  } as const;

  const labels = {
    active: 'Active',
    on_leave: 'On Leave',
    suspended: 'Suspended',
    resigned: 'Terminated',
    retired: 'Retired',
  };

  const status = employmentStatus || 'active';

  return (
    <Badge variant={variants[status]} className="capitalize">
      {labels[status]}
    </Badge>
  );
};

const getAttendanceStatusBadge = (status: string) => {
  const statusConfig = {
    present: { variant: 'default' as const, color: 'text-green-700', bg: 'bg-green-100' },
    absent: { variant: 'destructive' as const, color: 'text-red-700', bg: 'bg-red-100' },
    late: { variant: 'secondary' as const, color: 'text-yellow-700', bg: 'bg-yellow-100' },
    on_leave: { variant: 'outline' as const, color: 'text-blue-700', bg: 'bg-blue-100' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.absent;

  return (
    <Badge variant={config.variant} className={cn('capitalize', config.color, config.bg)}>
      {status.replace('_', ' ')}
    </Badge>
  );
};

const getLeaveStatusBadge = (status: string) => {
  const variants = {
    pending: 'secondary',
    approved: 'default',
    rejected: 'destructive',
  } as const;

  return (
    <Badge variant={variants[status as keyof typeof variants]} className="capitalize">
      {status}
    </Badge>
  );
};

// Generate month options for the past 12 months - moved outside component
const generateMonthOptions = () => {
  const options = [];
  const currentDate = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}-${month}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value: yearMonth, label });
  }
  
  return options;
};

const monthOptions = generateMonthOptions();

const getStatusBadge = (percentage: number) => {
  if (percentage >= 90) {
    return <Badge className="bg-green-500">{percentage}%</Badge>;
  } else if (percentage >= 75) {
    return <Badge className="bg-yellow-500">{percentage}%</Badge>;
  } else {
    return <Badge variant="destructive">{percentage}%</Badge>;
  }
};

export default function StaffProfilePage() {

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingStaff, setEditingStaff] = useState<Staff | undefined>();
  const [deletingStaff, setDeletingStaff] = useState<Staff | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch attendance summary only for overview tab
  const { data: attendanceSummary, loading: attendanceLoading } = useStaffAttendanceSummary(
    id || '',
    selectedMonth,
    true, // Include trend data
    activeTab === 'overview' // Only fetch when overview tab is active
  );
  
  // Lazy load attendance history only when attendance tab is active
  const { data: attendanceHistory, loading: historyLoading } = useStaffAttendanceHistory(
    id || '',
    activeTab === 'attendance' // Only fetch when attendance tab is active
  );
  
  // Lazy load leave history only when leave tab is active
  const { data: leaveHistory, loading: leaveLoading } = useStaffLeaveHistory(
    id || '',
    activeTab === 'leave' // Only fetch when leave tab is active
  );

  // Fetch classes for teaching staff
  const { classes: teacherClasses, loading: classesLoading } = useTeacherClasses(
    id || '',
    staff?.isTeaching === true // Only fetch for teaching staff
  );

  // Memoize expensive attendance stats calculation
  const attendanceStats = useMemo(() => {
    return calculateAttendanceStats(attendanceHistory || []);
  }, [attendanceHistory]);

  // Memoize formatted hire date
  const formattedHireDate = useMemo(() => {
    if (!staff?.hireDate) return '';
    return formatDate(new Date(staff.hireDate), { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }, [staff?.hireDate]);

  // Memoize formatted date of birth
  const formattedDateOfBirth = useMemo(() => {
    if (!staff?.dateOfBirth) return 'Not specified';
    return formatDate(new Date(staff.dateOfBirth), { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }, [staff?.dateOfBirth]);

  // Memoize formatted selected month display
  const formattedSelectedMonth = useMemo(() => {
    return new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // Memoize month change handler
  const handleMonthChange = useCallback((value: string) => {
    console.log('Month selected:', value);
    setSelectedMonth(value);
  }, []);

  // Memoize tab change handler
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
  }, []);

  // Memoize attendance record renderer
  const renderAttendanceRecord = useCallback((record: StaffAttendanceRecord, index: number) => (
    <div key={record.id} className="flex items-center justify-between p-3 border rounded h-12">
      <div className="flex items-center gap-3">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span>{formatDate(new Date(record.date), { 
          weekday: 'short',
          month: 'short', 
          day: 'numeric' 
        })}</span>
      </div>
      <div className="flex items-center gap-2">
        {record.checkIn && (
          <span className="text-sm text-muted-foreground">
            In: {record.checkIn}
          </span>
        )}
        {record.checkOut && (
          <span className="text-sm text-muted-foreground">
            Out: {record.checkOut}
          </span>
        )}
        {getAttendanceStatusBadge(record.status)}
      </div>
    </div>
  ), []);

  // Memoize leave request renderer
  const renderLeaveRequest = useCallback((leave: LeaveRequest, index: number) => (
    <div key={leave.id} className="p-4 border rounded-lg">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="font-medium">{leave.reason || 'Leave Request'}</p>
          <p className="text-sm text-muted-foreground">
            {formatDate(new Date(leave.startDate), { 
              month: 'short', 
              day: 'numeric' 
            })} - {formatDate(new Date(leave.endDate), { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric'
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            Applied: {formatDate(new Date(leave.appliedDate), { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric'
            })}
          </p>
        </div>
        {getLeaveStatusBadge(leave.status)}
      </div>
      {leave.reviewNotes && (
        <p className="text-sm text-muted-foreground mt-2">
          Note: {leave.reviewNotes}
        </p>
      )}
    </div>
  ), []);

  const fetchStaffData = useCallback(async (staffId: string) => {
    setLoading(true);
    try {
      const { api } = await import('@/api/api');
      const staffData = await api.getStaffById(staffId);
      setStaff(staffData);
    } catch (error) {
      console.error('Failed to load staff profile:', error);
      navigate('/staff');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (id) {
      fetchStaffData(id);
    }
  }, [id, fetchStaffData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground mb-4">Staff member not found</p>
        <Button onClick={() => navigate('/staff')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Staff
        </Button>
      </div>
    );
  }

  return (
    <SubscriptionGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/staff')}
              className="flex items-center gap-2 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden xs:inline">Back to Staff</span>
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
                {staff.firstName} {staff.lastName}
              </h1>
              <p className="text-muted-foreground text-sm truncate">{staff.position}</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingStaff(staff)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeletingStaff(staff)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Overview Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={staff.avatar} alt={`${staff.firstName} ${staff.lastName}`} />
                <AvatarFallback className="text-2xl">
                  {staff.firstName[0]}{staff.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">
                    {staff.firstName} {staff.lastName}
                  </h3>
                  <p className="text-muted-foreground">{staff.position}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {getEmploymentStatusBadge(staff.employmentStatus)}
                    {staff.employeeId && (
                      <button
                        type="button"
                        title="Click to copy Employee ID"
                        onClick={() => navigator.clipboard.writeText(staff.employeeId!)}
                        className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded px-2 py-0.5 font-mono text-sm transition-colors"
                      >
                        {staff.employeeId}
                        <Copy className="w-3 h-3 ml-0.5 text-slate-500" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{staff.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{staff.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{staff.address || 'Harare, Zimbabwe'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Hired {formattedHireDate}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    <Briefcase className="w-3 h-3 mr-1" />
                    {staff.department}
                  </Badge>
                  <Badge variant={staff.isTeaching ? "default" : "secondary"}>
                    <GraduationCap className="w-3 h-3 mr-1" />
                    {staff.isTeaching ? 'Teaching Staff' : 'Non-Teaching Staff'}
                  </Badge>
                </div>

                {/* Assigned Classes - Only for teaching staff */}
                {staff.isTeaching && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Assigned Classes</h4>
                    {classesLoading ? (
                      <div className="space-y-2">
                        {[...Array(2)].map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    ) : teacherClasses && teacherClasses.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {teacherClasses.map((classItem: any) => (
                          <Badge key={classItem.id} variant="outline" className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {classItem.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No classes assigned</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-auto p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm py-2 px-2 sm:px-4 whitespace-normal break-words">
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="personal" className="text-xs sm:text-sm py-2 px-2 sm:px-4 whitespace-normal break-words">
              <span className="hidden sm:inline">Personal Information</span>
              <span className="sm:hidden">Personal</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs sm:text-sm py-2 px-2 sm:px-4 whitespace-normal break-words">
              <span className="hidden sm:inline">Attendance History</span>
              <span className="sm:hidden">Attendance</span>
            </TabsTrigger>
            <TabsTrigger value="leave" className="text-xs sm:text-sm py-2 px-2 sm:px-4 whitespace-normal break-words">
              <span className="hidden sm:inline">Leave History</span>
              <span className="sm:hidden">Leave</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Attendance Summary Header */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  Attendance — {formattedSelectedMonth}
                </h3>
                <p className="text-sm text-muted-foreground">Monthly attendance summary for {staff.firstName} {staff.lastName}</p>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="month-select" className="text-sm font-medium">Select Month:</label>
                <Select value={selectedMonth} onValueChange={handleMonthChange}>
                  <SelectTrigger id="month-select" className="w-[180px]">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Days</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{attendanceSummary?.totalDays || 0}</div>
                  <p className="text-xs text-muted-foreground">Recorded days</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Present</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{attendanceSummary?.present || 0}</div>
                  <p className="text-xs text-muted-foreground">Days present</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Late</CardTitle>
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{attendanceSummary?.late || 0}</div>
                  <p className="text-xs text-muted-foreground">Days late</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">On Leave</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{attendanceSummary?.onLeave || 0}</div>
                  <p className="text-xs text-muted-foreground">Days on leave</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
                  <div className="h-4 w-4 text-muted-foreground flex items-center justify-center">
                    <span className="text-xs font-bold">%</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {getStatusBadge(attendanceSummary?.attendanceRate || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Present rate
                    {attendanceSummary?.trend?.change?.attendanceRate !== undefined && (
                      <span className={cn(
                        "flex items-center gap-1",
                        attendanceSummary.trend.change.attendanceRate > 0 ? "text-green-600" : 
                        attendanceSummary.trend.change.attendanceRate < 0 ? "text-red-600" : "text-muted-foreground"
                      )}>
                        {attendanceSummary.trend.change.attendanceRate > 0 && "↑"}
                        {attendanceSummary.trend.change.attendanceRate < 0 && "↓"}
                        {Math.abs(attendanceSummary.trend.change.attendanceRate).toFixed(1)}%
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Month-over-Month Trend Comparison */}
            {attendanceSummary?.trend && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Month-over-Month Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">Current Month</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Attendance Rate:</span>
                          <span className="font-medium">{getStatusBadge(attendanceSummary.attendanceRate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Present Days:</span>
                          <span className="font-medium text-green-600">{attendanceSummary.present}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Late Days:</span>
                          <span className="font-medium text-yellow-600">{attendanceSummary.late}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">On Leave:</span>
                          <span className="font-medium text-blue-600">{attendanceSummary.onLeave}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">Previous Month</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Attendance Rate:</span>
                          <span className="font-medium">{getStatusBadge(attendanceSummary.trend?.previous?.attendanceRate ?? 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Present Days:</span>
                          <span className="font-medium text-green-600">{attendanceSummary.trend?.previous?.present ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Late Days:</span>
                          <span className="font-medium text-yellow-600">{attendanceSummary.trend?.previous?.late ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">On Leave:</span>
                          <span className="font-medium text-blue-600">{attendanceSummary.trend?.previous?.onLeave ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* QR Code Section */}
            <QRCodeDisplay
              employeeId={staff.employeeId ?? ''}
              staffName={`${staff.firstName} ${staff.lastName}`}
            />
          </TabsContent>

          {/* Personal Information Tab */}
          <TabsContent value="personal" className="space-y-4">
            {/* Personal Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Date of Birth:</span>
                      <span>{formattedDateOfBirth}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Address:</span>
                      <span>{staff.address || 'Not specified'}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Email:</span>
                      <span>{staff.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Phone:</span>
                      <span>{staff.phone}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Next of Kin */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="w-5 h-5" />
                  Next of Kin Information
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Emergency contact information for this staff member
                </p>
              </CardHeader>
              <CardContent>
                {staff.nextOfKin ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{staff.nextOfKin.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {staff.nextOfKin.relationship}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{staff.nextOfKin.phone}</span>
                      </div>
                      {staff.nextOfKin.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <span>{staff.nextOfKin.email}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 mt-0.5" />
                        <span>{staff.nextOfKin.address}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No next of kin information available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance History Tab */}
          <TabsContent value="attendance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Records</CardTitle>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : attendanceHistory && attendanceHistory.length > 0 ? (
                  <div className="space-y-2">
                    {attendanceHistory.length > 20 ? (
                      <VirtualizedList
                        items={attendanceHistory}
                        itemHeight={48}
                        containerHeight={400}
                        renderItem={renderAttendanceRecord}
                      />
                    ) : (
                      attendanceHistory.map((record) => renderAttendanceRecord(record, 0))
                    )}
                    {attendanceHistory.length > 20 && (
                      <p className="text-sm text-muted-foreground text-center pt-2">
                        Showing all {attendanceHistory.length} records
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No attendance records found
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leave History Tab */}
          <TabsContent value="leave" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Leave Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {leaveLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : leaveHistory && leaveHistory.length > 0 ? (
                  <div className="space-y-4">
                    {leaveHistory.length > 10 ? (
                      <VirtualizedList
                        items={leaveHistory}
                        itemHeight={120}
                        containerHeight={400}
                        renderItem={renderLeaveRequest}
                      />
                    ) : (
                      leaveHistory.map((leave) => renderLeaveRequest(leave, 0))
                    )}
                    {leaveHistory.length > 10 && (
                      <p className="text-sm text-muted-foreground text-center pt-2">
                        Showing all {leaveHistory.length} leave requests
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No leave requests found
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <StaffFormModal
        open={!!editingStaff}
        onOpenChange={(open) => {
          if (!open) {
            setEditingStaff(undefined);
          }
        }}
        staff={editingStaff}
        onSuccess={() => {
          if (id) {
            fetchStaffData(id);
          }
        }}
      />

      <DeleteStaffModal
        open={!!deletingStaff}
        onOpenChange={(open) => !open && setDeletingStaff(null)}
        staff={deletingStaff}
        onSuccess={() => navigate('/staff')}
      />
    </SubscriptionGuard>
  );
}
