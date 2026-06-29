import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MobileCard } from '@/components/MobileCard';
import { MobileActionMenu, DropdownMenuItem } from '@/components/MobileActionMenu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Plus, Pencil, Trash2, BookOpen, User, Mail, Phone, Eye } from 'lucide-react';
import { Staff } from '@/types/dashboard';
import { getStatusBadge, getEmploymentStatusBadge, getDepartmentBadge, getTeachingBadge } from '@/components/staff-badges';

interface StaffMobileRowProps {
  member: Staff;
  onEdit: (member: Staff) => void;
  onDelete: (member: Staff) => void;
}

export const StaffMobileRow = memo(({ member, onEdit, onDelete }: StaffMobileRowProps) => {
  const navigate = useNavigate();
  return (
    <MobileCard key={member.id}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/staff/${member.id}`)}
                  className="font-semibold justify-start p-0 h-auto hover:text-primary break-words whitespace-normal text-left"
                >
                  <Eye className="h-4 w-4 mr-2 flex-shrink-0" />
                  {member.firstName} {member.lastName}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View staff profile</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-sm text-muted-foreground">{member.position}</p>
          </div>
          <MobileActionMenu>
            <DropdownMenuItem onClick={() => navigate(`/staff/${member.id}`)}>
              <Eye className="h-4 w-4 mr-2" />
              View Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(member)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete(member)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </MobileActionMenu>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Position:</span>
            <span className="font-medium">{member.position}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Department:</span>
            <span>{getDepartmentBadge(member.department)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type:</span>
            <span>
              {getTeachingBadge(member.isTeaching)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Employment:</span>
            <span>{getEmploymentStatusBadge(member.employmentStatus)}</span>
          </div>
          <div className="flex flex-col gap-1 pt-2 border-t">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="text-xs">{member.email}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span className="text-xs">{member.phone}</span>
            </div>
          </div>
        </div>
      </div>
    </MobileCard>
  );
});

StaffMobileRow.displayName = 'StaffMobileRow';
