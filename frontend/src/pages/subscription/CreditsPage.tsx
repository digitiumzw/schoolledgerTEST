import { useNavigate } from 'react-router-dom';
import { useCredits } from '../../hooks/useCredits';
import { Credit } from '../../api/api';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const REASON_LABELS: Record<Credit['reason'], string> = {
  downgrade_proration: 'Downgrade Credit',
  upgrade_discount: 'Upgrade Discount',
  manual_adjustment: 'Manual Adjustment',
};

export default function CreditsPage() {
  const navigate = useNavigate();
  const { totalCreditsCents, credits, isLoading } = useCredits();

  return (
    <div className="container mx-auto max-w-3xl py-8 px-4">
      <div className="mb-6">
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline"
          onClick={() => navigate('/billing')}
        >
          &larr; Back to Billing
        </button>
        <h1 className="text-2xl font-bold mt-2">Account Credits</h1>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Total Available Credit</p>
          <p className="text-3xl font-bold text-green-600">{formatCents(totalCreditsCents)}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse" aria-live="polite" aria-busy="true">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded" />
          ))}
        </div>
      ) : credits.length === 0 ? (
        <p className="text-sm text-gray-500">No credits on your account.</p>
      ) : (
        <div className="space-y-3">
          {credits.map(credit => (
            <div
              key={credit.id}
              className="rounded-lg border border-gray-200 bg-white p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-sm">{REASON_LABELS[credit.reason]}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Added {new Date(credit.createdAt).toLocaleDateString()}
                  {credit.expiresAt && (
                    <> &middot; Expires {new Date(credit.expiresAt).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-700">{formatCents(credit.remainingAmountCents)}</p>
                {credit.remainingAmountCents < credit.initialAmountCents && (
                  <p className="text-xs text-gray-400">
                    of {formatCents(credit.initialAmountCents)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
