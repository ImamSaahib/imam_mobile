import React from 'react';

const renderers = new Map<string, (text: string) => React.ReactElement>([
  ['heading:1', text => <h2>{text}</h2>],
  ['text:1', text => <p>{text}</p>],
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function renderBlock(block: unknown) {
  if (!isObject(block) || typeof block.type !== 'string' || !Number.isInteger(block.typeVersion)) {
    return <p>This section has invalid settings.</p>;
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
export function PageContent({ components }: { components?: unknown }) {
  if (components === undefined || (Array.isArray(components) && components.length === 0)) {
    return <p>No content has been published for this page.</p>;
  }
  if (!Array.isArray(components)) return <p>This page has invalid content settings.</p>;
  return <div className="im-page-content">{components.map((block, index) =>
    <React.Fragment key={index}>{renderBlock(block)}</React.Fragment>
  )}</div>;
}
