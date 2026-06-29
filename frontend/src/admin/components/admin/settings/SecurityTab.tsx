import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/admin/contexts/AuthContext";
import {
  useLoginHistory,
  useSettings, useUpdateSettings,
} from "@/admin/hooks/useSettings";

type LoginEvent = {
  id: number;
  ip_address: string;
  user_agent: string;
  outcome: 'success' | 'failed';
  failure_reason: string | null;
  created_at: string;
};

export function SecurityTab() {
  const { can } = useAuth();
  const history  = useLoginHistory();
  const settings = useSettings();
  const update   = useUpdateSettings();

  const events: LoginEvent[] = (history.data ?? []) as LoginEvent[];

  const autoSuspend  = (settings.data as Record<string, { value: unknown }> | undefined)?.auto_suspend_failed_payment_threshold?.value as number | undefined;
  const weeklyDigest = !!(settings.data as Record<string, { value: unknown }> | undefined)?.weekly_security_digest_enabled?.value;

  return (
    <div className="space-y-6">
      {can('security.platform_toggles') && (
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Platform-wide security</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Auto-suspend after failed payments</Label>
                <p className="text-xs text-muted-foreground">Number of consecutive failed payments before auto-suspend.</p>
              </div>
              <Input
                type="number"
                className="w-24"
                defaultValue={autoSuspend ?? 0}
                onBlur={(e) => update.mutate({
                  auto_suspend_failed_payment_threshold: { value: Number(e.target.value), type: 'number', description: 'Auto-suspend threshold' },
                })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Weekly security digest</Label>
                <p className="text-xs text-muted-foreground">Email summary of audit-log activity.</p>
              </div>
              <Switch
                checked={weeklyDigest}
                onCheckedChange={(v) => update.mutate({
                  weekly_security_digest_enabled: { value: v, type: 'boolean', description: 'Weekly security digest' },
                })}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Login history</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {history.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : events.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No login events yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">IP</th>
                    <th className="px-3 py-2 text-left">Browser</th>
                    <th className="px-3 py-2 text-left">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="px-3 py-2">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{e.ip_address}</td>
                      <td className="px-3 py-2 max-w-xs truncate">{e.user_agent}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={e.outcome === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                          {e.outcome}
                          {e.failure_reason ? ` · ${e.failure_reason}` : ''}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
