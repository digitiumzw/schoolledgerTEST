/**
 * Charge Utility Functions
 * 
 * Helper functions for working with charges in the frontend.
 */

import { ChargeStatus, ChargeType } from "@/types/dashboard";

/**
 * Get CSS class for charge status badge
 */
export const getChargeStatusColor = (status: ChargeStatus): string => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'partial':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'pending':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'waived':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
};

/**
 * Get human-readable label for charge status
 */
export const getChargeStatusLabel = (status: ChargeStatus): string => {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'partial':
      return 'Partially Paid';
    case 'pending':
      return 'Pending';
    case 'waived':
      return 'Waived';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
};

/**
 * Get CSS class for charge type badge
 */
export const getChargeTypeColor = (chargeType: ChargeType): string => {
  switch (chargeType) {
    case 'fee_structure':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'transport':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'other':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
};

/**
 * Get human-readable label for charge type
 */
export const getChargeTypeLabel = (chargeType: ChargeType): string => {
  switch (chargeType) {
    case 'fee_structure':
      return 'Tuition';
    case 'transport':
      return 'Transport';
    case 'other':
      return 'Other';
    default:
      return chargeType;
  }
};

/**
 * Check if a charge is overdue
 */
export const isChargeOverdue = (dueDate: string | null | undefined, status: ChargeStatus): boolean => {
  if (!dueDate || status === 'paid' || status === 'waived' || status === 'cancelled') {
    return false;
  }
  return new Date(dueDate) < new Date();
};

/**
 * Calculate days until due or days overdue
 */
export const getDueDateInfo = (dueDate: string | null | undefined): { daysUntil: number; isOverdue: boolean } | null => {
  if (!dueDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    daysUntil: diffDays,
    isOverdue: diffDays < 0,
  };
};

/**
 * Format due date with status indicator
 */
export const formatDueDate = (dueDate: string | null | undefined, status: ChargeStatus): string => {
  if (!dueDate) return 'No due date';
  
  if (status === 'paid' || status === 'waived' || status === 'cancelled') {
    return new Date(dueDate).toLocaleDateString();
  }
  
  const info = getDueDateInfo(dueDate);
  if (!info) return new Date(dueDate).toLocaleDateString();
  
  const dateStr = new Date(dueDate).toLocaleDateString();
  
  if (info.isOverdue) {
    return `${dateStr} (${Math.abs(info.daysUntil)} days overdue)`;
  } else if (info.daysUntil === 0) {
    return `${dateStr} (Due today)`;
  } else if (info.daysUntil <= 7) {
    return `${dateStr} (${info.daysUntil} days left)`;
  }
  
  return dateStr;
};
