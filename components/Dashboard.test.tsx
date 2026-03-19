import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';

const setViewport = (viewport: 'mobile' | 'desktop') => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const matches =
        viewport === 'desktop'
          ? query === '(min-width: 1280px)' || query === '(min-width: 768px)'
          : false;

      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }),
  });

  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: viewport === 'desktop' ? 1440 : 390,
  });
};

describe('Dashboard', () => {
  beforeEach(() => {
    setViewport('mobile');
  });

  it('does not render the redundant quick access desktop panel', () => {
    setViewport('desktop');

    render(
      <Dashboard
        onNavigate={() => undefined}
        onStartUpload={() => undefined}
      />,
    );

    expect(screen.queryByText('Quick Access')).not.toBeInTheDocument();
    expect(screen.getByAltText('CHH RadCore logo')).toBeInTheDocument();
  });

  it('preserves the orbital actions after a resize transition', () => {
    const { rerender } = render(
      <Dashboard
        onNavigate={() => undefined}
        onStartUpload={() => undefined}
      />,
    );

    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getAllByText('Database')[0]).toBeInTheDocument();

    act(() => {
      setViewport('desktop');
      window.dispatchEvent(new Event('resize'));
    });

    rerender(
      <Dashboard
        onNavigate={() => undefined}
        onStartUpload={() => undefined}
      />,
    );

    act(() => {
      setViewport('mobile');
      window.dispatchEvent(new Event('resize'));
    });

    rerender(
      <Dashboard
        onNavigate={() => undefined}
        onStartUpload={() => undefined}
      />,
    );

    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getAllByText('Database')[0]).toBeInTheDocument();
  });
});
