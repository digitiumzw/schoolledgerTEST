/**
 * ============================================
 * USE NOTIFICATIONS HOOK - Notification Management
 * ============================================
 * 
 * This hook manages notification state and functionality.
 * It leverages the existing useDashboardAggregation hook for data fetching
 * and adds notification-specific state management.
 * 
 * Features:
 * - Fetch notifications from existing /api/dashboard endpoint
 * - Manage read/unread state
 * - Handle dismiss actions
 * - Real-time refresh capability
 * - Integration with existing dashboard aggregation system
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardAggregation } from './useDashboardAggregation';
import type { DashboardNotification } from '@/api/api';

interface UseNotificationsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseNotificationsReturn {
  notifications: DashboardNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  dismissedIds: string[];
  dismissNotification: (id: string) => void;
  refreshNotifications: () => void;
  handleNotificationClick: (notification: DashboardNotification) => void;
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const { autoRefresh = true, refreshInterval = 30000 } = options;
  
  // Get dashboard data which includes notifications
  const { notifications: dashboardNotifications, isLoading, error, refetch } = useDashboardAggregation();
  
  // Local state for dismissed notifications
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    // Load dismissed IDs from localStorage on mount
    const saved = localStorage.getItem('schoolledger_dismissed_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  // Navigation for notification actions
  const navigate = useNavigate();

  // Filter out dismissed notifications
  const activeNotifications = useMemo(() => {
    if (!dashboardNotifications) return [];
    return dashboardNotifications.filter(n => !dismissedIds.includes(n.id));
  }, [dashboardNotifications, dismissedIds]);

  // Calculate unread count (notifications that haven't been dismissed)
  const unreadCount = useMemo(() => {
    return activeNotifications.length;
  }, [activeNotifications]);

  // Dismiss a notification
  const dismissNotification = useCallback((id: string) => {
    setDismissedIds(prev => {
      const updated = [...prev, id];
      // Save to localStorage
      localStorage.setItem('schoolledger_dismissed_notifications', JSON.stringify(updated));
      return updated;
    });
  }, []);

  
  // Refresh notifications
  const refreshNotifications = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle notification click
  const handleNotificationClick = useCallback((notification: DashboardNotification) => {
    // Dismiss the notification when clicked
    dismissNotification(notification.id);
    
    // Navigate to action URL if provided
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  }, [dismissNotification, navigate]);

  // Auto-refresh functionality
  useState(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      refreshNotifications();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshNotifications]);

  return {
    notifications: activeNotifications,
    unreadCount,
    isLoading,
    error,
    dismissedIds,
    dismissNotification,
    refreshNotifications,
    handleNotificationClick,
  };
}
