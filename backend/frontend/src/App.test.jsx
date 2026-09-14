import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from './App';

describe('App routing', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('redirects to Login when there is no auth token', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
  });
});
