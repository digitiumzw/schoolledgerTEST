import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/api/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GraduationCap, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AcceptInvitePage() {
  const [searchParams]                  = useSearchParams();
  const navigate                        = useNavigate();
  const { toast }                       = useToast();
  const token                           = searchParams.get('token') ?? '';

  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');
  const [errors, setErrors]             = useState({ password: '', confirm: '' });
  const [isLoading, setIsLoading]       = useState(false);
  const [serverError, setServerError]   = useState('');
  const [success, setSuccess]           = useState(false);

  const validate = (): boolean => {
    const next = { password: '', confirm: '' };
    let ok = true;

    if (password.length < 8) {
      next.password = 'Password must be at least 8 characters';
      ok = false;
    }
    if (password !== confirm) {
      next.confirm = 'Passwords do not match';
      ok = false;
    }

    setErrors(next);
    return ok;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setServerError('');

    try {
      await api.acceptInvite(token, password);
      setSuccess(true);
      toast({
        title: 'Account ready',
        description: 'Your password has been set. You can now sign in.',
      });
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation Link</CardTitle>
            <CardDescription>
              This invitation link is missing or malformed. Please contact your administrator
              to request a new invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Back to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Accept Your Invitation</CardTitle>
            <CardDescription>
              Welcome to SchoolLedger! Set a password to activate your account.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your account is ready. Redirecting you to sign in…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Choose a password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={errors.password ? 'border-destructive' : ''}
                  autoFocus
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={errors.confirm ? 'border-destructive' : ''}
                />
                {errors.confirm && (
                  <p className="text-sm text-destructive">{errors.confirm}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Activating…' : 'Set Password & Continue'}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                After setting your password, you'll be redirected to the sign-in page.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
