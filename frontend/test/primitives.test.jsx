import React from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArrowClockwiseIcon } from '@phosphor-icons/react';
import { Button, IconButton } from '../src/platform/ui/Button';
import { TextInput } from '../src/platform/ui/TextInput';

it('activates by keyboard and defaults to a non-submitting button', async () => {
  const action = vi.fn(), submit = vi.fn(e => e.preventDefault());
  const user = userEvent.setup();
  render(<form onSubmit={submit}><Button onClick={action}>Run action</Button></form>);
  await user.tab();
  await user.keyboard('{Enter}');
  expect(action).toHaveBeenCalledTimes(1);
  expect(submit).not.toHaveBeenCalled();
});
it('does not activate a disabled button', async () => {
  const action = vi.fn();
  render(<Button disabled onClick={action}>Unavailable</Button>);
  await userEvent.click(screen.getByRole('button', { name: 'Unavailable' }));
  expect(action).not.toHaveBeenCalled();
});
it('exposes an accessible icon action', async () => {
  const action = vi.fn();
  render(<IconButton aria-label="Refresh records" icon={ArrowClockwiseIcon} onClick={action} />);
  await userEvent.click(screen.getByRole('button', { name: 'Refresh records' }));
  expect(action).toHaveBeenCalledTimes(1);
});
it('supports controlled text input and disabled state', async () => {
  function Fixture() {
    const [value, setValue] = React.useState('');
    return <><TextInput aria-label="Search" value={value} onChange={e => setValue(e.target.value)} /><TextInput aria-label="Locked" disabled value="Fixed" /></>;
  }
  render(<Fixture />);
  await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'Phone');
  expect(screen.getByRole('textbox', { name: 'Search' }).value).toBe('Phone');
  expect(screen.getByRole('textbox', { name: 'Locked' }).disabled).toBe(true);
});
it('blocks repeated activation while loading', async () => {
  const action = vi.fn();
  render(<Button loading onClick={action}>Saving</Button>);
  await userEvent.click(screen.getByRole('button', { name: /Saving/ }));
  expect(action).not.toHaveBeenCalled();
});
