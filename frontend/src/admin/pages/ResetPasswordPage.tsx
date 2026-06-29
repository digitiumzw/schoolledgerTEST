import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GraduationCap, CheckCircle, AlertTriangle } from 'lucide-react';
import { platformResetPassword } from '@/api/platform';

export default function ResetPasswordPage() {
  const [searchParams]                = useSearchParams();
  const navigate                      = useNavigate();
  const token                         = searchParams.get('token') ?? '';

  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [errors, setErrors]           = useState({ password: '', confirm: '' });
  const [isLoading, setIsLoading]     = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess]         = useState(false);

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
      await platformResetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/platform-control-panel/login'), 3000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setServerError(msg);
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
            <CardTitle>Invalid Reset Link</CardTitle>
            <CardDescription>This password reset link is missing or malformed.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild variant="outline" className="w-full">
              <Link to="/platform-control-panel/forgot-password">Request a new link</Link>
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
            <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
            <CardDescription>Choose a strong password for your platform admin account</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your password has been reset. Redirecting you to sign in…
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
                <Label htmlFor="password">New password</Label>
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
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Repeat your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={errors.confirm ? 'border-destructive' : ''}
                />
                {errors.confirm && (
                  <p className="text-sm text-destructive">{errors.confirm}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Reset Password'}
              </Button>

              <div className="text-center">
                <Link
                  to="/platform-control-panel/forgot-password"
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Request a new link instead
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
