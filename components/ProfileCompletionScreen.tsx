import React, { useMemo, useState } from 'react';
import LoadingButton from './LoadingButton';
import ThemeToggle from './ThemeToggle';

interface ProfileCompletionScreenProps {
  initialFullName?: string;
  initialDisplayName?: string;
  isSaving?: boolean;
  error?: string | null;
  onSubmit: (input: { fullName: string; displayName: string }) => Promise<void>;
}

const ProfileCompletionScreen: React.FC<ProfileCompletionScreenProps> = ({
  initialFullName = '',
  initialDisplayName = '',
  isSaving = false,
  error = null,
  onSubmit,
}) => {
  const [fullName, setFullName] = useState(initialFullName);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [localError, setLocalError] = useState<string | null>(null);

  const resolvedError = error || localError;
  const canSubmit = useMemo(
    () => fullName.trim().length > 0 && displayName.trim().length > 0,
    [displayName, fullName]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      setLocalError('Please complete your full name and display name.');
      return;
    }

    setLocalError(null);
    await onSubmit({
      fullName: fullName.trim(),
      displayName: displayName.trim(),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-app text-text-primary relative overflow-hidden px-4">
      <div className="fixed top-3 right-3 z-50">
        <ThemeToggle compact />
      </div>

      <div className="glass-panel w-full max-w-lg rounded-2xl border border-border-default/70 shadow-2xl backdrop-blur-md p-8">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold text-text-primary">Complete Your Profile</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Set your name and display name before entering the portal. Your role is assigned by staff.
          </p>
        </header>

        {resolvedError ? (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">
            {resolvedError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2" htmlFor="profile-full-name">
              Full Name
            </label>
            <input
              id="profile-full-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full px-4 py-2.5 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-base text-text-primary placeholder-text-tertiary transition-all"
              placeholder="Juan Dela Cruz"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2" htmlFor="profile-display-name">
              Display Name
            </label>
            <input
              id="profile-display-name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="w-full px-4 py-2.5 bg-surface-alt border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-base text-text-primary placeholder-text-tertiary transition-all"
              placeholder="Dr. Cruz"
              required
            />
          </div>

          <div className="rounded-lg border border-border-default bg-surface-alt px-4 py-3 text-sm text-text-secondary">
            Your staff-approved role will be applied automatically.
          </div>

          <LoadingButton
            type="submit"
            isLoading={isSaving}
            loadingText="Saving..."
            disabled={!canSubmit}
            className="w-full py-3 px-4 bg-primary hover:bg-primary-dark rounded-lg font-semibold text-white shadow-lg shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            Continue
          </LoadingButton>
        </form>
      </div>
    </div>
  );
};

export default ProfileCompletionScreen;
