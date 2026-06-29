import { Users, BookOpen, Award, GraduationCap } from "lucide-react";
import { MetricTile } from "@/components/dashboard/MetricTile";
import { DashboardStats } from "@/types/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface EnrolmentSectionProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function EnrolmentSection({ stats, loading }: EnrolmentSectionProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28 sm:h-32 rounded-lg" />)}
      </div>
    );
  }

  const totalStudents = stats?.totalStudents ?? 0;
  const totalClasses = stats?.totalClasses ?? 0;

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5">
      <MetricTile
        title="Total Students"
        value={totalStudents}
        icon={Users}
        description={totalStudents === 0 ? "No students yet" : "Active enrolment"}
        onClick={totalStudents === 0 ? () => navigate("/students") : undefined}
        tooltip="The number of currently enrolled, active students across all classes in your school."
      />
      <MetricTile
        title="Graduated Students"
        value={stats?.graduatedStudents ?? 0}
        icon={GraduationCap}
        description="Finished school"
        tooltip="The number of student records marked as graduated after finishing school."
      />
      <MetricTile
        title="Total Classes"
        value={totalClasses}
        icon={BookOpen}
        description={totalClasses === 0 ? "Add classes to get started" : "Active classes"}
        onClick={totalClasses === 0 ? () => navigate("/classes") : undefined}
        tooltip="The number of active, non-archived classes currently set up in your school."
      />
      <MetricTile
        title="Average Class Size"
        value={stats?.averageClassSize ?? 0}
        icon={Users}
        description="Students per class"
        tooltip="The average number of active students per class, calculated as total students divided by total classes."
      />
      <MetricTile
        title="On Bursary"
        value={stats?.studentsOnBursary ?? 0}
        icon={Award}
        description="Students with scholarship"
        tooltip="The number of students currently receiving a full or partial scholarship or bursary discount on their fees."
      />
    </div>
  );
}
