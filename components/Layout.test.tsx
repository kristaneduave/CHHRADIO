import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import Layout from './Layout';

const setViewport = (viewport: 'mobile' | 'desktop') => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches:
        viewport === 'desktop'
          ? query.includes('1280px') || query.includes('768px')
          : false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
};

describe('Layout', () => {
  beforeEach(() => {
    setViewport('mobile');
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 390,
    });
  });

  it('renders the mobile bottom navigation on narrow viewports', () => {
    render(
      <Layout activeScreen="dashboard" setScreen={() => undefined}>
        <div>dashboard</div>
      </Layout>,
    );

    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Open Home')).toBeInTheDocument();
    expect(screen.getByTestId('app-ambient-background')).toBeInTheDocument();
  });

  it('renders the desktop side rail on wide viewports', () => {
    setViewport('desktop');

    render(
      <Layout activeScreen="dashboard" setScreen={() => undefined}>
        <div>dashboard</div>
      </Layout>,
    );

    expect(screen.getByTestId('app-ambient-background')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Newsfeed')).toBeInTheDocument();
  });

  it('triggers edge swipe back on mobile when thresholds are met', () => {
    const onNavigateBack = vi.fn();

    render(
      <Layout activeScreen="quiz" setScreen={() => undefined} canNavigateBack onNavigateBack={onNavigateBack}>
        <div>quiz</div>
      </Layout>,
    );

    const shell = screen.getByText('quiz').closest('.relative.flex.min-h-0.flex-1');
    expect(shell).not.toBeNull();

    fireEvent.touchStart(shell!, {
      touches: [{ clientX: 12, clientY: 100 }],
    });
    fireEvent.touchMove(shell!, {
      touches: [{ clientX: 110, clientY: 112 }],
    });
    fireEvent.touchEnd(shell!);

    expect(onNavigateBack).toHaveBeenCalledTimes(1);
  });

  it('does not trigger edge swipe back from blocked interactive elements', () => {
    const onNavigateBack = vi.fn();

    render(
      <Layout activeScreen="quiz" setScreen={() => undefined} canNavigateBack onNavigateBack={onNavigateBack}>
        <button type="button">Tap target</button>
      </Layout>,
    );

    const button = screen.getByRole('button', { name: 'Tap target' });
    const shell = button.closest('.relative.flex.min-h-0.flex-1');
    expect(shell).not.toBeNull();

    fireEvent.touchStart(button, {
      touches: [{ clientX: 10, clientY: 120 }],
    });
    fireEvent.touchMove(shell!, {
      touches: [{ clientX: 120, clientY: 122 }],
    });
    fireEvent.touchEnd(shell!);

    expect(onNavigateBack).not.toHaveBeenCalled();
  });
});
