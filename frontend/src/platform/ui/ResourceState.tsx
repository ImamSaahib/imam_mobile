import React from 'react';
import { Button } from './Button';

type Props = {
  state: 'loading' | 'empty' | 'no-results' | 'error';
  message?: string;
  onRetry?: () => void;
};
const messages = {
  loading: 'Loading records…',
  empty: 'No records yet.',
  'no-results': 'No records match your search.',
  error: 'Could not load records.',
};
/** Plain user-facing messages only; callers keep raw errors out of this surface. */
export function ResourceState({ state, message, onRetry }: Props) {
  return <div className="im-resource-state">
    <p role={state === 'error' ? 'alert' : 'status'}>{message ?? messages[state]}</p>
    {state === 'error' && onRetry && <Button onClick={onRetry}>Retry</Button>}
  </div>;
}
