import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Student } from "@/types/dashboard";
import { Search, Users, ChevronLeft, ChevronRight, Users2, Loader2 } from "lucide-react";

interface Class {
  id: string;
  name: string;
  capacity?: number;
  studentCount?: number;
}

interface AssignStudentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: Class;
  onSuccess: () => void;
}

interface PaginatedResponse {
  students: Student[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function AssignStudentsModal({
  open,
  onOpenChange,
  classData,
  onSuccess,
}: AssignStudentsModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const queryClient = useQueryClient();

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showClassOnly, setShowClassOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse['pagination']>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0
  });
  const [capacityError, setCapacityError] = useState<{
    capacity: number;
    currentEnrolled: number;
    attemptingToAdd: number;
    available: number;
  } | null>(null);
  const { toast } = useToast();

  const pageSize = 25;

  // Debounced search function
  const debouncedSearch = useCallback(
    (term: string) => {
      setSearchTerm(term);
      setCurrentPage(1); // Reset to first page on new search
    },
    []
  );

  // Toggle class-only filter
  const toggleClassOnly = useCallback(() => {
    setShowClassOnly(prev => !prev);
    setCurrentPage(1); // Reset to first page when filter changes
  }, []);

  // Fetch students with pagination and search
  const fetchStudents = useCallback(async (page = 1, search = "", classOnly = false) => {
    try {
      setFetching(true);
      
      // Build query parameters
      const params: any = {
        page,
        limit: pageSize,
      };
      
      if (search.trim()) {
        params.search = search.trim();
      }
      
      if (classOnly) {
        params.classId = classData.id;
      }
      
      const response = await api.getStudentsOptimized(params);
      
      // Handle different response formats
      let studentsData: Student[] = [];
      let paginationData: any = {};
      
      if (Array.isArray(response)) {
        studentsData = response;
        paginationData = {
          page,
          limit: pageSize,
          total: response.length,
          totalPages: Math.ceil(response.length / pageSize)
        };
      } else if (response?.students && Array.isArray(response.students)) {
        studentsData = response.students;
        paginationData = response.pagination || {
          page,
          limit: pageSize,
          total: response.students?.length || 0,
          totalPages: Math.ceil((response.students?.length || 0) / pageSize)
        };
      } else if (response?.data && Array.isArray(response.data)) {
        studentsData = response.data;
        paginationData = response.pagination || paginationData;
      }
      
      setStudents(studentsData);
      setPagination(paginationData);
      
      // Pre-select students already in this class (only on first load and not filtering by class)
      if (page === 1 && !search && !classOnly) {
        const currentStudents = studentsData
          .filter((s) => s.classId === classData.id)
          .map((s) => s.id);
        setSelectedStudents(new Set(currentStudents));
      } else if (page === 1 && !search && classOnly) {
        // When filtering by class, select all students since they're all in this class
        const allStudents = studentsData.map((s) => s.id);
        setSelectedStudents(new Set(allStudents));
      }
      
    } catch (error) {
      console.error("Error fetching students:", error);
      toast({
        title: "Error",
        description: "Failed to load students",
        variant: "destructive",
      });
    } finally {
      setFetching(false);
    }
  }, [classData.id, pageSize, toast]);

  // Reset state when modal closes so it's clean on next open
  useEffect(() => {
    if (!open) {
      setSelectedStudents(new Set());
      setCurrentPage(1);
      setSearchTerm("");
      setShowClassOnly(false);
    }
  }, [open]);

  // Fetch on open and whenever filters/pagination change while open
  useEffect(() => {
    if (open) {
      fetchStudents(currentPage, searchTerm, showClassOnly);
    }
  }, [open, currentPage, searchTerm, showClassOnly, fetchStudents]);

  const handleToggleStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleSelectAllOnPage = () => {
    const currentPageIds = students.map(s => s.id);
    const newSelected = new Set(selectedStudents);
    
    // Check if all current page students are selected
    const allPageSelected = currentPageIds.every(id => newSelected.has(id));
    
    if (allPageSelected) {
      // Deselect all on current page
      currentPageIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all on current page
      currentPageIds.forEach(id => newSelected.add(id));
    }
    
    setSelectedStudents(newSelected);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Immediate search for better UX - could be debounced if needed
    debouncedSearch(value);
  };


  const handleSubmit = async (force = false) => {
    try {
      setLoading(true);
      setCapacityError(null);
      const result = await api.assignStudentsToClass(
        classData.id,
        Array.from(selectedStudents),
        force
      );

      toast({
        title: "Success",
        description: `${result.assignedCount || selectedStudents.size} student(s) assigned to ${classData.name}`,
      });

      queryClient.invalidateQueries({ queryKey: ['classWithStudents', classData.id] });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      if (error?.status === 409 && error?.errors) {
        // Capacity exceeded — show inline warning
        setCapacityError(error.errors);
      } else {
        toast({
          title: "Error",
          description: error?.message || "Failed to assign students. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Assign Students to {classData.name}</DialogTitle>
          <DialogDescription>
            Search and select students to assign to this class
            {classData.capacity != null && (
              <span className="ml-2 text-xs">
                — Capacity: {classData.studentCount ?? 0} / {classData.capacity} enrolled
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Capacity warning */}
        {capacityError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm space-y-2">
            <p className="font-medium text-destructive">Class capacity exceeded</p>
            <p className="text-muted-foreground">
              Only <strong>{capacityError.available}</strong> space(s) available (capacity {capacityError.capacity}, currently {capacityError.currentEnrolled} enrolled).
              You are trying to add <strong>{capacityError.attemptingToAdd}</strong> new student(s).
            </p>
            {isAdmin ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleSubmit(true)}
                disabled={loading}
              >
                {loading ? "Assigning..." : "Override Capacity & Assign Anyway"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Only administrators can override the capacity limit.
              </p>
            )}
          </div>
        )}

        {/* Search and Filter Controls */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students by name..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10"
              />
            </div>
            <Button
              variant={showClassOnly ? "default" : "outline"}
              size="sm"
              onClick={toggleClassOnly}
              className="whitespace-nowrap"
            >
              <Users2 className="h-4 w-4 mr-2" />
              Class Only
            </Button>
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {pagination.total > 0 
                ? `Showing ${((pagination.page - 1) * pagination.limit) + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} students${showClassOnly ? ' (in this class)' : ''}`
                : `No students found${showClassOnly ? ' (in this class)' : ''}`
              }
            </span>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{selectedStudents.size} selected</span>
            </div>
          </div>
        </div>

        {fetching ? (
          <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading students...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            {searchTerm 
              ? "No students match your search criteria"
              : "No students available"
            }
          </div>
        ) : (
          <>
            {/* Select All on Page */}
            <div className="flex items-center justify-between border-b pb-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAllOnPage}
                className="text-xs"
              >
                {students.every(s => selectedStudents.has(s.id)) 
                  ? "Deselect All on Page" 
                  : "Select All on Page"
                }
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
            </div>

            {/* Student List */}
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <Checkbox
                      id={student.id}
                      checked={selectedStudents.has(student.id)}
                      onCheckedChange={() => handleToggleStudent(student.id)}
                    />
                    <label
                      htmlFor={student.id}
                      className="flex-1 cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      <div>
                        {student.firstName} {student.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Current Class: {student.className || "Unassigned"}
                        {student.status && (
                          <span className="ml-2 px-2 py-1 rounded-full text-xs bg-muted">
                            {student.status}
                          </span>
                        )}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
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
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                {selectedStudents.size} student(s) selected
                {pagination.total > 0 && (
                  <span className="ml-2">
                    ({Math.round((selectedStudents.size / pagination.total) * 100)}% of total)
                  </span>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={loading || selectedStudents.size === 0}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Assigning..." : `Assign ${selectedStudents.size} Student(s)`}
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
