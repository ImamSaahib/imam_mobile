import React from 'react';
import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Gallery from '../src/platform/ui/Gallery';

it('switches themes and exercises fixture actions without network requests', async () => {
  const user = userEvent.setup();
  render(<Gallery />);
  expect(screen.getByRole('main').getAttribute('data-mode')).toBe('light');
  await user.click(screen.getByRole('button', { name: 'Switch theme' }));
  expect(screen.getByRole('main').getAttribute('data-mode')).toBe('dark');
  await user.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(screen.getByRole('status', { name: 'Action count' }).textContent).toBe('Actions: 1');
});
