import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ClassEnrollment } from "@/hooks/useDashboardStats";
import { cn } from "@/lib/utils";

interface EnrollmentByClassSectionProps {
  classes: ClassEnrollment[];
  loading: boolean;
}

export function EnrollmentByClassSection({ classes, loading }: EnrollmentByClassSectionProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">No classes configured</p>
    );
  }

  const totalStudents = classes.reduce((sum, c) => sum + c.total, 0);
  const totalMale = classes.reduce((sum, c) => sum + c.male, 0);
  const totalFemale = classes.reduce((sum, c) => sum + c.female, 0);

  return (
    <div className="space-y-3">
      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium">Class</th>
              <th className="px-4 py-2 text-center font-medium">
                <span className="flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Male
                </span>
              </th>
              <th className="px-4 py-2 text-center font-medium">
                <span className="flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
                  Female
                </span>
              </th>
              <th className="px-4 py-2 text-center font-medium">Total</th>
              <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">Gender Ratio</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => {
              const maleWidth = cls.total > 0 ? (cls.male / cls.total) * 100 : 0;
              const femaleWidth = cls.total > 0 ? (cls.female / cls.total) * 100 : 0;
              return (
                <tr key={cls.classId} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{cls.className}</td>
                  <td className="px-4 py-2 text-center text-blue-600 dark:text-blue-400 font-medium">
                    {cls.male}
                  </td>
                  <td className="px-4 py-2 text-center text-pink-600 dark:text-pink-400 font-medium">
                    {cls.female}
                  </td>
                  <td className="px-4 py-2 text-center font-semibold">{cls.total}</td>
                  <td className="px-4 py-2 hidden sm:table-cell">
                    {cls.total > 0 ? (
                      <div className="flex h-2 w-full max-w-[120px] rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500"
                          style={{ width: `${maleWidth}%` }}
                          title={`Male: ${cls.male}`}
                        />
                        <div
                          className="bg-pink-500"
                          style={{ width: `${femaleWidth}%` }}
                          title={`Female: ${cls.female}`}
                        />
                        {cls.other > 0 && (
                          <div
                            className="bg-gray-400"
                            style={{ width: `${100 - maleWidth - femaleWidth}%` }}
                            title={`Other: ${cls.other}`}
                          />
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Empty</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/50 font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-center text-blue-600 dark:text-blue-400">{totalMale}</td>
              <td className="px-4 py-2 text-center text-pink-600 dark:text-pink-400">{totalFemale}</td>
              <td className="px-4 py-2 text-center">{totalStudents}</td>
              <td className="px-4 py-2 hidden sm:table-cell">
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-blue-600 border-blue-300">
                    <Users className="h-3 w-3 mr-1" />
                    {totalStudents > 0 ? Math.round((totalMale / totalStudents) * 100) : 0}% M
                  </Badge>
                  <Badge variant="outline" className="text-pink-600 border-pink-300">
                    <Users className="h-3 w-3 mr-1" />
                    {totalStudents > 0 ? Math.round((totalFemale / totalStudents) * 100) : 0}% F
                  </Badge>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile: card list */}
      <div className="sm:hidden space-y-2">
        {classes.map((cls) => {
          const maleWidth = cls.total > 0 ? (cls.male / cls.total) * 100 : 0;
          const femaleWidth = cls.total > 0 ? (cls.female / cls.total) * 100 : 0;
          return (
            <div key={cls.classId} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{cls.className}</span>
                <span className="text-sm font-semibold shrink-0">{cls.total}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-blue-600 dark:text-blue-400 font-medium">{cls.male} M</span>
                <span className="text-pink-600 dark:text-pink-400 font-medium">{cls.female} F</span>
                {cls.other > 0 && <span className="text-muted-foreground">{cls.other} Other</span>}
              </div>
              {cls.total > 0 && (
                <div className="flex h-2 w-full rounded-full overflow-hidden">
                  <div className="bg-blue-500" style={{ width: `${maleWidth}%` }} />
                  <div className="bg-pink-500" style={{ width: `${femaleWidth}%` }} />
                  {cls.other > 0 && (
                    <div className="bg-gray-400" style={{ width: `${100 - maleWidth - femaleWidth}%` }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div className="rounded-lg border bg-muted/50 p-3 flex items-center justify-between text-sm font-semibold">
          <span>Total</span>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-blue-600 dark:text-blue-400">{totalMale} M</span>
            <span className="text-pink-600 dark:text-pink-400">{totalFemale} F</span>
            <span>{totalStudents}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
