import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GraduationCap, ArrowLeft, CheckCircle } from 'lucide-react';
import { platformForgotPassword } from '@/api/platform';

export default function ForgotPasswordPage() {
  const [email, setEmail]               = useState('');
  const [emailError, setEmailError]     = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [serverError, setServerError]   = useState('');

  const validate = (): boolean => {
    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setServerError('');

    try {
      await platformForgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setServerError(msg);
    } finally {
      setIsLoading(false);
    }
  };

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
            <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
            <CardDescription>
              {submitted
                ? 'Check your inbox'
                : "Enter your platform admin email and we'll send you a reset link"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {submitted ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                If <strong>{email}</strong> is a registered platform admin, you'll receive a
                password reset link within a few minutes. Check your spam folder if it doesn't
                appear.
              </p>
              <p className="text-sm text-muted-foreground">
                The link expires in <strong>30 minutes</strong>.
              </p>
              <Button asChild variant="outline" className="w-full mt-2">
                <Link to="/platform-control-panel/login">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign In
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@schoolledger.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={emailError ? 'border-destructive' : ''}
                  autoFocus
                />
                {emailError && (
                  <p className="text-sm text-destructive">{emailError}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <div className="text-center">
                <Link
                  to="/platform-control-panel/login"
                  className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
