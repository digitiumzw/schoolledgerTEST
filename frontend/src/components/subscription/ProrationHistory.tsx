import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ProrationHistoryItem } from '../../api/api';

function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const dollars = Math.abs(cents) / 100;
  return `${sign}$${dollars.toFixed(2)}`;
}

const STATUS_LABELS: Record<ProrationHistoryItem['status'], string> = {
  calculated: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

const STATUS_COLORS: Record<ProrationHistoryItem['status'], string> = {
  calculated: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-800',
};

export function ProrationHistory() {
  const [page, setPage] = useState(1);
  const perPage = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['subscription', 'proration-history', page],
    queryFn: () => api.getProrationHistory(page, perPage),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse" aria-live="polite" aria-busy="true">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-red-600">Failed to load proration history.</p>
    );
  }

  if (!data || data.calculations.length === 0) {
    return (
      <p className="text-sm text-gray-500">No plan change history yet.</p>
    );
  }

  const totalPages = Math.ceil(data.total / perPage);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 pr-4 text-left font-medium text-gray-600">From</th>
              <th className="py-2 pr-4 text-left font-medium text-gray-600">To</th>
              <th className="py-2 pr-4 text-left font-medium text-gray-600">Cycle</th>
              <th className="py-2 pr-4 text-right font-medium text-gray-600">Net Amount</th>
              <th className="py-2 pr-4 text-left font-medium text-gray-600">Status</th>
              <th className="py-2 text-left font-medium text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.calculations.map(calc => (
              <tr key={calc.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 pr-4">{calc.originalPlanName}</td>
                <td className="py-2 pr-4">{calc.newPlanName}</td>
                <td className="py-2 pr-4 capitalize">{calc.billingCycle}</td>
                <td className={`py-2 pr-4 text-right font-medium ${calc.netAmountCents < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                  {formatCents(calc.netAmountCents)}
                </td>
                <td className="py-2 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[calc.status]}`}>
                    {STATUS_LABELS[calc.status]}
                  </span>
                </td>
                <td className="py-2 text-gray-500">
                  {new Date(calc.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
