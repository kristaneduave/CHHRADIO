import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import ThemeToggle from './ThemeToggle';
import { toastError, toastSuccess } from '../utils/toast';
import LoadingButton from './LoadingButton';
import { createSystemNotification, fetchRecipientUserIdsByRoles } from '../services/newsfeedService';
import {
  createAccountAccessRequest,
  fetchAccountAccessRequestStatus,
} from '../services/accountAccessRequestService';
import {
  AccountAccessRequestRole,
  AccountAccessRequestStatus,
} from '../types';

type AuthMethod = 'email' | 'phone';
type PhoneStep = 'request' | 'verify';

const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;
const ACCOUNT_REQUEST_TOKEN_KEY = 'chh_account_request_token_v1';

const mapAuthError = (message: string): string => {
  const normalized = String(message || '').toLowerCase();
  if (normalized.includes('invalid phone')) return 'Invalid phone format. Use international format (example: +15551234567).';
  if (normalized.includes('otp') && (normalized.includes('invalid') || normalized.includes('expired'))) {
    return 'The verification code is invalid or expired. Request a new one.';
  }
  if (normalized.includes('sms') && normalized.includes('provider')) {
    return 'SMS provider is not configured. Contact administrator.';
  }
  if (normalized.includes('invalid login credentials')) return 'Invalid email or password.';
  if (normalized.includes('email not confirmed')) return 'Email not confirmed yet. Check your inbox.';
  return message;
};

const normalizePhoneInput = (value: string): string => {
  const raw = value.trim();
  if (!raw) return '';

  if (raw.startsWith('+')) {
    return `+${raw.slice(1).replace(/\D/g, '')}`;
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`;
  }
  if (digits.startsWith('09') && digits.length === 11) {
    return `+63${digits.slice(1)}`;
  }
  if (digits.startsWith('9') && digits.length === 10) {
    return `+63${digits}`;
  }
  return `+${digits}`;
};

const statusLabel = (status: AccountAccessRequestStatus['status']): string => {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending review';
};

const statusClassName = (status: AccountAccessRequestStatus['status']): string => {
  if (status === 'approved') return 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600';
  if (status === 'rejected') return 'bg-red-500/10 border-red-500/40 text-red-500';
  return 'bg-amber-500/10 border-amber-500/40 text-amber-600';
};

interface LoginScreenProps {
  onContinueWithoutAuth?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onContinueWithoutAuth }) => {
  const [mode, setMode] = useState<'signin' | 'request'>('signin');
  const [showQuickOptions, setShowQuickOptions] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('request');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestRole, setRequestRole] = useState<AccountAccessRequestRole>('resident');
  const [requestYearLevel, setRequestYearLevel] = useState('');
  const [requestStatus, setRequestStatus] = useState<AccountAccessRequestStatus | null>(null);

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

  useEffect(() => {
    const token = window.localStorage.getItem(ACCOUNT_REQUEST_TOKEN_KEY);
    if (!token) return;

    let isMounted = true;
    const loadStatus = async () => {
      setStatusLoading(true);
      try {
        const status = await fetchAccountAccessRequestStatus(token);
        if (!isMounted) return;
        if (status) {
          setRequestStatus(status);
          setRequestEmail((prev) => prev || status.email);
        } else {
          window.localStorage.removeItem(ACCOUNT_REQUEST_TOKEN_KEY);
        }
      } catch {
        if (isMounted) {
          toastError('Status unavailable', 'Could not load account request status right now.');
        }
      } finally {
        if (isMounted) setStatusLoading(false);
      }
    };

    void loadStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const authError = params.get('error_description') || params.get('error');
    if (authError) {
      const humanMessage = decodeURIComponent(authError.replace(/\+/g, ' '));
      setError(humanMessage);
      toastError('Authentication failed', humanMessage);
    }
  }, []);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
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

  const handleSendMagicLink = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError('Enter your email first.');
      return;
    }

    setMagicLinkLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (magicLinkError) throw magicLinkError;
      const ok = 'Magic link sent. Check your email inbox.';
      setMessage(ok);
      toastSuccess('Magic link sent', ok);
    } catch (err: any) {
      const humanMessage = mapAuthError(err.message);
      setError(humanMessage);
      toastError('Magic link failed', humanMessage);
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError('Enter your email first to reset your password.');
      return;
    }

    setForgotPasswordLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: window.location.origin,
      });
      if (resetError) throw resetError;
      const ok = 'Password reset link sent. Check your email.';
      setMessage(ok);
      toastSuccess('Reset link sent', ok);
    } catch (err: any) {
      const humanMessage = mapAuthError(err.message);
      setError(humanMessage);
      toastError('Reset failed', humanMessage);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const requestPhoneCode = async (resend = false) => {
    const cleanedPhone = normalizePhoneInput(phone);
    if (!E164_PHONE_REGEX.test(cleanedPhone)) {
      const invalidMessage = 'Use international format (example: +15551234567).';
      setError(invalidMessage);
      toastError('Invalid phone format', invalidMessage);
      return;
    }

    setPhone(cleanedPhone);
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
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      const humanMessage = mapAuthError(err.message);
      setError(humanMessage);
      toastError('Google sign-in failed', humanMessage);
    }
  };

  const handleRequestAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = requestName.trim();
    const emailValue = requestEmail.trim().toLowerCase();
    if (!name || !emailValue) {
      const text = 'Enter your name and email to request an account.';
      setError(text);
      toastError('Missing details', text);
      return;
    }

    setRequestLoading(true);
    setError(null);
    setMessage(null);
    try {
      const request = await createAccountAccessRequest({
        fullName: name,
        email: emailValue,
        requestedRole: requestRole,
        yearLevel: requestYearLevel,
      });

      const adminIds = await fetchRecipientUserIdsByRoles(['admin', 'training_officer', 'moderator']);
      await createSystemNotification({
        actorUserId: null,
        type: 'system',
        severity: 'info',
        title: 'New account request',
        message: `${name} (${emailValue}) requested ${requestRole} access.`,
        linkScreen: 'profile',
        recipientUserIds: adminIds,
      });

      window.localStorage.setItem(ACCOUNT_REQUEST_TOKEN_KEY, request.publicToken);
      setRequestStatus(request);
      setRequestName('');
      setRequestYearLevel('');
      setMessage('Account request sent. Admin has been notified.');
      toastSuccess('Request sent', 'Admin has been notified.');
    } catch (err: any) {
      const fallback = err?.message || 'Could not submit account request right now.';
      setError(fallback);
      toastError('Request failed', fallback);
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-app text-text-primary relative overflow-hidden px-4">
      <div className="fixed top-3 right-3 z-50">
        <ThemeToggle compact />
      </div>
      <div className="glass-panel p-8 rounded-2xl w-full max-w-md z-10 border border-border-default/70 shadow-2xl backdrop-blur-md">
        <h2 className="text-3xl font-bold mb-2 text-center text-text-primary">Welcome to CHH Radiology</h2>
        <p className="text-center text-sm text-text-secondary mb-6">Sign in to continue.</p>

        {onContinueWithoutAuth && (
          <button
            type="button"
            onClick={onContinueWithoutAuth}
            className="mb-4 w-full rounded-lg border border-border-default bg-white/5 px-4 py-2 text-sm font-semibold text-text-primary hover:bg-white/10 transition-colors"
          >
            Continue without sign-in
          </button>
        )}

        {error ? <div className="bg-red-500/10 border border-red-500/40 text-red-500 p-3 rounded-lg mb-4 text-sm">{error}</div> : null}

        {message ? (
          <div className="bg-green-500/10 border border-green-500/40 text-green-600 p-3 rounded-lg mb-4 text-sm">{message}</div>
        ) : null}

        <div className="mb-5 flex bg-surface-alt border border-border-default rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
              mode === 'signin' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('request')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
              mode === 'request' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Request account
          </button>
        </div>

        {mode === 'signin' && authMethod === 'email' ? (
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-base text-text-primary placeholder-text-tertiary transition-all"
                placeholder="doctor@example.com"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-text-secondary">Password</label>
                <LoadingButton
                  type="button"
                  onClick={handleForgotPassword}
                  isLoading={forgotPasswordLoading}
                  loadingText="Sending..."
                  className="text-xs text-primary hover:text-primary-dark font-medium transition-colors"
                >
                  Forgot password?
                </LoadingButton>
              </div>
              <input
                type="password"
                autoComplete="current-password"
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

            <button
              type="button"
              onClick={() => setShowQuickOptions((prev) => !prev)}
              className="w-full text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {showQuickOptions ? 'Hide quick options' : 'More sign-in options'}
            </button>
          </form>
        ) : mode === 'signin' ? (
          <form onSubmit={phoneStep === 'request' ? handlePhoneRequestSubmit : handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Phone Number</label>
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setPhone(normalizePhoneInput(phone))}
                className="w-full px-4 py-2 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-base text-text-primary placeholder-text-tertiary transition-all"
                placeholder="+15551234567 or 0917..."
                required
              />
              <p className="text-xs text-text-tertiary mt-1">Supports local mobile format; we convert to international format automatically.</p>
            </div>

            {phoneStep === 'verify' ? (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">6-digit code</label>
                <input
                  type="text"
                  autoComplete="one-time-code"
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
                  Wrong number?
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
        ) : null}

        {mode === 'signin' && showQuickOptions ? (
          <div className="mt-4 space-y-3 border-t border-border-default pt-4">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-surface border border-border-default text-text-primary rounded-lg font-medium hover:bg-surface-alt transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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
              Continue with Google
            </button>

            <LoadingButton
              type="button"
              onClick={handleSendMagicLink}
              isLoading={magicLinkLoading}
              loadingText="Sending link..."
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-dark rounded-lg font-semibold text-white shadow-lg shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send Magic Link
            </LoadingButton>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod((prev) => (prev === 'email' ? 'phone' : 'email'));
                  setPhoneStep('request');
                  setOtp('');
                }}
                className="w-full text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {authMethod === 'email' ? 'Use phone OTP instead' : 'Use email + password instead'}
              </button>
            </div>
          </div>
        ) : null}

        {mode === 'request' ? (
          <>
            <p className="mt-4 text-center text-sm text-text-secondary">
              Accounts are reviewed by administrators.
            </p>

            <form onSubmit={handleRequestAccount} className="mt-4 space-y-3 border-t border-border-default pt-4">
              <p className="text-xs uppercase tracking-wider text-text-secondary">Request Account Access</p>
              <input
                type="text"
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-text-primary"
                placeholder="Full name"
                required
              />
              <input
                type="email"
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                className="w-full px-3 py-2 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-text-primary"
                placeholder="Institution email"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={requestRole}
                  onChange={(e) => setRequestRole(e.target.value as AccountAccessRequestRole)}
                  className="w-full px-3 py-2 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-text-primary"
                >
                  <option value="resident">Resident</option>
                  <option value="consultant">Consultant</option>
                  <option value="fellow">Fellow</option>
                </select>
                <input
                  type="text"
                  value={requestYearLevel}
                  onChange={(e) => setRequestYearLevel(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-text-primary"
                  placeholder="Year level (optional)"
                />
              </div>
              <LoadingButton
                type="submit"
                isLoading={requestLoading}
                loadingText="Submitting..."
                className="w-full py-2.5 px-4 bg-surface border border-border-default text-text-primary rounded-lg font-medium hover:bg-surface-alt transition-colors"
              >
                Submit request
              </LoadingButton>
            </form>
          </>
        ) : null}

        {statusLoading ? (
          <p className="mt-3 text-xs text-text-secondary">Loading request status...</p>
        ) : requestStatus ? (
          <div className={`mt-3 border rounded-lg p-3 text-sm ${statusClassName(requestStatus.status)}`}>
            <p className="font-semibold">{statusLabel(requestStatus.status)}</p>
            <p className="mt-1 text-xs">
              {requestStatus.email} - {requestStatus.requestedRole}
              {requestStatus.yearLevel ? ` (${requestStatus.yearLevel})` : ''}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default LoginScreen;
