/**
 * ============================================
 * NOTIFICATION ICON - Bell Icon with Badge
 * ============================================
 * 
 * This component renders a bell icon in the header with a notification badge.
 * It shows the count of unread/important notifications and opens the dropdown panel.
 * 
 * Features:
 * - Bell icon from Lucide React
 * - Badge counter for unread notifications
 * - Click handler to toggle dropdown
 * - Responsive design
 * - Loading states
 */

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NotificationIconProps {
  unreadCount: number;
  isLoading?: boolean;
  onClick: () => void;
  className?: string;
}

export function NotificationIcon({ 
  unreadCount, 
  isLoading = false, 
  onClick, 
  className 
}: NotificationIconProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={isLoading}
      aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      className={cn("h-9 w-9 relative", className)}
    >
      {/* Bell icon */}
      <Bell className="h-5 w-5" />
      
      {/* Badge for unread count */}
      {unreadCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </div>
      )}
      
      {/* Screen reader text */}
      <span className="sr-only">
        {isLoading ? 'Loading notifications' : `Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      </span>
    </Button>
  );
}
