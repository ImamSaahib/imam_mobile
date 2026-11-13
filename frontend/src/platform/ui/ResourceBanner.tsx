import React from 'react';
type Resources = { state: 'normal' | 'conserve' | 'essential' | 'limit'; resetAt?: string };
export function ResourceBanner({ resources }: { resources?: Resources }) {
  if (!resources || resources.state === 'normal' || resources.state === 'conserve') return null;
  return <p role="status" className="im-resource-banner">
    {resources.state === 'essential' ? 'Some information may be a few minutes old. Essential actions remain available.'
      : 'The daily usage limit has been reached. Previously loaded information remains available.'}
    {resources.state === 'limit' && <> Usage resets {resources.resetAt && Number.isFinite(Date.parse(resources.resetAt))
      ? <time dateTime={resources.resetAt}>{new Date(resources.resetAt).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC</time>
      : 'at 00:00 UTC'}.</>}
  </p>;
}
