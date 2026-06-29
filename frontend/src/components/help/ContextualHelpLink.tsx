import { useNavigate } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { helpContent, isSectionVisibleToRole } from '@/lib/helpContent';
import { cn } from '@/lib/utils';

interface ContextualHelpLinkProps {
  sectionId: string;
  label?: string;
  className?: string;
}

export default function ContextualHelpLink({
  sectionId,
  label = 'Help',
  className,
}: ContextualHelpLinkProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const section = helpContent.sections.find((s) => s.id === sectionId);
  if (!section) return null;

  // Only render if current user's role can see this section
  if (!user || !isSectionVisibleToRole(section, user.role)) {
    return null;
  }

  const handleClick = () => {
    navigate(`/help?section=${sectionId}`);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className={cn(
              'inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className
            )}
            aria-label={label}
          >
            <CircleHelp className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
