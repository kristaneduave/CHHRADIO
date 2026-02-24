import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App smoke', () => {
  it('mounts successfully', () => {
    render(<App />);
    expect(screen.getByText('Loading workspace...')).toBeInTheDocument();
  });
});
