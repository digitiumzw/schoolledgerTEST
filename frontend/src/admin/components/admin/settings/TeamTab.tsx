import { useState } from "react";
import { Plus, Trash2, RefreshCw, UserMinus, Users, Mail, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/admin/contexts/AuthContext";
import {
  useTeam, useInviteTeamMember, useRemoveTeamMember, useChangeTeamMemberRole,
  useDeactivateTeamMember, useResendInvite,
} from "@/admin/hooks/useSettings";

const ROLES = ["Owner", "Admin", "Finance", "Support"] as const;

type Member = {
  id: number;
  name: string;
  email: string;
  platform_role: string;
  status?: 'Active' | 'Invited' | 'Deactivated';
  last_login_at?: string | null;
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function StatusBadge({ status }: { status?: string }) {
  const v = status ?? 'Active';
  const cls =
    v === 'Active'      ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
    v === 'Invited'     ? 'border-amber-200 bg-amber-50 text-amber-700' :
                          'border-gray-200 bg-gray-50 text-gray-600';
  return <Badge variant="outline" className={`text-xs font-medium ${cls}`}>{v}</Badge>;
}

export function TeamTab() {
  const { user, can } = useAuth();
  const teamQ = useTeam();
  const invite = useInviteTeamMember();
  const remove = useRemoveTeamMember();
  const role   = useChangeTeamMemberRole();
  const deact  = useDeactivateTeamMember();
  const resend = useResendInvite();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", platform_role: "Admin" });

  const team: Member[] = (teamQ.data ?? []) as Member[];

  function submitInvite() {
    invite.mutate(inviteForm, {
      onSuccess: () => {
        setInviteOpen(false);
        setInviteForm({ name: "", email: "", platform_role: "Admin" });
      },
    });
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Platform team</CardTitle>
              <CardDescription className="text-xs">
                Manage who has access to the platform control panel.
              </CardDescription>
            </div>
          </div>
          {can('team.invite') && (
            <Button size="sm" onClick={() => setInviteOpen(true)} className="shrink-0 gap-1.5">
              <Plus className="h-4 w-4" />
              Invite member
            </Button>
          )}
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        {teamQ.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
            ))}
          </div>
        ) : team.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No team members yet</p>
            <p className="text-xs text-muted-foreground">Invite someone to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {team.map((m) => {
              const isSelf = user?.id === m.id;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials(m.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium leading-tight">{m.name}</p>
                      {isSelf && (
                        <Badge variant="outline" className="border-primary/20 bg-primary/5 text-xs text-primary">
                          You
                        </Badge>
                      )}
                      <StatusBadge status={m.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.email}</p>
                    {m.last_login_at && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                        Last login {new Date(m.last_login_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {can('team.change_role') && !isSelf ? (
                      <Select
                        defaultValue={m.platform_role}
                        onValueChange={(r) => role.mutate({ id: m.id, role: r })}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="text-xs">{m.platform_role}</Badge>
                    )}

                    {can('team.invite') && m.status === 'Invited' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Resend invite"
                        onClick={() => resend.mutate(m.id)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {can('team.deactivate') && !isSelf && m.status === 'Active' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-amber-600"
                            title="Deactivate member"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deactivate {m.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will revoke their access to the platform. You can reactivate them later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deact.mutate(m.id)}>
                              Deactivate
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {can('team.remove') && !isSelf && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Remove member"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {m.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes the team member. Audit log entries are preserved.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => remove.mutate(m.id)}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
            <DialogDescription>
              An invitation email will be sent. The member sets their own password on accept.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="invite-name" className="text-sm font-medium">
                Full name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="invite-name"
                  className="pl-9"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-email" className="text-sm font-medium">
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  className="pl-9"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-role" className="text-sm font-medium">
                Role
              </Label>
              <Select
                value={inviteForm.platform_role}
                onValueChange={(v) => setInviteForm((f) => ({ ...f, platform_role: v }))}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitInvite}
              disabled={invite.isPending || !inviteForm.name.trim() || !inviteForm.email.trim()}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {invite.isPending ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
