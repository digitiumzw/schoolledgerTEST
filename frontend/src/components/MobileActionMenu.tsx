import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { ReactNode } from "react";

interface MobileActionMenuProps {
  children: ReactNode;
}

/**
 * MobileActionMenu Component
 * 
 * A dropdown menu component optimized for mobile devices.
 * Consolidates multiple action buttons into a single menu to save screen space.
 * Uses a three-dot vertical icon (kebab menu) which is a familiar mobile pattern.
 */
export function MobileActionMenu({ children }: MobileActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover z-50">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { DropdownMenuItem };
