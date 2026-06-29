import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Users, ClipboardList, Settings2, Save, Globe, Mail, RefreshCw, Wrench, RotateCcw } from "lucide-react";
import { PageHeader } from "../components/admin/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getSettings, updateSettings } from "@/api/platform";
import { useAuth } from "@/admin/contexts/AuthContext";
import { AccountTab } from "@/admin/components/admin/settings/AccountTab";
import { TeamTab } from "@/admin/components/admin/settings/TeamTab";
import { AuditLogsTab } from "@/admin/components/admin/settings/AuditLogsTab";

const TABS = [
  { value: "account",    label: "Account",    icon: User },
  { value: "team",       label: "Team",       icon: Users },
  { value: "audit-logs", label: "Audit Logs", icon: ClipboardList },
  { value: "general",    label: "General",    icon: Settings2 },
  { value: "maintenance", label: "Maintenance", icon: Wrench },
];

export default function Settings() {
  const qc = useQueryClient();
  const { can } = useAuth();

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ["platform-settings"] });
    qc.invalidateQueries({ queryKey: ["platform-team"] });
    qc.invalidateQueries({ queryKey: ["platform-audit-logs"] });
  }

  const [generalForm, setGeneralForm] = useState({ support_email: "" });
  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenance_mode: false,
    maintenance_headline: "",
    maintenance_message: "",
  });

  const settingsQ = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => getSettings().then((r: { data: { data: Record<string, { value: unknown }> } }) => r.data.data),
  });

  useEffect(() => {
    if (!settingsQ.data) return;
    const d = settingsQ.data;
    setGeneralForm({
      support_email: String(d?.support_email?.value ?? ""),
    });
    setMaintenanceForm({
      maintenance_mode: Boolean(d?.maintenance_mode?.value ?? false),
      maintenance_headline: String(d?.maintenance_headline?.value ?? ""),
      maintenance_message: String(d?.maintenance_message?.value ?? ""),
    });
  }, [settingsQ.data]);

  const saveSettingsMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateSettings(data),
    onSuccess: () => {
      toast.success("Settings saved successfully");
      qc.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Failed to save settings"),
  });

  function submitGeneralSettings() {
    saveSettingsMut.mutate({
      support_email: { value: generalForm.support_email, type: "string", description: "Support contact email" },
    });
  }

  function submitMaintenanceSettings() {
    saveSettingsMut.mutate({
      maintenance_mode:     { value: maintenanceForm.maintenance_mode,     type: "boolean", description: "Whether maintenance mode is enabled (platform-wide)" },
      maintenance_headline: { value: maintenanceForm.maintenance_headline, type: "string",  description: "Custom headline for the maintenance notice" },
      maintenance_message:  { value: maintenanceForm.maintenance_message,  type: "string",  description: "Custom message body for the maintenance notice" },
    });
  }

  function resetMaintenanceDefaults() {
    setMaintenanceForm((f) => ({ ...f, maintenance_headline: "", maintenance_message: "" }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your platform configuration, team members, and activity logs."
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={settingsQ.isFetching}>
            <RefreshCw className={`h-4 w-4 ${settingsQ.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap gap-1.5 rounded-xl border bg-muted/40 p-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="account" className="mt-0">
          <AccountTab />
        </TabsContent>

        <TabsContent value="team" className="mt-0">
          <TeamTab />
        </TabsContent>

        <TabsContent value="audit-logs" className="mt-0">
          <AuditLogsTab />
        </TabsContent>

        <TabsContent value="maintenance" className="mt-0">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Platform Maintenance Mode</CardTitle>
                  <CardDescription>
                    Toggle maintenance mode to temporarily restrict tenant access. All tenant users see a maintenance notice. Platform admins retain full access.
                  </CardDescription>
                </div>
                {maintenanceForm.maintenance_mode && (
                  <Badge variant="destructive" className="gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                    Maintenance Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-6">
              {settingsQ.isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Enable maintenance mode</Label>
                      <p className="text-xs text-muted-foreground">
                        When enabled, all tenant users see a maintenance notice instead of the app.
                      </p>
                    </div>
                    <Switch
                      checked={maintenanceForm.maintenance_mode}
                      onCheckedChange={(checked) =>
                        setMaintenanceForm((f) => ({ ...f, maintenance_mode: checked }))
                      }
                      disabled={!can('settings.write')}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="maintenance-headline" className="text-sm font-medium">
                      Maintenance headline
                    </Label>
                    <Input
                      id="maintenance-headline"
                      value={maintenanceForm.maintenance_headline}
                      onChange={(e) =>
                        setMaintenanceForm((f) => ({ ...f, maintenance_headline: e.target.value }))
                      }
                      placeholder="Platform Under Maintenance"
                      disabled={!can('settings.write')}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave blank to use the default: "Platform Under Maintenance"
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="maintenance-message" className="text-sm font-medium">
                      Maintenance message
                    </Label>
                    <Textarea
                      id="maintenance-message"
                      value={maintenanceForm.maintenance_message}
                      onChange={(e) =>
                        setMaintenanceForm((f) => ({ ...f, maintenance_message: e.target.value }))
                      }
                      placeholder="The platform is currently under maintenance. Service will be restored shortly."
                      rows={3}
                      disabled={!can('settings.write')}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave blank to use the default message.
                    </p>
                  </div>

                  {can('settings.write') && (
                    <div className="flex items-center justify-between pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetMaintenanceDefaults}
                        disabled={saveSettingsMut.isPending}
                        className="gap-2 text-muted-foreground"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset to defaults
                      </Button>
                      <Button
                        onClick={submitMaintenanceSettings}
                        disabled={saveSettingsMut.isPending || settingsQ.isLoading}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {saveSettingsMut.isPending ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="mt-0">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Platform Identity</CardTitle>
              <CardDescription>
                Configure your platform's display name and primary support contact.
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              {settingsQ.isLoading ? (
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">Platform name</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/40 pl-9 pr-3 text-sm text-muted-foreground">
                        School Ledger
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">The platform name is fixed across the system and emails.</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="support-email" className="text-sm font-medium">
                      Support email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="support-email"
                        type="email"
                        className="pl-9"
                        value={generalForm.support_email}
                        onChange={(e) => setGeneralForm((f) => ({ ...f, support_email: e.target.value }))}
                        placeholder="support@schoolledger.com"
                        disabled={!can('settings.write')}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Used for outgoing notifications and replies.</p>
                  </div>
                  {can('settings.write') && (
                    <div className="md:col-span-2 flex justify-end pt-2">
                      <Button
                        onClick={submitGeneralSettings}
                        disabled={saveSettingsMut.isPending || settingsQ.isLoading}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {saveSettingsMut.isPending ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
