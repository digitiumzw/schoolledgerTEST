import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Lock, Coins, CoinsIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useCurrencyConfig, useUpdateCurrencyConfig } from '@/hooks/useCurrencyConfig';
import { useExchangeRates, useCreateExchangeRate } from '@/hooks/useExchangeRates';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function CurrencySettingsTab() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'super_admin';
  const { toast } = useToast();

  const { data: config, isLoading: configLoading } = useCurrencyConfig();
  const updateMutation = useUpdateCurrencyConfig();

  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [newRate, setNewRate] = useState('');
  const [newRateDate, setNewRateDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: rates = [], isLoading: ratesLoading } = useExchangeRates(selectedCurrency);
  const createRateMutation = useCreateExchangeRate();

  const handleToggleMultiCurrency = (enabled: boolean) => {
    updateMutation.mutate({ multiCurrencyEnabled: enabled });
  };

  const handleToggleCurrency = (code: string, checked: boolean) => {
    if (!config) return;
    if (!checked) {
      // Attempting to disable — let the backend reject if there are dependent transactions
      const newEnabled = config.enabledCurrencies.filter((c) => c !== code);
      updateMutation.mutate({ enabledCurrencies: newEnabled });
    } else {
      const newEnabled = [...config.enabledCurrencies, code];
      updateMutation.mutate({ enabledCurrencies: newEnabled });
    }
  };

  const handleCreateRate = () => {
    if (!selectedCurrency || !newRate || !newRateDate) return;
    const rateValue = parseFloat(newRate);
    if (isNaN(rateValue) || rateValue <= 0) {
      toast({ title: 'Invalid rate', description: 'Rate must be a positive number', variant: 'destructive' });
      return;
    }
    createRateMutation.mutate(
      { currency: selectedCurrency, rateToBase: rateValue, effectiveDate: newRateDate },
      {
        onSuccess: () => {
          setNewRate('');
        },
      },
    );
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const multiCurrencyOn = config?.multiCurrencyEnabled ?? false;

  return (
    <div className="space-y-6">
      {/* Multi-Currency Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CoinsIcon className="h-5 w-5" />
            Multi-Currency Support
          </CardTitle>
          <CardDescription>
            Enable multi-currency support to allow transactions in currencies other than the base currency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium" htmlFor="multicurrency-toggle">
                Multi-Currency Support
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, staff can record charges and payments in additional currencies with exchange rate conversion.
                When disabled, only the base currency ({config?.baseCurrency ?? 'USD'}) is used for all transactions.
              </p>
            </div>
            <Switch
              id="multicurrency-toggle"
              checked={multiCurrencyOn}
              disabled={!canEdit || updateMutation.isPending}
              onCheckedChange={handleToggleMultiCurrency}
            />
          </div>
          {updateMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Base Currency & Enabled Currencies */}
      <Card className={!multiCurrencyOn ? 'opacity-60' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Currency Configuration
          </CardTitle>
          <CardDescription>
            Designate your base (accounting) currency and enable additional transaction currencies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Base Currency */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Base Currency</Label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-base px-3 py-1">
                {config?.baseCurrency ?? 'USD'}
              </Badge>
              {config?.baseCurrencyLocked && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Locked (transactions exist)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              The base currency is used for all ledger balances and accounting records. It cannot be changed once transactions have been recorded.
            </p>
          </div>

          {/* Enabled Currencies */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Enabled Transaction Currencies</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select currencies that staff can use when recording payments.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {config?.supportedCurrencies.map((code) => {
                const isEnabled = config.enabledCurrencies.includes(code);
                const isBase = code === config.baseCurrency;
                return (
                  <div key={code} className="flex items-center space-x-2">
                    <Checkbox
                      id={`curr-${code}`}
                      checked={isEnabled}
                      disabled={!canEdit || isBase || !multiCurrencyOn}
                      onCheckedChange={(checked) => handleToggleCurrency(code, checked === true)}
                    />
                    <Label htmlFor={`curr-${code}`} className="text-sm cursor-pointer">
                      {code}
                      {isBase && <span className="ml-1 text-xs text-muted-foreground">(base)</span>}
                    </Label>
                  </div>
                );
              })}
            </div>
            {!multiCurrencyOn && (
              <p className="text-xs text-muted-foreground italic mt-2">
                Enable multi-currency support above to configure additional transaction currencies.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Exchange Rate Management — only visible when multi-currency is enabled */}
      {multiCurrencyOn && (
        <Card>
          <CardHeader>
            <CardTitle>Exchange Rates</CardTitle>
            <CardDescription>
              Manage historical exchange rates for each enabled transaction currency.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Currency selector for rate management */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Select Currency to Manage Rates</Label>
              <div className="flex flex-wrap gap-2">
                {config?.enabledCurrencies
                  .filter((c) => c !== config.baseCurrency)
                  .map((code) => (
                    <Button
                      key={code}
                      variant={selectedCurrency === code ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCurrency(code)}
                    >
                      {code}
                    </Button>
                  ))}
                {config?.enabledCurrencies.filter((c) => c !== config.baseCurrency).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Enable a non-base currency above to manage its exchange rates.
                  </p>
                )}
              </div>
            </div>

            {selectedCurrency && (
              <>
                {/* Add new rate form */}
                {canEdit && (
                  <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                    <p className="text-sm font-medium">Add Exchange Rate</p>
                    <p className="text-xs text-muted-foreground">
                      Rate is expressed as: 1 {config?.baseCurrency} = X {selectedCurrency}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Rate (1 {config?.baseCurrency} = ?)</Label>
                        <Input
                          type="number"
                          step="0.000001"
                          placeholder="e.g. 1000"
                          value={newRate}
                          onChange={(e) => setNewRate(e.target.value)}
                          disabled={createRateMutation.isPending}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Effective Date</Label>
                        <Input
                          type="date"
                          value={newRateDate}
                          onChange={(e) => setNewRateDate(e.target.value)}
                          disabled={createRateMutation.isPending}
                        />
                      </div>
                      <Button
                        onClick={handleCreateRate}
                        disabled={createRateMutation.isPending || !newRate || !newRateDate}
                        className="gap-2"
                      >
                        {createRateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Add Rate
                      </Button>
                    </div>
                  </div>
                )}

                {/* Rate history table */}
                {ratesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : rates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No exchange rates recorded for {selectedCurrency} yet.
                  </p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Effective Date</th>
                          <th className="text-right px-3 py-2 font-medium">Rate (1 {config?.baseCurrency} =)</th>
                          <th className="text-left px-3 py-2 font-medium">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rates.map((rate) => (
                          <tr key={rate.id} className="border-t">
                            <td className="px-3 py-2">{rate.effectiveDate}</td>
                            <td className="px-3 py-2 text-right font-mono">
                              {rate.rateToBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">
                              {rate.createdAt ? new Date(rate.createdAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
