import { Badge } from '@/components/ui/badge';
import { BookOpen, User, Circle } from 'lucide-react';
import { Staff } from '@/types/dashboard';
import { cn } from '@/lib/utils';

export const getEmploymentStatusBadge = (employmentStatus: Staff['employmentStatus']) => {
  const status = employmentStatus || 'active';
  
  const isActive = status === 'active';
  const isProblematic = ['suspended', 'resigned'].includes(status);
  
  return (
    <div className="flex items-center gap-2">
      <Circle 
        className={cn(
          "h-2 w-2 fill-current",
          isActive && "text-green-500",
          status === 'on_leave' && "text-yellow-500",
          status === 'retired' && "text-gray-400",
          isProblematic && "text-red-500"
        )}
      />
      <span className={cn(
        "text-sm font-medium",
        isActive && "text-green-700 dark:text-green-400",
        status === 'on_leave' && "text-yellow-700 dark:text-yellow-400",
        status === 'retired' && "text-gray-600 dark:text-gray-400",
        isProblematic && "text-red-700 dark:text-red-400"
      )}>
        {status === 'active' && 'Active'}
        {status === 'on_leave' && 'On Leave'}
        {status === 'suspended' && 'Suspended'}
        {status === 'resigned' && 'Terminated'}
        {status === 'retired' && 'Retired'}
      </span>
    </div>
  );
};

export const getDepartmentBadge = (department: string) => {
  return (
    <Badge variant="outline" className="capitalize">
      {department}
    </Badge>
  );
};

export const getTeachingBadge = (isTeaching: boolean) => {
  return isTeaching ? (
    <Badge variant="default" className="gap-1">
      <BookOpen className="h-3 w-3" />
      Teaching
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1">
      <User className="h-3 w-3" />
      Non-Teaching
    </Badge>
  );
};
