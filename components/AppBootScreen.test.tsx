import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppBootScreen from './AppBootScreen';

describe('AppBootScreen', () => {
  it('renders bootstrap progress with the fun message as the main loading copy', () => {
    render(
      <AppBootScreen
        mode="bootstrap"
        progress={72}
        statusLabel="Preparing dashboard"
        phaseLabel="Collecting dashboard essentials"
        funMessage="Tan is checking whether the dashboard survived the last shift change."
        funMessages={[
          'Tan is checking whether the dashboard survived the last shift change.',
          'Tine is making the front page look less post-call.',
        ]}
        messageKey="dashboard:tan"
        taskSummary={{ completed: 5, total: 8 }}
      />
    );

    expect(screen.getByText('RADCORE')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('Tan is checking whether the dashboard survived the last shift change.')).toBeInTheDocument();
    expect(screen.queryByText('Preparing dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Collecting dashboard essentials')).not.toBeInTheDocument();
    expect(screen.queryByText(/tasks ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Operational preload/i)).not.toBeInTheDocument();
  });

  it('cycles through fun messages on a timer instead of waiting for progress changes', () => {
    vi.useFakeTimers();
    try {
      render(
        <AppBootScreen
          mode="bootstrap"
          progress={40}
          statusLabel="Preparing dashboard"
          funMessages={[
            'Tan is checking whether the dashboard survived the last shift change.',
            'Tine is making the front page look less post-call.',
          ]}
          messageKey="dashboard:cycle"
        />
      );

      expect(screen.getByText('Tan is checking whether the dashboard survived the last shift change.')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(550);
      });

      expect(screen.getByText('Tine is making the front page look less post-call.')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders neutral session copy without technical preload labels', () => {
    render(
      <AppBootScreen
        mode="session"
        progress={12}
        statusLabel="Checking session"
        phaseLabel="Resolving access"
        funMessage="Checking session access and preparing a clean launch."
        messageKey="session:checking"
      />
    );

    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.getByText('Checking session access and preparing a clean launch.')).toBeInTheDocument();
    expect(screen.queryByText(/tasks ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Operational preload/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Checking session')).not.toBeInTheDocument();
    expect(screen.queryByText('Resolving access')).not.toBeInTheDocument();
  });
});
