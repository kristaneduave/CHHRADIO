import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
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
});
