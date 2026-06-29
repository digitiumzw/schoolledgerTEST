import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, SchoolClass } from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { useToast } from "@/hooks/use-toast";
import ContextualHelpLink from "@/components/help/ContextualHelpLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Archive,
  Users,
  TrendingUp,
  Eye,
  Loader2,
  AlertCircle,
  Calendar,
  Search,
  GraduationCap,
  MoreHorizontal,
  School,
  BarChart3,
  BookOpen,
  UserX,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AddClassModal } from "@/components/modals/AddClassModal";
import { EditClassModal } from "@/components/modals/EditClassModal";
import { ArchiveClassModal } from "@/components/modals/ArchiveClassModal";
import { AssignStudentsModal } from "@/components/modals/AssignStudentsModal";
import { MigrationPreviewModal } from "@/components/modals/MigrationPreviewModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveSession } from "@/hooks/useActiveSession";
import { getRecommendedSession, getSessionOptions } from "@/utils/academicCalendar";

interface Teacher {
  id: string;
  name: string;
}

type SortField = 'progressionOrder' | 'name' | 'studentCount' | 'capacity' | 'teacherName' | 'createdAt';

// ─── Stat card ──────────────────────────────────────────────────────────────────

const StatCard = memo(
  ({
    icon: Icon,
    label,
    value,
    sub,
    color = "text-primary",
  }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    color?: string;
  }) => (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-lg bg-primary/10 p-2.5 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
);
StatCard.displayName = "StatCard";

// ─── Sort button ───────────────────────────────────────────────────────────────

const SortButton = memo(
  ({
    label,
    sortKey,
    currentSort,
    currentOrder,
    onSort,
  }: {
    label: string;
    sortKey: SortField;
    currentSort: SortField;
    currentOrder: 'asc' | 'desc';
    onSort: (key: SortField) => void;
  }) => {
    const isActive = currentSort === sortKey;
    return (
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {isActive ? (
          currentOrder === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    );
  }
);
SortButton.displayName = "SortButton";

// ─── Class list row ────────────────────────────────────────────────────────────

const ClassListRow = memo(
  ({
    cls,
    getTeacherName,
    isReadOnly,
    onAssign,
    onEdit,
    onArchive,
    onUnarchive,
    onOpen,
  }: {
    cls: SchoolClass;
    getTeacherName: (id: string | null) => string;
    isReadOnly: boolean;
    onAssign: (c: SchoolClass) => void;
    onEdit: (c: SchoolClass) => void;
    onArchive: (c: SchoolClass) => void;
    onUnarchive: (c: SchoolClass) => void;
    onOpen: (c: SchoolClass) => void;
  }) => {
    const pct = cls.capacity > 0 ? Math.round((cls.studentCount / cls.capacity) * 100) : 0;
    const isFull = cls.capacity > 0 && cls.studentCount >= cls.capacity;
    const teacherName = getTeacherName(cls.teacherId);

    return (
      <TableRow
        className="cursor-pointer group"
        onClick={() => onOpen(cls)}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <span className="truncate">{cls.name}</span>
            {cls.archivedAt && (
              <Badge variant="secondary" className="text-[10px] shrink-0">Archived</Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {teacherName}
        </TableCell>
        <TableCell>
          <span className="font-medium">{cls.studentCount}</span>
          <span className="text-muted-foreground"> / {cls.capacity}</span>
        </TableCell>
        <TableCell className="w-[140px]">
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span
                className={`font-semibold ${
                  isFull ? "text-destructive" : pct >= 70 ? "text-yellow-600" : "text-green-600"
                }`}
              >
                {pct}%
              </span>
            </div>
            <Progress value={Math.min(pct, 100)} className="h-1.5" />
          </div>
        </TableCell>
        <TableCell>
          {cls.isFinalClass ? (
            <Badge variant="destructive" className="text-[10px] gap-1">
              <GraduationCap className="h-3 w-3" />
              Graduating
            </Badge>
          ) : cls.nextClass ? (
            <Badge variant="outline" className="text-[10px]">
              → {cls.nextClass.name}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">Not configured</Badge>
          )}
        </TableCell>
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          {!isReadOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onOpen(cls)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Students
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAssign(cls)}>
                  <Users className="h-4 w-4 mr-2" />
                  Assign Students
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEdit(cls)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Class
                </DropdownMenuItem>
                {cls.archivedAt ? (
                  <DropdownMenuItem onClick={() => onUnarchive(cls)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Unarchive
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onArchive(cls)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TableCell>
      </TableRow>
    );
  }
);
ClassListRow.displayName = "ClassListRow";

// ─── Class list ────────────────────────────────────────────────────────────────

const ClassList = memo(
  ({
    classes,
    getTeacherName,
    isReadOnly,
    sortBy,
    sortOrder,
    onSort,
    onAssign,
    onEdit,
    onArchive,
    onUnarchive,
    onOpen,
  }: {
    classes: SchoolClass[];
    getTeacherName: (id: string | null) => string;
    isReadOnly: boolean;
    sortBy: SortField;
    sortOrder: 'asc' | 'desc';
    onSort: (key: SortField) => void;
    onAssign: (c: SchoolClass) => void;
    onEdit: (c: SchoolClass) => void;
    onArchive: (c: SchoolClass) => void;
    onUnarchive: (c: SchoolClass) => void;
    onOpen: (c: SchoolClass) => void;
  }) => (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>
              <SortButton label="Class" sortKey="name" currentSort={sortBy} currentOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortButton label="Teacher" sortKey="teacherName" currentSort={sortBy} currentOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortButton label="Students" sortKey="studentCount" currentSort={sortBy} currentOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead className="w-[140px]">Capacity</TableHead>
            <TableHead>Progression</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {classes.map((cls) => (
            <ClassListRow
              key={cls.id}
              cls={cls}
              getTeacherName={getTeacherName}
              isReadOnly={isReadOnly}
              onAssign={onAssign}
              onEdit={onEdit}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onOpen={onOpen}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
);
ClassList.displayName = "ClassList";

// ─── Empty state ────────────────────────────────────────────────────────────────

const EmptyState = memo(
  ({
    title,
    description,
    action,
  }: {
    title: string;
    description: string;
    action?: React.ReactNode;
  }) => (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <School className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {action}
    </div>
  )
);
EmptyState.displayName = "EmptyState";

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Classes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isReadOnly = user?.role === "teacher";
  const isBursar = user?.role === "bursar";

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classSummary, setClassSummary] = useState({
    totalStudents: 0,
    totalCapacity: 0,
    avgFill: 0,
    graduatingCount: 0,
    activeCount: 0,
    archivedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortField>('progressionOrder');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isMigrating, setIsMigrating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeSession, isFallback, isLoading: sessionLoading } = useActiveSession();

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("classes-onboarding-dismissed");
    if (!dismissed) {
      setOnboardingOpen(true);
    }
  }, []);

  const handleDismissOnboarding = () => {
    if (dontShowAgain) {
      localStorage.setItem("classes-onboarding-dismissed", "true");
    }
    setOnboardingOpen(false);
    setDontShowAgain(false);
  };

  const { data: unassignedData } = useQuery({
    queryKey: ['students', 'unassigned-count'],
    queryFn: () =>
      api.getStudentsOptimized({ status: 'active', unassignedOnly: true, limit: 1, page: 1 }),
    staleTime: 60 * 1000,
    enabled: !isReadOnly && !isBursar,
  });
  const unassignedCount: number = unassignedData?.pagination?.total ?? 0;

  const recommendedSession = useMemo(() => getRecommendedSession(), []);
  const inlineSessionOptions = useMemo(() => getSessionOptions(), []);

  const [inlineSession, setInlineSession] = useState<string>(() => getRecommendedSession());
  const [savingInlineSession, setSavingInlineSession] = useState(false);

  useEffect(() => {
    setInlineSession(activeSession ?? recommendedSession);
  }, [activeSession, recommendedSession]);

  const handleSetInlineSession = async () => {
    try {
      setSavingInlineSession(true);
      const currentSettings = await api.getSettings();
      await api.saveSettings({ ...currentSettings, activeAcademicSession: inlineSession });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({
        title: "Session updated",
        description: `Active session set to ${inlineSession}.`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to update session.", variant: "destructive" });
    } finally {
      setSavingInlineSession(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await api.getClassesDirectory({
        archived: activeTab === "archived" ? "true" : "false",
        search: searchQuery.trim() || undefined,
        includeTeachers: true,
        limit: 100,
        sortBy,
        sortOrder,
      });
      setClasses(response.classes);
      setClassSummary(response.summary);
      setTeachers((response.teachers ?? []).map((teacher) => ({ id: teacher.id, name: teacher.name })));
    } catch {
      setFetchError("Could not load classes. Check your connection.");
      toast({
        title: "Error",
        description: "Failed to load classes data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, sortBy, sortOrder, toast]);

  const refreshData = useCallback(async () => {
    await fetchData();
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'aggregation'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
  }, [fetchData, queryClient]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const displayClasses = classes;
  const stats = classSummary;

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleEditClass = useCallback((cls: SchoolClass) => {
    setSelectedClass(cls);
    setShowEditModal(true);
  }, []);

  const handleArchiveClass = useCallback(
    (cls: SchoolClass) => {
      if ((cls.studentCount ?? 0) > 0) {
        toast({
          title: "Cannot Archive Class",
          description: `This class has ${cls.studentCount} student(s) assigned. Remove all students before archiving.`,
          variant: "destructive",
        });
        return;
      }
      setSelectedClass(cls);
      setShowArchiveModal(true);
    },
    [toast]
  );

  const handleUnarchiveClass = useCallback(
    async (cls: SchoolClass) => {
      try {
        await api.unarchiveClass(cls.id);
        toast({ title: "Success", description: "Class unarchived successfully" });
        refreshData();
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to unarchive class.",
          variant: "destructive",
        });
      }
    },
    [toast, refreshData]
  );

  const handleAssignStudents = useCallback((cls: SchoolClass) => {
    setSelectedClass(cls);
    setShowAssignModal(true);
  }, []);

  const handleMigration = useCallback(async () => {
    setIsMigrating(true);
    try {
      const result = await api.promoteStudents();
      const promoted  = result.promoted  ?? 0;
      const graduated = result.graduated ?? 0;
      const skipped   = result.skipped   ?? 0;
      const errors: string[] = Array.isArray(result.errors) ? result.errors : [];

      const summaryParts: string[] = [`Promoted ${promoted} student(s)`];
      if (graduated > 0) summaryParts.push(`graduated ${graduated}`);
      if (skipped > 0)   summaryParts.push(`skipped ${skipped}`);

      const hadProblems = skipped > 0 || errors.length > 0;
      toast({
        title: hadProblems ? "Migration Completed with Issues" : "Migration Successful",
        description:
          summaryParts.join(", ") + "." +
          (errors.length > 0
            ? `\nFirst issue: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}`
            : ""),
        variant: hadProblems ? "destructive" : "default",
      });

      if (errors.length > 0) {
        console.warn("[promote] backend reported issues:", errors);
      }

      await refreshData();
    } catch (error) {
      toast({
        title: "Migration Failed",
        description: error instanceof Error ? error.message : "Failed to migrate students.",
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
    }
  }, [toast, refreshData]);

  const handleOpenDetail = useCallback((cls: SchoolClass) => {
    navigate(`/classes/${cls.id}/students`);
  }, [navigate]);

  const getTeacherName = useMemo(() => {
    const map = new Map(teachers.map((t) => [t.id, t.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Unassigned") : "Unassigned");
  }, [teachers]);

  const handleSort = useCallback((key: SortField) => {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  }, [sortBy]);

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header skeleton */}
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-7 w-12" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Class list skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="rounded-lg border">
            <div className="border-b px-4 py-3 flex items-center gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="border-b px-4 py-3.5 flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-1.5 w-20 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SubscriptionGuard>
    <TooltipProvider>
    <div className="p-4 sm:p-6 space-y-6">
      {/* Fetch error */}
      {fetchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load classes</AlertTitle>
          <AlertDescription className="flex items-center justify-between mt-1">
            {fetchError}
            <Button variant="outline" size="sm" className="ml-4 shrink-0" onClick={fetchData}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Unassigned students alert */}
      {unassignedCount > 0 && !isReadOnly && !isBursar && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <UserX className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle>
            {unassignedCount} active student{unassignedCount !== 1 ? 's' : ''} not assigned to a class
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between mt-1">
            <span>
              These students were likely imported but haven't been placed in a class yet.
            </span>
            <Button asChild size="sm" className="ml-4 shrink-0 bg-amber-700 hover:bg-amber-800 text-white">
              <Link to="/classes/unassigned">View &amp; Assign</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Session warning */}
      {!sessionLoading && !activeSession && !isReadOnly && !isBursar && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No active academic session configured</AlertTitle>
          <AlertDescription className="space-y-3 mt-1">
            <span>Student migration requires an active session. Set one before running a promotion.</span>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[180px] space-y-1">
                <Label htmlFor="inline-session-select" className="text-xs font-medium">
                  Select session
                </Label>
                <Select
                  value={inlineSession}
                  onValueChange={setInlineSession}
                  disabled={savingInlineSession}
                >
                  <SelectTrigger id="inline-session-select" className="bg-background text-foreground">
                    <SelectValue placeholder="Select session…" />
                  </SelectTrigger>
                  <SelectContent>
                    {inlineSessionOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSetInlineSession}
                disabled={savingInlineSession}
                className="shrink-0"
              >
                {savingInlineSession ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Set Session"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Page header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Classes</h1>
            <ContextualHelpLink sectionId="class-management" label="Class Management Help" />
            {sessionLoading ? (
              <Skeleton className="h-5 w-28" />
            ) : activeSession ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-xs font-normal gap-1 cursor-default"
                  >
                    <Calendar className="h-3 w-3" />
                    {activeSession}
                    {isFallback && <span className="text-muted-foreground ml-0.5">(fallback)</span>}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {isFallback
                    ? "Session derived from legacy settings. Configure in Settings → General."
                    : `Active academic session: ${activeSession}`}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Badge variant="secondary" className="text-xs font-normal">
                No session
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {isReadOnly ? "Your assigned classes" : "Manage classes, enrollment, and student promotion"}
          </p>
        </div>

        {!isReadOnly && !isBursar && (
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" size="sm" onClick={() => setOnboardingOpen(true)} className="hidden sm:flex">
              <HelpCircle className="h-4 w-4 mr-2" />
              Classes guide
            </Button>
            <Button
              onClick={() => {
                if (!activeSession) {
                  toast({
                    title: "No active session configured",
                    description: "Set an active academic session in Settings before running a migration.",
                    variant: "destructive",
                  });
                  return;
                }
                setShowMigrationModal(true);
              }}
              variant="outline"
              className="flex-1 sm:flex-none"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Promote
            </Button>
            <Button onClick={() => setShowAddModal(true)} className="flex-1 sm:flex-none">
              <Plus className="mr-2 h-4 w-4" />
              Add Class
            </Button>
          </div>
        )}
      </div>

      {/* ── Summary stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={School}
          label="Total Classes"
          value={classSummary.activeCount}
          sub={classSummary.archivedCount > 0 ? `${classSummary.archivedCount} archived` : undefined}
        />
        <StatCard
          icon={Users}
          label="Total Enrolled"
          value={stats.totalStudents}
          sub="across all active classes"
          color="text-blue-600"
        />
        <StatCard
          icon={BarChart3}
          label="Avg. Capacity"
          value={`${stats.avgFill}%`}
          sub={
            stats.avgFill >= 90
              ? "Near full capacity"
              : stats.avgFill >= 70
              ? "Good utilization"
              : "Room available"
          }
          color={stats.avgFill >= 90 ? "text-destructive" : stats.avgFill >= 70 ? "text-yellow-600" : "text-green-600"}
        />
        <StatCard
          icon={GraduationCap}
          label="Graduating"
          value={stats.graduatingCount}
          sub={stats.graduatingCount === 1 ? "final class" : "final classes"}
          color="text-purple-600"
        />
      </div>

      {/* ── Tabs + Search ──────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="active" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Active
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-semibold">
                {classSummary.activeCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-1.5">
              <Archive className="h-3.5 w-3.5" />
              Archived
              {classSummary.archivedCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-semibold">
                  {classSummary.archivedCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search classes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Active classes tab */}
        <TabsContent value="active">
          {displayClasses.length === 0 ? (
            searchQuery ? (
              <EmptyState
                title="No results"
                description={`No active classes match "${searchQuery}".`}
              />
            ) : (
              <EmptyState
                title="No classes yet"
                description="Create your first class to start managing enrollment and student placement."
                action={
                  !isReadOnly ? (
                    <Button onClick={() => setShowAddModal(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Class
                    </Button>
                  ) : undefined
                }
              />
            )
          ) : (
            <ClassList
              classes={displayClasses}
              getTeacherName={getTeacherName}
              isReadOnly={isReadOnly}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              onAssign={handleAssignStudents}
              onEdit={handleEditClass}
              onArchive={handleArchiveClass}
              onUnarchive={handleUnarchiveClass}
              onOpen={handleOpenDetail}
            />
          )}
        </TabsContent>

        {/* Archived classes tab */}
        <TabsContent value="archived">
          {displayClasses.length === 0 ? (
            searchQuery ? (
              <EmptyState
                title="No results"
                description={`No archived classes match "${searchQuery}".`}
              />
            ) : (
              <EmptyState
                title="No archived classes"
                description="Classes you archive will appear here. You can restore them at any time."
              />
            )
          ) : (
            <ClassList
              classes={displayClasses}
              getTeacherName={getTeacherName}
              isReadOnly={isReadOnly}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              onAssign={handleAssignStudents}
              onEdit={handleEditClass}
              onArchive={handleArchiveClass}
              onUnarchive={handleUnarchiveClass}
              onOpen={handleOpenDetail}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}
      <AddClassModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={refreshData}
        teachers={teachers}
        classes={classes}
      />
      {selectedClass && (
        <>
          <EditClassModal
            open={showEditModal}
            onOpenChange={setShowEditModal}
            classData={selectedClass}
            onSuccess={refreshData}
            teachers={teachers}
            classes={classes}
          />
          <ArchiveClassModal
            open={showArchiveModal}
            onOpenChange={setShowArchiveModal}
            classData={selectedClass}
            onSuccess={refreshData}
          />
          <AssignStudentsModal
            open={showAssignModal}
            onOpenChange={setShowAssignModal}
            classData={selectedClass}
            onSuccess={refreshData}
          />
        </>
      )}
      <MigrationPreviewModal
        open={showMigrationModal}
        onOpenChange={setShowMigrationModal}
        onConfirm={handleMigration}
      />

      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Getting Started with Classes
            </DialogTitle>
            <DialogDescription>
              How to organise classes, manage enrollment, and promote students.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {[
              ["1", "Create Classes", "Add classes with a name, grade/form level, capacity, and an assigned class teacher. Classes form the backbone of student enrollment and attendance.", School],
              ["2", "Assign Students", "Enroll students into classes individually or in bulk. Each active student should belong to exactly one class for accurate reporting and fee generation.", Users],
              ["3", "Academic Session", "Set an active academic session (e.g., 2026) before performing promotions. The session drives year-end migration and class-level reporting.", Calendar],
              ["4", "Promote Students", "At year end, run the promotion workflow to move students to the next grade/form. Graduating students are archived and the rest advance automatically.", TrendingUp],
              ["5", "Archive & Restore", "Archive classes that are no longer active instead of deleting them. Archived classes remain visible for historical records but no longer accept new enrollments.", Archive],
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
                id="cl-dont-show-again"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label htmlFor="cl-dont-show-again" className="text-sm cursor-pointer">
                Don&apos;t show this again
              </Label>
            </div>
            <Button onClick={handleDismissOnboarding}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
    </SubscriptionGuard>
  );
}
