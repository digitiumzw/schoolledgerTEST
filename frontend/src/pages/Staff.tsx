import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SubscriptionGuard } from '@/components/subscription/SubscriptionGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Search, Plus, Pencil, Trash2, BookOpen, User, Mail, Phone, Eye, AlertCircle, QrCode, Download, Upload, GraduationCap, HelpCircle } from 'lucide-react';
import { api } from '@/api/api';
import { Staff } from '@/types/dashboard';
import { useStaffQuery } from '@/hooks/useStaffQuery';
import { StaffFormModal } from '@/components/modals/StaffFormModal';
import { DeleteStaffModal } from '@/components/modals/DeleteStaffModal';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import { MobileCard } from "@/components/MobileCard";
import { MobileActionMenu, DropdownMenuItem } from "@/components/MobileActionMenu";
import { getEmploymentStatusBadge, getDepartmentBadge, getTeachingBadge } from "@/components/staff-badges";
import { StaffMobileRow } from "@/components/staff/StaffMobileRow";
import { StaffDesktopRow } from "@/components/staff/StaffDesktopRow";
import { cn } from "@/lib/utils";
import ContextualHelpLink from "@/components/help/ContextualHelpLink";

const ITEMS_PER_PAGE = 20;

export default function StaffPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [teachingFilter, setTeachingFilter] = useState<string>('all');
  const [employmentStatusFilter, setEmploymentStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | undefined>();

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("staff-onboarding-dismissed");
    if (!dismissed) {
      setOnboardingOpen(true);
    }
  }, []);

  const handleDismissOnboarding = () => {
    if (dontShowAgain) {
      localStorage.setItem("staff-onboarding-dismissed", "true");
    }
    setOnboardingOpen(false);
    setDontShowAgain(false);
  };
  const [deletingStaff, setDeletingStaff] = useState<Staff | null>(null);
  const [generatingQRCodes, setGeneratingQRCodes] = useState(false);
  const [exporting, setExporting] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const isMobile = useIsMobile();

  const staffQuery = useStaffQuery({
    search: debouncedSearchQuery || undefined,
    department: departmentFilter !== 'all' ? departmentFilter : undefined,
    isTeaching: teachingFilter === 'teaching' ? 'yes' : teachingFilter === 'non-teaching' ? 'no' : undefined,
    employmentStatus: employmentStatusFilter !== 'all' ? employmentStatusFilter : undefined,
    page: currentPage,
    limit: ITEMS_PER_PAGE,
  });

  const staff = staffQuery.data?.data ?? [];
  const pagination = staffQuery.data?.pagination;
  const loading = staffQuery.isLoading;
  const totalPages = pagination?.totalPages ?? 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, departmentFilter, teachingFilter, employmentStatusFilter]);

  const handleBulkGenerateQRCodes = async () => {
    setGeneratingQRCodes(true);
    try {
      const withId = staff.filter(s => s.employeeId);
      if (withId.length === 0) {
        toast.error('No staff members have an Employee ID assigned.');
        return;
      }

      const [{ jsPDF }, QRCodeLib] = await Promise.all([
        import('jspdf'),
        import('qrcode').then(m => m.default),
      ]);
      const pdf = new jsPDF();

      let y = 20;
      const pageHeight = pdf.internal.pageSize.height;
      const lineHeight = 10;

      pdf.setFontSize(16);
      pdf.text('Staff QR Codes', 20, y);
      y += lineHeight * 2;

      pdf.setFontSize(10);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, y);
      y += lineHeight * 2;

      for (const s of withId) {
        if (y > pageHeight - 60) {
          pdf.addPage();
          y = 20;
        }

        pdf.setFontSize(12);
        pdf.text(`${s.firstName} ${s.lastName} (${s.employeeId})`, 20, y);
        y += lineHeight * 1.5;

        const qrDataUrl = await QRCodeLib.toDataURL(s.employeeId!, { width: 160, margin: 1 });
        pdf.addImage(qrDataUrl, 'PNG', 20, y, 40, 40);
        y += 50;
      }

      pdf.save('staff_qr_codes.pdf');

      toast.success(`Generated QR codes for ${withId.length} staff members`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate QR codes');
    } finally {
      setGeneratingQRCodes(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const teachingParam = teachingFilter === 'all' ? undefined :
        teachingFilter === 'teaching' ? 'yes' : 'no';

      const blob = await api.exportStaffCsv({
        department: departmentFilter === 'all' ? undefined : departmentFilter,
        employmentStatus: employmentStatusFilter === 'all' ? undefined : employmentStatusFilter,
        search: debouncedSearchQuery || undefined,
        isTeaching: teachingParam,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `staff_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success('Staff exported successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export staff');
    } finally {
      setExporting(false);
    }
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
          <PaginationItem key={`ellipsis-start`}>
            <PaginationEllipsis />
          </PaginationItem>
        );
      } else if (i === currentPage + 2 && showEllipsisEnd) {
        items.push(
          <PaginationItem key={`ellipsis-end`}>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Staff</h1>
            <p className="text-muted-foreground">Manage teaching and non-teaching staff</p>
          </div>
          <div className="flex items-center gap-2">
            <ContextualHelpLink sectionId="staff-management" label="Staff Management Help" />
            <Button variant="ghost" size="sm" onClick={() => setOnboardingOpen(true)} className="hidden sm:flex">
            <HelpCircle className="h-4 w-4 mr-2" />
            Staff guide
          </Button>
        </div>
        </div>

        <div className="bg-muted/30 rounded-xl border p-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <Input
                  placeholder="Quick search by name, email, or employee ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-11 text-base bg-background shadow-sm border-input focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline">Filters:</span>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full sm:w-[200px] h-10 bg-background shadow-sm border-input hover:bg-accent/50 transition-colors">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="Teaching Staff">Teaching Staff</SelectItem>
                  <SelectItem value="Administration">Administration</SelectItem>
                  <SelectItem value="Bursar">Bursar</SelectItem>
                  <SelectItem value="Security">Security</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={teachingFilter} onValueChange={setTeachingFilter}>
                <SelectTrigger className="w-full sm:w-[180px] h-10 bg-background shadow-sm border-input hover:bg-accent/50 transition-colors">
                  <SelectValue placeholder="Staff Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  <SelectItem value="teaching">Teaching Staff</SelectItem>
                  <SelectItem value="non-teaching">Non-Teaching Staff</SelectItem>
                </SelectContent>
              </Select>
              <Select value={employmentStatusFilter} onValueChange={setEmploymentStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px] h-10 bg-background shadow-sm border-input hover:bg-accent/50 transition-colors">
                  <SelectValue placeholder="Employment Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employment</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="resigned">Terminated</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
              {(departmentFilter !== 'all' || teachingFilter !== 'all' || employmentStatusFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDepartmentFilter('all');
                    setTeachingFilter('all');
                    setEmploymentStatusFilter('all');
                  }}
                  className="h-10 px-3 text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </Button>
              )}
            </div>
          </div>
        </div>

        {pagination && pagination.total > 0 && (departmentFilter !== 'all' || teachingFilter !== 'all' || employmentStatusFilter !== 'all' || debouncedSearchQuery) && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Showing {staff.length} of {pagination.total} staff members
              {debouncedSearchQuery && ` matching "${debouncedSearchQuery}"`}
              {departmentFilter !== 'all' || teachingFilter !== 'all' || employmentStatusFilter !== 'all' 
                ? ` with active filters` 
                : ''
              }
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Staff Member
          </Button>
          <Button
            variant="outline"
            onClick={handleBulkGenerateQRCodes}
            disabled={generatingQRCodes || staff.length === 0}
            className="w-full sm:w-auto"
          >
            {generatingQRCodes ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                Generating...
              </>
            ) : (
              <>
                <QrCode className="mr-2 h-4 w-4" />
                Generate QR Codes
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={exporting || (pagination?.total ?? 0) === 0}
            className="w-full sm:w-auto"
          >
            {exporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </>
            )}
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/staff/import">
              <Upload className="mr-2 h-4 w-4" />
              Bulk Import
            </Link>
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card">
          {isMobile ? (
            <div className="space-y-3 p-4">
              {staff.map((member) => (
                <StaffMobileRow
                  key={member.id}
                  member={member}
                  onEdit={setEditingStaff}
                  onDelete={setDeletingStaff}
                />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[350px]">Staff Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-12 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-[140px]" /></TableCell>
                    </TableRow>
                  ))
                ) : staff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No staff members found
                    </TableCell>
                  </TableRow>
                ) : (
                  staff.map((member) => (
                    <StaffDesktopRow
                      key={member.id}
                      member={member}
                      onEdit={setEditingStaff}
                      onDelete={setDeletingStaff}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {!loading && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, pagination?.total ?? 0)} of{' '}
              {pagination?.total ?? 0} staff members
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  />
                </PaginationItem>
                <span className="px-4 sm:hidden">Page {currentPage} of {totalPages}</span>
                <span className="hidden sm:inline-flex">{renderPaginationItems()}</span>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={
                      currentPage === totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <StaffFormModal
        open={showAddModal || !!editingStaff}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false);
            setEditingStaff(undefined);
          }
        }}
        staff={editingStaff}
        onSuccess={() => staffQuery.refetch()}
      />

      <DeleteStaffModal
        open={!!deletingStaff}
        onOpenChange={(open) => !open && setDeletingStaff(null)}
        staff={deletingStaff}
        onSuccess={() => staffQuery.refetch()}
      />

      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Getting Started with Staff
            </DialogTitle>
            <DialogDescription>
              How to manage your school&apos;s teaching and non-teaching staff.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {[
              ["1", "Add Staff", "Create profiles for teachers, administrators, bursars, security, and maintenance personnel. Each staff member gets an employee ID and department assignment.", User],
              ["2", "Teaching Flag", "Mark staff as teaching to include them in class-teacher assignments and teaching-related reports. Non-teaching staff are excluded from class rosters.", BookOpen],
              ["3", "Departments", "Organize staff by department (Teaching, Administration, Bursar, Security, Maintenance, or Other). This powers department-level filters and reports.", Mail],
              ["4", "Employment Status", "Track active, on-leave, suspended, or terminated status. Only active staff appear in daily attendance and class assignment dropdowns.", Phone],
              ["5", "QR Codes & Export", "Generate QR code sheets for quick check-in scanning, or export staff data to CSV for external reporting and payroll integration.", QrCode],
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
                id="st-dont-show-again"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label htmlFor="st-dont-show-again" className="text-sm cursor-pointer">
                Don&apos;t show this again
              </Label>
            </div>
            <Button onClick={handleDismissOnboarding}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SubscriptionGuard>
  );
}
