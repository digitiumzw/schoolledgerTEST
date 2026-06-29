import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Staff } from '@/types/dashboard';
import { getEmploymentStatusBadge, getDepartmentBadge, getTeachingBadge } from '@/components/staff-badges';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface StaffDesktopRowProps {
  member: Staff;
  onEdit: (member: Staff) => void;
  onDelete: (member: Staff) => void;
}

export const StaffDesktopRow = memo(({ member, onEdit, onDelete }: StaffDesktopRowProps) => {
  const navigate = useNavigate();
  const initials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase();
  
  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={member.avatar} alt={`${member.firstName} ${member.lastName}`} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <Button
              variant="ghost"
              className="p-0 h-auto font-semibold text-base hover:text-primary justify-start break-words whitespace-normal text-left"
              onClick={() => navigate(`/staff/${member.id}`)}
            >
              {member.firstName} {member.lastName}
            </Button>
            <p className="text-sm text-muted-foreground mt-0.5">{member.position}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{member.email}</TableCell>
      <TableCell className="text-muted-foreground">{member.phone}</TableCell>
      <TableCell>{getDepartmentBadge(member.department)}</TableCell>
      <TableCell>
        {getTeachingBadge(member.isTeaching)}
      </TableCell>
      <TableCell className="py-4">
        {getEmploymentStatusBadge(member.employmentStatus)}
      </TableCell>
      <TableCell className="w-[100px]">
        <TooltipProvider>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigate(`/staff/${member.id}`)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View profile</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(member)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(member)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </TableCell>
    </TableRow>
  );
});

StaffDesktopRow.displayName = 'StaffDesktopRow';
