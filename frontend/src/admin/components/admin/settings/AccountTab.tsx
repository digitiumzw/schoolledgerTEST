import { useEffect, useState } from "react";
import { User, Mail, Lock, KeyRound, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/admin/contexts/AuthContext";
import { useUpdateAccount, useUpdatePassword } from "@/admin/hooks/useSettings";

export function AccountTab() {
  const { user, setUser } = useAuth();
  const updateAccount = useUpdateAccount();
  const updatePassword = useUpdatePassword();

  const [profile, setProfile] = useState({ name: "", email: "" });
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", new_password_confirmation: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) setProfile({ name: user.name, email: user.email });
  }, [user]);

  function saveProfile() {
    const e: Record<string, string> = {};
    if (!profile.name.trim()) e.name = "Name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) e.email = "Valid email required";
    setErrors(e);
    if (Object.keys(e).length) return;

    updateAccount.mutate(profile, {
      onSuccess: (res: { data: { data: { id: number; name: string; email: string } } }) => {
        const updated = res.data?.data;
        if (updated && user) setUser({ ...user, name: updated.name, email: updated.email });
      },
    });
  }

  function savePassword() {
    const e: Record<string, string> = {};
    if (!pwd.current_password) e.current_password = "Current password required";
    if (pwd.new_password.length < 8) e.new_password = "Minimum 8 characters";
    if (pwd.new_password !== pwd.new_password_confirmation) e.new_password_confirmation = "Passwords do not match";
    setErrors(e);
    if (Object.keys(e).length) return;

    updatePassword.mutate(pwd, {
      onSuccess: () => {
        setPwd({ current_password: "", new_password: "", new_password_confirmation: "" });
        setErrors({});
      },
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Profile card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Profile</CardTitle>
              <CardDescription className="text-xs">Update your display name and email address.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-2">
            <Label htmlFor="display-name" className="text-sm font-medium">
              Display name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="display-name"
                className="pl-9"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                placeholder="Your name"
              />
            </div>
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="account-email" className="text-sm font-medium">
              Email address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="account-email"
                type="email"
                className="pl-9"
                value={profile.email}
                onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com"
              />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="flex justify-end pt-1">
            <Button onClick={saveProfile} disabled={updateAccount.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {updateAccount.isPending ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Password</CardTitle>
              <CardDescription className="text-xs">Choose a strong password of at least 8 characters.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-2">
            <Label htmlFor="current-password" className="text-sm font-medium">
              Current password
            </Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="current-password"
                type="password"
                className="pl-9"
                value={pwd.current_password}
                onChange={(e) => setPwd((p) => ({ ...p, current_password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            {errors.current_password && <p className="text-xs text-destructive">{errors.current_password}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-password" className="text-sm font-medium">
              New password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="new-password"
                type="password"
                className="pl-9"
                value={pwd.new_password}
                onChange={(e) => setPwd((p) => ({ ...p, new_password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            {errors.new_password && <p className="text-xs text-destructive">{errors.new_password}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password" className="text-sm font-medium">
              Confirm new password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm-password"
                type="password"
                className="pl-9"
                value={pwd.new_password_confirmation}
                onChange={(e) => setPwd((p) => ({ ...p, new_password_confirmation: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            {errors.new_password_confirmation && <p className="text-xs text-destructive">{errors.new_password_confirmation}</p>}
          </div>
          <div className="flex justify-end pt-1">
            <Button onClick={savePassword} disabled={updatePassword.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {updatePassword.isPending ? "Saving…" : "Change password"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
