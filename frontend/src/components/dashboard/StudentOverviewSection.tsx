import { Users, BookOpen, GraduationCap, BarChart2, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardStats } from "@/types/dashboard";
import { ClassEnrollment } from "@/hooks/useDashboardStats";
import { EnrollmentByClassSection } from "./EnrollmentByClassSection";

interface StudentOverviewSectionProps {
  stats: DashboardStats | null;
  enrollmentByClass: ClassEnrollment[];
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
}

function MetricCard({ title, value, icon, description }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

export function StudentOverviewSection({ stats, enrollmentByClass }: StudentOverviewSectionProps) {
  const totalStudents = stats?.totalStudents ?? 0;
  const activeEnrollment = stats?.activeEnrollment ?? 0;
  const totalClasses = stats?.totalClasses ?? 0;
  const activeClasses = stats?.activeClasses ?? 0;
  const avgClassSize = stats?.avgClassSize ?? 0;
  const studentsOnBursary = stats?.studentsOnBursary ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Total Students"
          value={totalStudents}
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
          description="Active students"
        />
        <MetricCard
          title="Active Enrollment"
          value={activeEnrollment}
          icon={<GraduationCap className="h-4 w-4" aria-hidden="true" />}
          description="With active enrollment record"
        />
        <MetricCard
          title="Classes"
          value={`${activeClasses} / ${totalClasses}`}
          icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
          description="Active / Total classes"
        />
        <MetricCard
          title="Average Class Size"
          value={avgClassSize}
          icon={<BarChart2 className="h-4 w-4" aria-hidden="true" />}
          description="Students per class (avg)"
        />
        <MetricCard
          title="Students on Bursary"
          value={studentsOnBursary}
          icon={<Award className="h-4 w-4" aria-hidden="true" />}
          description="With active bursary"
        />
      </div>

      <div className="mt-2">
        <p className="text-sm font-medium text-muted-foreground mb-2">Enrollment by Class</p>
        <EnrollmentByClassSection classes={enrollmentByClass} loading={false} />
      </div>
    </div>
  );
}
