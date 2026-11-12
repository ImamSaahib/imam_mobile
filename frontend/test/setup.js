import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(cleanup);

// jsdom has no media-query engine. These component tests use desktop mode;
// actual breakpoints/drawer behavior require browser tests.
Object.defineProperty(window, 'matchMedia', { writable: true, value: query => ({
  matches: false, media: query, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
}) });
