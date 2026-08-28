import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppErrorBoundary from './AppErrorBoundary';

const CrashingChild = () => {
  throw new Error('Patient 123456789 private clinical message');
};

describe('AppErrorBoundary', () => {
  it('shows recovery actions and a non-sensitive error code', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<AppErrorBoundary><CrashingChild /></AppErrorBoundary>);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy error code RAD-/ })).toBeInTheDocument();
    expect(screen.queryByText(/private clinical message/)).not.toBeInTheDocument();
  });
});
