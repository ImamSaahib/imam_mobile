import React from 'react';
import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResourceBanner } from '../src/platform/ui/ResourceBanner';
it('shows only essential/limit notices with plain reset-time information', () => {
  const { rerender } = render(<ResourceBanner resources={{ state: 'normal' }} />);
  expect(screen.queryByRole('status')).toBeNull();
  rerender(<ResourceBanner resources={{ state: 'conserve' }} />);
  expect(screen.queryByRole('status')).toBeNull();
  rerender(<ResourceBanner resources={{ state: 'essential' }} />);
  expect(screen.getByRole('status').textContent).toContain('Essential actions remain available');
  rerender(<ResourceBanner resources={{ state: 'limit', resetAt: '2026-11-15T00:00:00.000Z' }} />);
  expect(screen.getByRole('status').textContent).toContain('15 Nov 2026, 00:00 UTC');
});
