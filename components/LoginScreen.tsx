import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import ThemeToggle from './ThemeToggle';
import { toastError, toastSuccess } from '../utils/toast';
import LoadingButton from './LoadingButton';

type AuthMethod = 'email' | 'phone';
type PhoneStep = 'request' | 'verify';

const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

const mapAuthError = (message: string): string => {
  const normalized = String(message || '').toLowerCase();
  if (normalized.includes('invalid phone')) return 'Invalid phone format. Use E.164 (example: +15551234567).';
  if (normalized.includes('otp') && (normalized.includes('invalid') || normalized.includes('expired'))) {
    return 'The verification code is invalid or expired. Request a new one.';
  }
  if (normalized.includes('sms') && normalized.includes('provider')) {
    return 'SMS provider is not configured. Contact administrator.';
  }
  if (normalized.includes('invalid login credentials')) {
    return 'Invalid email or password.';
  }
  return message;
};

const LoginScreen: React.FC = () => {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('request');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    setError(null);
    setMessage(null);
  }, [authMethod]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
    } catch (err: any) {
      const humanMessage = mapAuthError(err.message);
      setError(humanMessage);
      toastError('Authentication failed', humanMessage);
    } finally {
      setLoading(false);
    }
  };

  const requestPhoneCode = async (resend = false) => {
    const cleanedPhone = phone.trim();
    if (!E164_PHONE_REGEX.test(cleanedPhone)) {
      const invalidMessage = 'Use E.164 format (example: +15551234567).';
      setError(invalidMessage);
      toastError('Invalid phone format', invalidMessage);
      return;
    }

    if (resend) {
      setIsResending(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setMessage(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: cleanedPhone,
      });
      if (otpError) throw otpError;

      setPhone(cleanedPhone);
      setPhoneStep('verify');
      setCooldownSeconds(30);
      setOtp('');
      const successMessage = resend ? 'Code resent via SMS.' : 'Verification code sent via SMS.';
      setMessage(successMessage);
      toastSuccess('Code sent', successMessage);
    } catch (err: any) {
      const humanMessage = mapAuthError(err.message);
      setError(humanMessage);
      toastError('Phone sign-in failed', humanMessage);
    } finally {
      if (resend) {
        setIsResending(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handlePhoneRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestPhoneCode(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otp.trim();
    if (!/^\d{6}$/.test(token)) {
      const invalidOtpMessage = 'Enter the 6-digit code sent to your phone.';
      setError(invalidOtpMessage);
      toastError('Invalid code', invalidOtpMessage);
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token,
        type: 'sms',
      });
      if (verifyError) throw verifyError;
      toastSuccess('Verified', 'Phone verification successful.');
    } catch (err: any) {
      const humanMessage = mapAuthError(err.message);
      setError(humanMessage);
      toastError('Verification failed', humanMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldownSeconds > 0 || isResending || loading) return;
    await requestPhoneCode(true);
  };

  const handleGoogleLogin = async () => {
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      const humanMessage = mapAuthError(err.message);
      setError(humanMessage);
      toastError('Google sign-in failed', humanMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-app text-text-primary relative overflow-hidden px-4">
      <div className="fixed top-3 right-3 z-50">
        <ThemeToggle compact />
      </div>
      <div className="glass-panel p-8 rounded-2xl w-full max-w-md z-10 border border-border-default/70 shadow-2xl backdrop-blur-md">
        <h2 className="text-3xl font-bold mb-6 text-center text-text-primary">Welcome Back</h2>

        <div className="mb-5 flex bg-surface-alt border border-border-default rounded-lg p-1">
          <button
            type="button"
            onClick={() => setAuthMethod('email')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
              authMethod === 'email' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setAuthMethod('phone')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
              authMethod === 'phone' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Phone
          </button>
        </div>

        {error ? <div className="bg-red-500/10 border border-red-500/40 text-red-500 p-3 rounded-lg mb-4 text-sm">{error}</div> : null}

        {message ? (
          <div className="bg-green-500/10 border border-green-500/40 text-green-600 p-3 rounded-lg mb-4 text-sm">{message}</div>
        ) : null}

        {authMethod === 'email' ? (
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-base text-text-primary placeholder-text-tertiary transition-all"
                placeholder="doctor@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-base text-text-primary placeholder-text-tertiary transition-all"
                placeholder="********"
                required
              />
            </div>

            <LoadingButton
              type="submit"
              isLoading={loading}
              loadingText="Signing in..."
              className="w-full py-3 px-4 bg-primary hover:bg-primary-dark rounded-lg font-semibold text-white shadow-lg shadow-primary/30 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              Sign In
            </LoadingButton>
          </form>
        ) : (
          <form onSubmit={phoneStep === 'request' ? handlePhoneRequestSubmit : handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Phone (E.164)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-base text-text-primary placeholder-text-tertiary transition-all"
                placeholder="+15551234567"
                required
              />
              <p className="text-xs text-text-tertiary mt-1">Use international format, e.g. +15551234567</p>
            </div>

            {phoneStep === 'verify' ? (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-2 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-base text-text-primary placeholder-text-tertiary transition-all tracking-[0.2em]"
                  placeholder="123456"
                  required
                />
              </div>
            ) : null}

            <LoadingButton
              type="submit"
              isLoading={loading}
              loadingText={phoneStep === 'request' ? 'Sending code...' : 'Verifying...'}
              className="w-full py-3 px-4 bg-primary hover:bg-primary-dark rounded-lg font-semibold text-white shadow-lg shadow-primary/30 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {phoneStep === 'request' ? 'Send SMS Code' : 'Verify Code'}
            </LoadingButton>

            {phoneStep === 'verify' ? (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPhoneStep('request');
                    setOtp('');
                    setCooldownSeconds(0);
                    setMessage(null);
                    setError(null);
                  }}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Change number
                </button>
                <LoadingButton
                  type="button"
                  onClick={handleResendCode}
                  isLoading={isResending}
                  loadingText="Resending..."
                  disabled={cooldownSeconds > 0}
                  className="text-sm text-primary hover:text-primary-dark font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend code'}
                </LoadingButton>
              </div>
            ) : null}
          </form>
        )}

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-default"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-app/80 text-text-secondary">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-surface border border-border-default text-text-primary rounded-lg font-medium hover:bg-surface-alt transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label="Continue with Google"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            Google
          </button>
        </div>

        <p className="mt-8 text-center text-sm text-text-secondary">
          Accounts are managed by administrators. Contact your admin if you need access.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
