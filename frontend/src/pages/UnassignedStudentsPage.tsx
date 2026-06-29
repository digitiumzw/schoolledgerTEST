import { useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/api";
import { AssignClassModal } from "@/components/modals/AssignClassModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ArrowLeft,
  CheckSquare,
  Search,
  Users,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Student } from "@/types/dashboard";

const PAGE_SIZE = 25;

export default function UnassignedStudentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);

  const queryKey = ["students", "unassigned", page, debouncedSearch] as const;

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () =>
      api.getStudentsOptimized({
        status: "active",
        unassignedOnly: true,
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
        sortBy: "name",
        sortOrder: "asc",
      }),
    staleTime: 30 * 1000,
  });

  const students: Student[] = data?.students ?? [];
  const totalStudents: number = data?.pagination?.total ?? 0;
  const totalPages: number = data?.pagination?.totalPages ?? 1;

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        setDebouncedSearch(search);
        setPage(1);
      }
    },
    [search]
  );

  const allOnPageSelected = useMemo(
    () => students.length > 0 && students.every((s) => selected.has(s.id)),
    [students, selected]
  );

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        students.forEach((s) => next.delete(s.id));
      } else {
        students.forEach((s) => next.add(s.id));
      }
      return next;
    });
  }, [students, allOnPageSelected]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleAssignSuccess = useCallback(() => {
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["students", "unassigned"] });
    queryClient.invalidateQueries({ queryKey: ["students", "unassigned-count"] });
    toast({ title: "Done", description: "Students assigned and removed from this list." });
    if (page > 1 && students.length <= selected.size) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [queryClient, page, students.length, selected.size, toast]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  if (isError) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load unassigned students</AlertTitle>
          <AlertDescription>
            Check your connection and{" "}
            <button
              className="underline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["students", "unassigned"] })}
            >
              retry
            </button>
            .
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/classes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Unassigned Students
            </h1>
            <p className="text-muted-foreground text-sm">
              Active students not yet placed in a class
              {!isLoading && (
                <span className="ml-2 font-medium text-foreground">({totalStudents} total)</span>
              )}
            </p>
          </div>
        </div>

        <Button
          onClick={() => setShowAssignModal(true)}
          disabled={selected.size === 0}
        >
          <UserCheck className="mr-2 h-4 w-4" />
          Assign to Class
          {selected.size > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selected.size}
            </Badge>
          )}
        </Button>
      </div>

      {/* Empty state — no unassigned students at all */}
      {!isLoading && totalStudents === 0 && !debouncedSearch && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4 mb-4">
            <Users className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-lg font-semibold mb-1">All students are assigned</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Every active student has a class assignment. This page will reappear when new
            students are imported or their class is removed.
          </p>
          <Button asChild variant="outline">
            <Link to="/classes">Back to Classes</Link>
          </Button>
        </div>
      )}

      {/* Search + bulk select bar */}
      {(isLoading || totalStudents > 0 || debouncedSearch) && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or admission number…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckSquare className="h-4 w-4" />
                {selected.size} selected
                <button
                  className="text-destructive hover:underline ml-2"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all on page"
                      disabled={isLoading || students.length === 0}
                    />
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden sm:table-cell">Admission No.</TableHead>
                  <TableHead className="hidden md:table-cell">Gender</TableHead>
                  <TableHead className="hidden lg:table-cell">Date of Birth</TableHead>
                  <TableHead className="hidden lg:table-cell">Guardian</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-7 w-24 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  : students.map((student) => (
                      <TableRow
                        key={student.id}
                        className={selected.has(student.id) ? "bg-primary/5" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selected.has(student.id)}
                            onCheckedChange={() => toggleOne(student.id)}
                            aria-label={`Select ${student.firstName} ${student.lastName}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {student.firstName} {student.lastName}
                          </div>
                          {student.status !== "active" && (
                            <Badge variant="outline" className="text-[10px] mt-0.5">
                              {student.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell font-mono text-sm">
                          {student.admissionNumber || "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell capitalize text-sm">
                          {student.gender || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          {student.dateOfBirth || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          <div>{student.guardian?.name || "—"}</div>
                          {student.guardian?.phone && (
                            <div className="text-muted-foreground text-xs">
                              {student.guardian.phone}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelected(new Set([student.id]));
                              setShowAssignModal(true);
                            }}
                          >
                            Assign Class
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                {!isLoading && students.length === 0 && debouncedSearch && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No unassigned students match "{debouncedSearch}".
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-disabled={page === 1}
                    className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={p === page}
                        onClick={() => setPage(p)}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-disabled={page === totalPages}
                    className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}

      {/* Assign class modal */}
      <AssignClassModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        studentIds={selectedIds}
        onSuccess={handleAssignSuccess}
      />
    </div>
  );
}
