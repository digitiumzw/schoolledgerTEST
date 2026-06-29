import React from 'react';

interface BalanceDisplayProps {
  amount: number;
  currency?: string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function BalanceDisplay({ amount, currency = 'USD', isLoading, error, onRetry }: BalanceDisplayProps) {
  if (isLoading) {
    return <div className="animate-pulse h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>;
  }

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
        Balance unavailable
        {onRetry && (
          <button
            className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            onClick={onRetry}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const isCredit = amount < 0;
  const isZero = amount === 0;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(Math.abs(amount));

  const colorClass = isCredit
    ? 'text-green-600 dark:text-green-400'
    : isZero
      ? 'text-muted-foreground'
      : 'text-red-600 dark:text-red-400';

  return (
    <div className={`font-semibold ${colorClass}`}>
      {isCredit ? 'Credit: ' : 'Balance: '}
      {formattedAmount}
    </div>
  );
}
