import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import ThemeToggle from './ThemeToggle';
import LoadingButton from './LoadingButton';
import { toastError, toastSuccess } from '../utils/toast';

const mapAuthError = (message: string): string => {
  const normalized = String(message || '').toLowerCase();
  if (normalized.includes('provider is not enabled')) return 'Google sign-in is not enabled in project settings yet.';
  if (normalized.includes('invalid login credentials')) return 'Invalid email or password.';
  if (normalized.includes('email not confirmed')) return 'Email not confirmed yet. Check your inbox.';
  return message;
};

interface LoginScreenProps {
  onContinueWithoutAuth?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordLoginLoading, setPasswordLoginLoading] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const authError = params.get('error_description') || params.get('error');
    if (!authError) return;

    const humanMessage = decodeURIComponent(authError.replace(/\+/g, ' '));
    setError(humanMessage);
    toastError('Authentication failed', humanMessage);
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      const humanMessage = mapAuthError(err.message);
      setError(humanMessage);
      toastError('Google sign-in failed', humanMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (!targetEmail.includes('@')) {
      setError('Username-only sign in is not enabled yet. Please use your email address.');
      return;
    }

    setPasswordLoginLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });
      if (signInError) throw signInError;
    } catch (err: any) {
      const humanMessage = mapAuthError(err.message);
      setError(humanMessage);
      toastError('Sign in failed', humanMessage);
    } finally {
      setPasswordLoginLoading(false);
    }
  };

  const handleSignUp = async () => {
    const targetEmail = email.trim();
    if (!targetEmail || !password) {
      setError('To create an account, enter your email and password above, then tap Sign Up.');
      return;
    }
    if (!targetEmail.includes('@')) {
      setError('Please use a valid email address to sign up.');
      return;
    }

    setSignUpLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: targetEmail,
        password,
      });
      if (signUpError) throw signUpError;
      const ok = 'Sign-up submitted. Check your email for confirmation if required.';
      setMessage(ok);
      toastSuccess('Account created', ok);
    } catch (err: any) {
      const humanMessage = mapAuthError(err.message);
      setError(humanMessage);
      toastError('Sign up failed', humanMessage);
    } finally {
      setSignUpLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-app text-text-primary relative overflow-hidden px-4">
      <div className="fixed top-3 right-3 z-50">
        <ThemeToggle compact />
      </div>

      <div className="glass-panel w-full max-w-md rounded-2xl border border-border-default/70 shadow-2xl backdrop-blur-md p-8">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold text-text-primary">CHH RadCore</h1>
          <p className="mt-2 text-sm text-text-secondary">Residency Training Portal</p>
        </header>

        {error ? <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">{error}</div> : null}
        {message ? (
          <div className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-600">{message}</div>
        ) : null}

        <div className="space-y-4">
          <form onSubmit={handlePasswordSignIn} className="space-y-3">
            <label className="block text-sm font-medium text-text-secondary" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-base text-text-primary placeholder-text-tertiary transition-all"
              placeholder="doctor@example.com"
              required
            />
            <label className="block text-sm font-medium text-text-secondary" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-base text-text-primary placeholder-text-tertiary transition-all"
              placeholder="Enter your password"
              required
            />
            <LoadingButton
              type="submit"
              isLoading={passwordLoginLoading}
              loadingText="Signing in..."
              className="w-full py-3 px-4 bg-primary hover:bg-primary-dark rounded-lg font-semibold text-white shadow-lg shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              Sign In
            </LoadingButton>
            <LoadingButton
              type="button"
              onClick={handleSignUp}
              isLoading={signUpLoading}
              loadingText="Creating..."
              className="w-full py-2.5 px-4 bg-surface border border-border-default text-text-primary rounded-lg font-medium hover:bg-surface-alt transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Sign Up
            </LoadingButton>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-default"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-app/80 text-text-secondary">or</span>
            </div>
          </div>

          <LoadingButton
            type="button"
            onClick={handleGoogleLogin}
            isLoading={googleLoading}
            loadingText="Redirecting..."
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-surface border border-border-default text-text-primary rounded-lg font-semibold hover:bg-surface-alt transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span className="inline-flex items-center gap-2 leading-none">
              <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>Continue with Google</span>
            </span>
          </LoadingButton>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
