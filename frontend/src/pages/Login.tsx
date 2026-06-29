import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMaintenanceStatus } from '@/hooks/useMaintenanceStatus';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [isSuspended, setIsSuspended] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const authContext = useContext(AuthContext);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: maintenance } = useMaintenanceStatus();

  if (!authContext) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const { login } = authContext;

  const validateForm = () => {
    const newErrors = { email: '', password: '' };
    let isValid = true;

    if (!email.trim()) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({ email: '', password: '' });
    setIsSuspended(false);
    setMaintenanceError(null);

    try {
      await login(email, password);

      toast({
        title: 'Login successful',
        description: 'Welcome back!',
      });

      // Navigation will be handled by App.tsx based on role
      navigate('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid email or password';
      if (message.toLowerCase().includes('suspended')) {
        setIsSuspended(true);
      } else if (message.toLowerCase().includes('maintenance') || (error as { status?: number }).status === 503) {
        setMaintenanceError(maintenance?.headline ?? 'Platform Under Maintenance');
      } else {
        toast({
          variant: 'destructive',
          title: 'Login failed',
          description: message,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <img
              src="/favicon-96x96.png"
              alt="School Ledger logo"
              className="h-16 w-16"
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">School Ledger</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {maintenance?.maintenance_mode && (
            <Alert variant="default" className="mb-4 border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700">{maintenance.headline}</AlertTitle>
              <AlertDescription className="text-amber-700/80">
                {maintenance.message}
              </AlertDescription>
            </Alert>
          )}

          {isSuspended && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Account Suspended</AlertTitle>
              <AlertDescription>
                Your account access is currently restricted. Please contact support for assistance.
              </AlertDescription>
            </Alert>
          )}

          {maintenanceError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Platform Under Maintenance</AlertTitle>
              <AlertDescription>
                The platform is currently under maintenance. Only administrators can sign in. Please try again later.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@school.co.zw"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${errors.password ? 'border-destructive' : ''} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

        </CardContent>
      </Card>
    </div>
  );
}
