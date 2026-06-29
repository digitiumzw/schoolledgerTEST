import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvite } from "@/api/platform";
import { toast } from "sonner";

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) setError("Missing invitation token. Please use the link from your email.");
  }, [token]);

  async function submit() {
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    setError("");
    setSubmitting(true);
    try {
      await acceptInvite(token, password, confirmation);
      toast.success("Account activated. You can now sign in.");
      navigate("/platform-control-panel/login");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })
        ?.response?.data?.message
        ?? (e as { message?: string })?.message
        ?? "Failed to accept invitation";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader>
          <CardTitle>Accept your invitation</CardTitle>
          <p className="text-sm text-muted-foreground">Set a password to activate your platform admin account.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>New password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Confirm password</Label>
            <Input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={submit} disabled={submitting || !token}>
            {submitting ? "Activating…" : "Activate account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
