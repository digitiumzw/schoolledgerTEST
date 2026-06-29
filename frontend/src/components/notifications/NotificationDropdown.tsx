/**
 * ============================================
 * NOTIFICATION DROPDOWN - Dropdown Panel
 * ============================================
 * 
 * This component renders the dropdown panel that shows notifications
 * when the notification icon is clicked.
 * 
 * Features:
 * - Card-based layout for each notification
 * - Priority-based visual highlighting
 * - Category icons and badges
 * - Dismiss functionality
 * - "Mark all as read" action
 * - Empty state
 */

import { X, CheckCircle, Bell, Calendar, DollarSign, UserCheck, ClipboardCheck, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { DashboardNotification } from "@/api/api";

interface NotificationDropdownProps {
  notifications: DashboardNotification[];
  unreadCount: number;
  isLoading?: boolean;
  onDismiss: (id: string) => void;
  onNotificationClick?: (notification: DashboardNotification) => void;
}

export function NotificationDropdown({
  notifications,
  unreadCount,
  isLoading = false,
  onDismiss,
  onNotificationClick
}: NotificationDropdownProps) {
  // Priority-based styling
  const getSeverityClass = (severity: DashboardNotification["severity"]) => {
    switch (severity) {
      case "critical":
        return "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20";
      case "warning":
        return "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20";
      case "success":
        return "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20";
      case "info":
      default:
        return "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20";
    }
  };

  // Category icons
  const getCategoryIcon = (category: DashboardNotification["category"]) => {
    switch (category) {
      case "calendar":
        return Calendar;
      case "billing":
        return DollarSign;
      case "staff":
        return UserCheck;
      case "attendance":
        return ClipboardCheck;
      case "classes":
        return BookOpen;
      default:
        return Bell;
    }
  };

  // Sort notifications by priority (critical > warning > info > success)
  const sortedNotifications = [...notifications].sort((a, b) => {
    const priorityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
    return priorityOrder[a.severity] - priorityOrder[b.severity];
  });

  if (isLoading) {
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="text-sm">Loading notifications...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-80 max-h-96">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Notifications</CardTitle>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} unread
            </Badge>
          )}
        </div>
              </CardHeader>
      
      <CardContent className="p-0">
        {sortedNotifications.length === 0 ? (
          <div className="p-6 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground mt-1">
              You're all caught up!
            </p>
          </div>
        ) : (
          <ScrollArea className="h-80">
            <div className="p-2 space-y-2">
              {sortedNotifications.map((notification) => {
                const Icon = getCategoryIcon(notification.category);
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "relative rounded-lg border p-3 transition-shadow hover:shadow-sm cursor-pointer",
                      getSeverityClass(notification.severity)
                    )}
                    onClick={() => onNotificationClick?.(notification)}
                  >
                    {/* Dismiss button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismiss(notification.id);
                      }}
                      className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-md text-foreground/50 transition-colors hover:bg-black/5 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      aria-label={`Dismiss ${notification.title}`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>

                    {/* Notification content */}
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <Icon className="h-4 w-4 text-foreground/70" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-semibold text-sm leading-tight truncate">
                            {notification.title}
                          </p>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {notification.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {notification.message}
                        </p>
                        {notification.actionUrl && notification.actionLabel && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNotificationClick?.(notification);
                            }}
                          >
                            {notification.actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
