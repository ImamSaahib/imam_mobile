import React from 'react';
import { InventorySummary } from './InventorySummary';
import { InventoryList } from './InventoryList';

const renderers = new Map<string, (text: string) => React.ReactElement>([
  ['heading:1', text => <h2>{text}</h2>],
  ['text:1', text => <p>{text}</p>],
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function renderBlock(block: unknown, bootstrapUrl: string, dataSources: unknown) {
  if (!isObject(block) || typeof block.type !== 'string' || !Number.isInteger(block.typeVersion)) {
    return <p>This section has invalid settings.</p>;
  }
  if (block.type === 'summary' && block.typeVersion === 1) {
    if (!isObject(block.config) || Object.keys(block.config).length) return <p>This section has invalid settings.</p>;
    const url = new URL('devices/summary', new URL(bootstrapUrl, window.location.href)).href;
    return <InventorySummary key={url} url={url} />;
  }
  if (block.type === 'list' && block.typeVersion === 1) {
    const config = block.config;
    if (!isObject(config) || typeof config.dataSourceId !== 'string' || Object.keys(config).length !== 1) return <p>This section has invalid settings.</p>;
    const source = Array.isArray(dataSources) ? dataSources.find(item => isObject(item) && item.id === config.dataSourceId) : undefined;
    // Only the devices list has a page read so far; other data sources are unavailable until theirs exists.
    if (!isObject(source) || source.key !== 'devices') return <p>This list is unavailable in this version.</p>;
    const url = new URL('devices/page', new URL(bootstrapUrl, window.location.href)).href;
    return <InventoryList key={url} url={url} />;
  }
  const render = renderers.get(`${block.type}:${block.typeVersion}`);
  if (!render) return <p>This section is unavailable in this version.</p>;
  const config = block.config;
  if (!isObject(config) || typeof config.text !== 'string' || !config.text.trim() || Object.keys(config).length !== 1) {
    return <p>This section has invalid settings.</p>;
  }
  return render(config.text);
}

/** Render only registered components and isolate failures to their position in the page. */
export function PageContent({ components, bootstrapUrl, dataSources }: { components?: unknown; bootstrapUrl: string; dataSources?: unknown }) {
  if (components === undefined || (Array.isArray(components) && components.length === 0)) {
    return <p>No content has been published for this page.</p>;
  }
  if (!Array.isArray(components)) return <p>This page has invalid content settings.</p>;
  return <div className="im-page-content">{components.map((block, index) =>
    <React.Fragment key={index}>{renderBlock(block, bootstrapUrl, dataSources)}</React.Fragment>
  )}</div>;
}
