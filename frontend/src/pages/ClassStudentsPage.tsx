import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
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
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  Users,
  GraduationCap,
  Search,
  AlertCircle,
} from "lucide-react";

const PAGE_SIZE = 20;

export default function ClassStudentsPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBursar = user?.role === "bursar";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["classWithStudents", classId, debouncedSearch, page],
    queryFn: () =>
      api.getClassWithStudents(classId!, {
        search: debouncedSearch,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: !!classId,
    placeholderData: keepPreviousData,
  });

  const cls = data?.class;
  const students = data?.students ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;

  const capacityPct =
    cls && cls.capacity > 0
      ? Math.min(Math.round((cls.studentCount / cls.capacity) * 100), 100)
      : 0;
  const isFull = cls ? cls.studentCount >= cls.capacity : false;

  if (isLoading) {
    return (
      <div className="p-0 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !cls) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/classes")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Classes
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load class</AlertTitle>
          <AlertDescription className="flex items-center justify-between mt-1">
            Failed to load class data. Check your connection.
            <Button variant="outline" size="sm" className="ml-4 shrink-0" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-0 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/classes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold">{cls.name}</h1>
            {cls.archivedAt && (
              <Badge variant="secondary" className="text-xs">Archived</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">Enrolled students</p>
        </div>
      </div>

      {/* Class metadata cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Homeroom Teacher
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="font-semibold">{cls.teacherName}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Progression
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {cls.isFinalClass ? (
              <Badge variant="destructive" className="text-xs">
                <GraduationCap className="h-3 w-3 mr-1" />
                Graduating
              </Badge>
            ) : cls.nextClass ? (
              <Badge variant="outline" className="text-xs">→ {cls.nextClass.name}</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Not configured</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Enrollment
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">
                {cls.studentCount} / {cls.capacity}
              </span>
              <span
                className={
                  isFull
                    ? "text-destructive font-medium"
                    : capacityPct >= 70
                    ? "text-yellow-600 font-medium"
                    : "text-green-600 font-medium"
                }
              >
                {capacityPct}%
              </span>
            </div>
            <Progress value={capacityPct} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Student list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Students
            <Badge variant="secondary">{cls.studentCount}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isBursar ? (
            <p className="text-sm text-muted-foreground italic">
              {cls.studentCount} student(s) enrolled. Contact an admin to view the full list.
            </p>
          ) : (
            <>
              {students.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or admission number…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
              )}

              {students.length === 0 && debouncedSearch ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No students match your search.
                </p>
              ) : students.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No students enrolled in this class.
                </p>
              ) : (
                <div className="relative overflow-x-auto">
                  {isFetching && (
                    <div className="absolute right-2 top-2 z-10 text-xs text-muted-foreground">
                      Loading…
                    </div>
                  )}
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Admission No.</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s, idx) => (
                      <TableRow
                        key={s.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/students/${s.id}`)}
                      >
                        <TableCell className="text-muted-foreground text-sm w-10">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                              {(s.firstName?.[0] ?? "?").toUpperCase()}
                            </div>
                            <span className="font-medium">
                              {s.firstName} {s.lastName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.admissionNumber || "—"}
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {s.gender || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={s.status === "active" ? "default" : "secondary"}
                            className="text-xs capitalize"
                          >
                            {s.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
              )}

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
                    {(() => {
                      const items: (number | string)[] = [];
                      if (totalPages <= 7) {
                        for (let i = 1; i <= totalPages; i++) items.push(i);
                      } else {
                        items.push(1);
                        if (page > 4) items.push('ellipsis-left');
                        const start = Math.max(2, page - 2);
                        const end = Math.min(totalPages - 1, page + 2);
                        for (let i = start; i <= end; i++) items.push(i);
                        if (page < totalPages - 3) items.push('ellipsis-right');
                        items.push(totalPages);
                      }
                      return items.map((p) =>
                        typeof p === 'string' ? (
                          <PaginationItem key={p}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink
                              isActive={p === page}
                              onClick={() => setPage(p)}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      );
                    })()}
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
        </CardContent>
      </Card>
    </div>
  );
}
