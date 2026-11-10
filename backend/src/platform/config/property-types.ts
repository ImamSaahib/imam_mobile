// Property type contracts (Contracts section 3, Story 04 slice 04a).
//
// One table describes every property type: how it is stored, which SQLite column types it accepts, whether
// clients may write it, and which operators, sorting and search it supports. Forms, lists, filters, sorting
// and import and export all read this table, so they cannot disagree about a type.
//
// Values are validated on the Worker. SQLite affinity alone is not validation.
// Configuration is checked strictly: unknown settings are rejected, never ignored.

import { PlatformError } from "../errors";
import type { PropertySettings, PropertyType, Sensitivity } from "./types";

// ---------------------------------------------------------------------------------------------
// Operators and the type table

export const OPERATORS = [
  "is", "is_not", "contains", "starts_with", "in", "not_in", "gt", "gte", "lt", "lte", "between",
  "before", "after", "on_or_before", "on_or_after", "contains_any", "contains_all", "is_empty", "is_not_empty"
] as const;
export type Operator = (typeof OPERATORS)[number];

export type TypeContract = {
  type: PropertyType;
  label: string;
  /** Where the value lives. "junction" means normalized rows in a separate table, not a column. */
  physical: "column" | "junction";
  /** SQLite column types accepted for this property type (empty for junction types). */
  sqliteTypes: string[];
  /** False for values the server assigns. Clients cannot write them. */
  writable: boolean;
  operators: Operator[];
  sortable: boolean;
  /** True when the property can be marked searchable (text-like values only). */
  searchable: boolean;
  /** True when the property type has a list of options. */
  usesOptions: boolean;
  /** How the value is edited, shown and moved in and out. Descriptive names used by later stories. */
  editor: string;
  display: string;
  importExport: string;
};

const TEXT_OPS: Operator[] = ["is", "is_not", "contains", "starts_with", "is_empty", "is_not_empty"];
const NUMBER_OPS: Operator[] = ["is", "is_not", "gt", "gte", "lt", "lte", "between", "is_empty", "is_not_empty"];
const OPTION_OPS: Operator[] = ["is", "is_not", "in", "not_in", "is_empty", "is_not_empty"];
const DATE_OPS: Operator[] = ["is", "before", "after", "on_or_before", "on_or_after", "between", "is_empty", "is_not_empty"];
const KEY_OPS: Operator[] = ["is", "is_not", "in", "is_empty", "is_not_empty"];

const contract = (c: TypeContract): TypeContract => c;

export const TYPE_CONTRACTS: Record<PropertyType, TypeContract> = {
  text: contract({ type: "text", label: "Text", physical: "column", sqliteTypes: ["TEXT"], writable: true, operators: TEXT_OPS, sortable: true, searchable: true, usesOptions: false, editor: "text", display: "text", importExport: "string" }),
  title: contract({ type: "title", label: "Title", physical: "column", sqliteTypes: ["TEXT"], writable: true, operators: TEXT_OPS, sortable: true, searchable: true, usesOptions: false, editor: "text", display: "title", importExport: "string" }),
  number: contract({ type: "number", label: "Number", physical: "column", sqliteTypes: ["INTEGER", "REAL"], writable: true, operators: NUMBER_OPS, sortable: true, searchable: false, usesOptions: false, editor: "number", display: "number", importExport: "number" }),
  currency: contract({ type: "currency", label: "Currency", physical: "column", sqliteTypes: ["INTEGER"], writable: true, operators: NUMBER_OPS, sortable: true, searchable: false, usesOptions: false, editor: "currency", display: "currency", importExport: "integer in stored units" }),
  select: contract({ type: "select", label: "Select", physical: "column", sqliteTypes: ["TEXT"], writable: true, operators: OPTION_OPS, sortable: true, searchable: false, usesOptions: true, editor: "select", display: "option", importExport: "option key" }),
  multiSelect: contract({ type: "multiSelect", label: "Multi-select", physical: "junction", sqliteTypes: [], writable: true, operators: ["contains_any", "contains_all", "is_empty", "is_not_empty"], sortable: false, searchable: false, usesOptions: true, editor: "multiSelect", display: "options", importExport: "list of option keys" }),
  status: contract({ type: "status", label: "Status", physical: "column", sqliteTypes: ["TEXT"], writable: true, operators: OPTION_OPS, sortable: true, searchable: false, usesOptions: true, editor: "status", display: "status", importExport: "option key" }),
  date: contract({ type: "date", label: "Date", physical: "column", sqliteTypes: ["TEXT"], writable: true, operators: DATE_OPS, sortable: true, searchable: false, usesOptions: false, editor: "date", display: "date", importExport: "YYYY-MM-DD" }),
  timestamp: contract({ type: "timestamp", label: "Timestamp", physical: "column", sqliteTypes: ["TEXT"], writable: true, operators: DATE_OPS, sortable: true, searchable: false, usesOptions: false, editor: "timestamp", display: "timestamp", importExport: "UTC ISO-8601" }),
  checkbox: contract({ type: "checkbox", label: "Checkbox", physical: "column", sqliteTypes: ["INTEGER"], writable: true, operators: ["is"], sortable: true, searchable: false, usesOptions: false, editor: "checkbox", display: "checkbox", importExport: "true or false" }),
  email: contract({ type: "email", label: "Email", physical: "column", sqliteTypes: ["TEXT"], writable: true, operators: TEXT_OPS, sortable: true, searchable: true, usesOptions: false, editor: "text", display: "email", importExport: "string" }),
  phone: contract({ type: "phone", label: "Phone", physical: "column", sqliteTypes: ["TEXT"], writable: true, operators: TEXT_OPS, sortable: true, searchable: true, usesOptions: false, editor: "text", display: "phone", importExport: "string" }),
  url: contract({ type: "url", label: "URL", physical: "column", sqliteTypes: ["TEXT"], writable: true, operators: TEXT_OPS, sortable: true, searchable: true, usesOptions: false, editor: "text", display: "url", importExport: "string" }),
  relation: contract({ type: "relation", label: "Relation", physical: "column", sqliteTypes: ["INTEGER", "TEXT"], writable: true, operators: KEY_OPS, sortable: false, searchable: false, usesOptions: false, editor: "relation", display: "relation", importExport: "target key" }),
  uniqueId: contract({ type: "uniqueId", label: "Unique ID", physical: "column", sqliteTypes: ["INTEGER"], writable: false, operators: ["is", "gt", "gte", "lt", "lte", "between"], sortable: true, searchable: false, usesOptions: false, editor: "none", display: "unique id", importExport: "integer" }),
  createdTime: contract({ type: "createdTime", label: "Created time", physical: "column", sqliteTypes: ["TEXT"], writable: false, operators: DATE_OPS, sortable: true, searchable: false, usesOptions: false, editor: "none", display: "timestamp", importExport: "UTC ISO-8601" }),
  lastEditedTime: contract({ type: "lastEditedTime", label: "Last edited time", physical: "column", sqliteTypes: ["TEXT"], writable: false, operators: DATE_OPS, sortable: true, searchable: false, usesOptions: false, editor: "none", display: "timestamp", importExport: "UTC ISO-8601" }),
  createdBy: contract({ type: "createdBy", label: "Created by", physical: "column", sqliteTypes: ["TEXT"], writable: false, operators: KEY_OPS, sortable: true, searchable: false, usesOptions: false, editor: "none", display: "actor", importExport: "actor id" }),
  lastEditedBy: contract({ type: "lastEditedBy", label: "Last edited by", physical: "column", sqliteTypes: ["TEXT"], writable: false, operators: KEY_OPS, sortable: true, searchable: false, usesOptions: false, editor: "none", display: "actor", importExport: "actor id" })
};

export const PROPERTY_TYPES = Object.keys(TYPE_CONTRACTS) as PropertyType[];
export const isPropertyType = (value: unknown): value is PropertyType => typeof value === "string" && Object.prototype.hasOwnProperty.call(TYPE_CONTRACTS, value);

/** Accepted SQLite column types per property type. Used by the compatibility inspection. */
export function acceptedSqliteTypes(type: PropertyType): string[] {
  return TYPE_CONTRACTS[type]?.sqliteTypes ?? [];
}

// ---------------------------------------------------------------------------------------------
// Errors

function invalid(message: string, field?: string): never {
  throw new PlatformError("PROPERTY_INVALID", message, 400, field ? { field } : undefined);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function onlyKeys(config: Record<string, unknown>, allowed: string[], type: string) {
  for (const key of Object.keys(config)) {
    if (!allowed.includes(key)) invalid(`The setting "${key}" is not available for ${type} properties.`, `config.${key}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Options (select, multi-select and status)

export const OPTION_COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;
export type OptionColor = (typeof OPTION_COLORS)[number];
export const STATUS_GROUPS = ["to_do", "in_progress", "complete"] as const;
export type StatusGroup = (typeof STATUS_GROUPS)[number];

export type PropertyOption = { key: string; label: string; color: OptionColor; active: boolean; group?: StatusGroup };

const MAX_OPTIONS = 100;
/** Keys are stable identifiers. Seeded options keep the strings already stored in the database, for example "Sold Out". */
const KEY_PATTERN = /^[^\s\u0000-\u001f](?:[^\u0000-\u001f]{0,58}[^\s\u0000-\u001f])?$/;

/** Makes a new option key from a label: lowercase letters, digits and underscores, unique among `taken`. */
export function newOptionKey(label: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "option";
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

function normalizeOptions(raw: unknown, type: PropertyType): PropertyOption[] {
  if (!Array.isArray(raw) || raw.length === 0) invalid(`A ${type} property needs at least one option.`, "config.options");
  if (raw.length > MAX_OPTIONS) invalid(`A property can have at most ${MAX_OPTIONS} options.`, "config.options");
  const options: PropertyOption[] = [];
  const keys = new Set<string>();
  const labels = new Set<string>();
  for (const [index, item] of (raw as unknown[]).entries()) {
    const at = `config.options[${index}]`;
    if (!isObject(item)) invalid("Each option must be an object.", at);
    onlyKeys(item, ["key", "label", "color", "active", "group"], "option");
    const label = typeof item.label === "string" ? item.label.trim() : "";
    if (label.length < 1 || label.length > 60) invalid("An option label must be 1 to 60 characters.", `${at}.label`);
    let key: string;
    if (item.key === undefined) key = newOptionKey(label, keys);
    else if (typeof item.key === "string" && KEY_PATTERN.test(item.key) && item.key.length <= 60) key = item.key;
    else invalid("An option key must be 1 to 60 characters, without control characters or surrounding spaces.", `${at}.key`);
    if (keys.has(key)) invalid(`Two options use the key "${key}".`, `${at}.key`);
    if (labels.has(label.toLowerCase())) invalid(`Two options are named "${label}".`, `${at}.label`);
    keys.add(key);
    labels.add(label.toLowerCase());
    const color = item.color === undefined ? "gray" : item.color;
    if (!(OPTION_COLORS as readonly unknown[]).includes(color)) invalid(`Option colors are: ${OPTION_COLORS.join(", ")}.`, `${at}.color`);
    if (item.active !== undefined && typeof item.active !== "boolean") invalid("Option active must be true or false.", `${at}.active`);
    const option: PropertyOption = { key, label, color: color as OptionColor, active: item.active ?? true };
    if (type === "status") {
      if (!(STATUS_GROUPS as readonly unknown[]).includes(item.group)) invalid(`Every status option needs a group: ${STATUS_GROUPS.join(", ")}.`, `${at}.group`);
      option.group = item.group as StatusGroup;
    } else if (item.group !== undefined) {
      invalid("Only status options have a group.", `${at}.group`);
    }
    options.push(option);
  }
  if (!options.some((o) => o.active)) invalid("At least one option must stay active.", "config.options");
  return options;
}

/**
 * Option keys are stable. Compared with the stored options, every key must still exist: an option is
 * deactivated, never removed, and renaming changes only the label. Removing an option that records use
 * would need reassigning those records, which is a data-rewriting operation (Story 04, Phase B).
 */
export function checkOptionChanges(before: PropertyOption[], after: PropertyOption[]): void {
  const kept = new Set(after.map((o) => o.key));
  const lost = before.filter((o) => !kept.has(o.key)).map((o) => o.key);
  if (lost.length) {
    throw new PlatformError("OPTION_REMOVED", `Options cannot be removed or given a new key (${lost.join(", ")}). Deactivate the option and add a new one instead.`, 409, { keys: lost });
  }
}

export const optionsOf = (config: Record<string, unknown>): PropertyOption[] => (Array.isArray(config.options) ? (config.options as PropertyOption[]) : []);

// ---------------------------------------------------------------------------------------------
// Configuration per type

export const NUMBER_FORMATS = ["plain", "separators", "percent"] as const;
export const DATE_FORMATS = ["iso", "dmy", "mdy"] as const;
export const RELATION_DELETE_BEHAVIORS = ["restrict", "set_null"] as const;
export const TEXT_MAX_LENGTH = { text: 2000, title: 200 } as const;
const MAX_TEXT_LIMIT = 10000;

let isoCurrencies: Set<string> | null = null;
/** True for a code on the ISO 4217 list. Falls back to the three-letter format if the runtime has no list. */
export function isIsoCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    if (typeof supported === "function") {
      isoCurrencies ??= new Set(supported.call(Intl, "currency"));
      return isoCurrencies.has(code);
    }
  } catch { /* fall back to the format check */ }
  return true;
}

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Validates the type-specific settings and returns them cleaned. Defaults are not added: they are applied when reading. */
export function normalizeConfig(type: PropertyType, raw: unknown): Record<string, unknown> {
  const config = raw === undefined || raw === null ? {} : raw;
  if (!isObject(config)) invalid("Settings must be an object.", "config");
  switch (type) {
    case "text":
    case "title": {
      onlyKeys(config, ["maxLength"], type);
      if (config.maxLength !== undefined && !isInt(config.maxLength, 1, MAX_TEXT_LIMIT)) invalid(`maxLength must be a whole number from 1 to ${MAX_TEXT_LIMIT}.`, "config.maxLength");
      return { ...config };
    }
    case "number": {
      onlyKeys(config, ["integer", "min", "max", "decimals", "format"], type);
      if (config.integer !== undefined && typeof config.integer !== "boolean") invalid("integer must be true or false.", "config.integer");
      for (const k of ["min", "max"] as const) if (config[k] !== undefined && !isFiniteNumber(config[k])) invalid(`${k} must be a finite number.`, `config.${k}`);
      if (isFiniteNumber(config.min) && isFiniteNumber(config.max) && config.min > config.max) invalid("min cannot be larger than max.", "config.min");
      if (config.decimals !== undefined) {
        if (!isInt(config.decimals, 0, 6)) invalid("decimals must be a whole number from 0 to 6.", "config.decimals");
        if (config.integer !== false) invalid("decimals applies only when integer is false.", "config.decimals");
      }
      if (config.format !== undefined && !(NUMBER_FORMATS as readonly unknown[]).includes(config.format)) invalid(`format must be one of: ${NUMBER_FORMATS.join(", ")}.`, "config.format");
      return { ...config };
    }
    case "currency": {
      onlyKeys(config, ["currency", "scale", "min", "max"], type);
      if (typeof config.currency !== "string" || !isIsoCurrency(config.currency)) invalid("currency must be an ISO 4217 code such as PKR.", "config.currency");
      if (config.scale !== undefined && !isInt(config.scale, 0, 4)) invalid("scale must be a whole number from 0 to 4: the number of minor-unit digits that are stored.", "config.scale");
      const scale = (config.scale as number | undefined) ?? 2;
      for (const k of ["min", "max"] as const) {
        const v = config[k];
        if (v !== undefined && (!isFiniteNumber(v) || v < 0 || !Number.isSafeInteger(v * 10 ** scale))) invalid(`${k} must be a non-negative amount in whole currency units that fits the stored scale.`, `config.${k}`);
      }
      if (isFiniteNumber(config.min) && isFiniteNumber(config.max) && config.min > config.max) invalid("min cannot be larger than max.", "config.min");
      return { ...config };
    }
    case "select":
    case "status":
    case "multiSelect": {
      onlyKeys(config, type === "multiSelect" ? ["options", "maxSelected", "junction"] : ["options"], type);
      // A property installed before options existed (seed version 1) has none. It stays valid and accepts
      // no values until options are configured. Options that are present are always validated in full.
      const out: Record<string, unknown> = { ...config };
      if (config.options !== undefined) out.options = normalizeOptions(config.options, type);
      if (type === "multiSelect") {
        if (config.maxSelected !== undefined && !isInt(config.maxSelected, 1, MAX_OPTIONS)) invalid(`maxSelected must be a whole number from 1 to ${MAX_OPTIONS}.`, "config.maxSelected");
        if (config.junction !== undefined) {
          const j = config.junction;
          if (!isObject(j)) invalid("junction must name the table and columns that hold the values.", "config.junction");
          onlyKeys(j, ["table", "recordColumn", "optionColumn"], "junction");
          for (const k of ["table", "recordColumn", "optionColumn"]) {
            if (typeof j[k] !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(j[k] as string)) invalid(`junction.${k} must be a lowercase identifier.`, `config.junction.${k}`);
          }
        }
      }
      return out;
    }
    case "date":
    case "timestamp": {
      onlyKeys(config, ["displayFormat"], type);
      if (config.displayFormat !== undefined && !(DATE_FORMATS as readonly unknown[]).includes(config.displayFormat)) invalid(`displayFormat must be one of: ${DATE_FORMATS.join(", ")}.`, "config.displayFormat");
      return { ...config };
    }
    case "relation": {
      onlyKeys(config, ["target", "displayProperty", "onDelete", "twoWay"], type);
      // The target is optional so relations installed before settings existed (seed version 1) stay valid.
      if (config.target !== undefined && (typeof config.target !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/.test(config.target))) invalid("target must be the key of a data source.", "config.target");
      if (config.target === undefined && (config.displayProperty !== undefined || config.onDelete !== undefined)) invalid("displayProperty and onDelete need a target.", "config.target");
      if (config.displayProperty !== undefined && (typeof config.displayProperty !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(config.displayProperty))) invalid("displayProperty must be a property key.", "config.displayProperty");
      if (config.onDelete !== undefined && !(RELATION_DELETE_BEHAVIORS as readonly unknown[]).includes(config.onDelete)) {
        invalid(`onDelete must be one of: ${RELATION_DELETE_BEHAVIORS.join(", ")}. Cascading deletes are not available in release 1.`, "config.onDelete");
      }
      if (config.twoWay !== undefined && config.twoWay !== false) invalid("Two-way relations are not available yet. Leave twoWay out or set it to false.", "config.twoWay");
      return { ...config };
    }
    case "uniqueId": {
      onlyKeys(config, ["prefix"], type);
      if (config.prefix !== undefined && (typeof config.prefix !== "string" || !/^[A-Za-z0-9-]{0,10}$/.test(config.prefix))) invalid("prefix must be up to 10 letters, digits or hyphens.", "config.prefix");
      return { ...config };
    }
    case "checkbox":
    case "email":
    case "phone":
    case "url":
    case "createdTime":
    case "lastEditedTime":
    case "createdBy":
    case "lastEditedBy":
      onlyKeys(config, [], type);
      return {};
  }
}

// ---------------------------------------------------------------------------------------------
// Value validation

export type ValueContext = { type: PropertyType; config: Record<string, unknown>; required?: boolean };
export type ValueResult = { ok: true; value: unknown } | { ok: false; message: string };
const ok = (value: unknown): ValueResult => ({ ok: true, value });
const bad = (message: string): ValueResult => ({ ok: false, message });

/** The largest stored integer, so arithmetic on stored values stays exact. */
export const MAX_STORED_INTEGER = Number.MAX_SAFE_INTEGER;

export function currencyScale(config: Record<string, unknown>): number {
  return typeof config.scale === "number" ? config.scale : 2;
}

/** Lowest and highest stored value of a currency property, in stored units. */
export function currencyBounds(config: Record<string, unknown>): { min: number; max: number } {
  const factor = 10 ** currencyScale(config);
  const min = typeof config.min === "number" ? config.min * factor : 0;
  const max = typeof config.max === "number" ? config.max * factor : MAX_STORED_INTEGER;
  return { min, max };
}

function validDate(year: number, month: number, day: number): boolean {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** A calendar date as YYYY-MM-DD, with no time zone conversion. */
export function parseDate(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m || !validDate(+m[1], +m[2], +m[3])) return null;
  return value;
}

/**
 * A UTC timestamp. Accepts ISO-8601 with Z or an offset, and the SQLite form "YYYY-MM-DD HH:MM:SS" that
 * the existing tables store (always UTC). Returns ISO-8601 in UTC with milliseconds, or null.
 */
export function parseTimestamp(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})([T ])(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, sep, h, mi, s, ms, zone] = m;
  if (sep === "T" && !zone) return null; // an ISO time without a zone is ambiguous
  if (sep === " " && zone) return null;
  if (!validDate(+y, +mo, +d) || +h > 23 || +mi > 59 || +s > 59) return null;
  let offsetMinutes = 0;
  if (zone && zone !== "Z") {
    const oh = +zone.slice(1, 3), om = +zone.slice(4, 6);
    if (oh > 23 || om > 59) return null;
    offsetMinutes = (oh * 60 + om) * (zone[0] === "-" ? -1 : 1);
  }
  const millis = ms ? +ms.padEnd(3, "0") : 0;
  const time = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, millis) - offsetMinutes * 60_000;
  const result = new Date(time);
  if (Number.isNaN(result.getTime()) || result.getUTCFullYear() < 1000 || result.getUTCFullYear() > 9999) return null;
  return result.toISOString();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks and normalizes one value for a property. Returns the value to store, or a plain message.
 * A missing value (null, undefined or blank text) is accepted unless the property is required.
 * Existence of a relation target is checked by the record write path (Story 06), not here.
 */
export function validateValue(ctx: ValueContext, input: unknown): ValueResult {
  const { type, config } = ctx;
  const contractFor = TYPE_CONTRACTS[type];
  if (!contractFor) return bad("Unknown property type.");
  if (!contractFor.writable) return bad("The server assigns this value. It cannot be set.");

  const blank = input === null || input === undefined || (typeof input === "string" && input.trim() === "") || (Array.isArray(input) && input.length === 0 && type === "multiSelect");
  if (blank) return ctx.required ? bad("A value is required.") : ok(type === "multiSelect" ? [] : null);

  switch (type) {
    case "text":
    case "title": {
      if (typeof input !== "string") return bad("Enter text.");
      const max = typeof config.maxLength === "number" ? config.maxLength : TEXT_MAX_LENGTH[type];
      const text = input.trim();
      return text.length > max ? bad(`Use at most ${max} characters.`) : ok(text);
    }
    case "number": {
      if (typeof input !== "number" || !Number.isFinite(input)) return bad("Enter a number.");
      const integer = config.integer !== false;
      if (integer && !Number.isSafeInteger(input)) return bad("Enter a whole number.");
      if (!integer) {
        const decimals = typeof config.decimals === "number" ? config.decimals : 2;
        const scaled = input * 10 ** decimals;
        if (Math.abs(scaled - Math.round(scaled)) > 1e-8 * Math.max(1, Math.abs(scaled))) return bad(`Use at most ${decimals} decimal places.`);
        if (!Number.isFinite(scaled) || Math.abs(input) > MAX_STORED_INTEGER) return bad("The number is too large.");
      }
      if (typeof config.min === "number" && input < config.min) return bad(`The smallest allowed value is ${config.min}.`);
      if (typeof config.max === "number" && input > config.max) return bad(`The largest allowed value is ${config.max}.`);
      return ok(input);
    }
    case "currency": {
      // The value is the stored integer: whole units when the scale is 0, minor units otherwise. Never a fraction.
      if (typeof input !== "number" || !Number.isSafeInteger(input)) return bad("Enter an amount as a whole number of stored units.");
      const { min, max } = currencyBounds(config);
      if (input < min) return bad(`The smallest allowed amount is ${min / 10 ** currencyScale(config)} ${config.currency ?? ""}.`.trim());
      if (input > max) return bad(`The largest allowed amount is ${max / 10 ** currencyScale(config)} ${config.currency ?? ""}.`.trim());
      return ok(input);
    }
    case "select":
    case "status": {
      if (typeof input !== "string") return bad("Choose one of the options.");
      const option = optionsOf(config).find((o) => o.key === input);
      if (!option) return bad("Choose one of the options.");
      return option.active ? ok(option.key) : bad(`The option "${option.label}" is no longer available.`);
    }
    case "multiSelect": {
      if (!Array.isArray(input) || input.some((v) => typeof v !== "string")) return bad("Choose options from the list.");
      const options = optionsOf(config);
      const chosen = new Set<string>();
      for (const key of input as string[]) {
        const option = options.find((o) => o.key === key);
        if (!option) return bad("Choose options from the list.");
        if (!option.active) return bad(`The option "${option.label}" is no longer available.`);
        chosen.add(key);
      }
      if (typeof config.maxSelected === "number" && chosen.size > config.maxSelected) return bad(`Choose at most ${config.maxSelected} options.`);
      return ok(options.filter((o) => chosen.has(o.key)).map((o) => o.key)); // deduplicated, in option order
    }
    case "date": {
      if (typeof input !== "string") return bad("Enter a date as YYYY-MM-DD.");
      const date = parseDate(input.trim());
      return date ? ok(date) : bad("Enter a real calendar date as YYYY-MM-DD.");
    }
    case "timestamp": {
      if (typeof input !== "string") return bad("Enter a timestamp.");
      const stamp = parseTimestamp(input.trim());
      return stamp ? ok(stamp) : bad("Enter a timestamp such as 2026-11-10T08:30:00Z, with Z or a UTC offset.");
    }
    case "checkbox": {
      if (typeof input !== "boolean") return bad("Use true or false.");
      return ok(input ? 1 : 0);
    }
    case "email": {
      if (typeof input !== "string") return bad("Enter an email address.");
      const email = input.trim().toLowerCase();
      return email.length <= 254 && EMAIL.test(email) ? ok(email) : bad("Enter a valid email address.");
    }
    case "phone": {
      if (typeof input !== "string") return bad("Enter a phone number.");
      if (/[^\d\s\-().+]/.test(input)) return bad("A phone number can contain digits, spaces, hyphens, parentheses and a leading plus.");
      const compact = input.replace(/[\s\-().]/g, "");
      return /^\+?\d{7,15}$/.test(compact) ? ok(compact) : bad("Enter a phone number with 7 to 15 digits.");
    }
    case "url": {
      if (typeof input !== "string") return bad("Enter a web address.");
      const text = input.trim();
      if (text.length > 2048) return bad("The web address is too long.");
      try {
        const url = new URL(text);
        if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) return bad("The web address must start with http:// or https://.");
        return ok(url.toString());
      } catch {
        return bad("Enter a valid web address.");
      }
    }
    case "relation": {
      if (typeof input === "number") return Number.isSafeInteger(input) && input > 0 ? ok(input) : bad("Choose a record.");
      if (typeof input === "string") {
        const key = input.trim();
        return key.length >= 1 && key.length <= 64 ? ok(key) : bad("Choose a record.");
      }
      return bad("Choose a record.");
    }
    default:
      return bad("This value cannot be set.");
  }
}

// ---------------------------------------------------------------------------------------------
// Whole property definition

export const SENSITIVITIES: Sensitivity[] = ["normal", "sensitive"];

export const SETTINGS_DEFAULTS: PropertySettings = { description: null, required: false, defaultValue: null, searchable: false, sensitivity: "normal", config: {} };

export type DefinitionInput = { type: PropertyType; nullable?: boolean } & Partial<PropertySettings>;

/**
 * Validates the settings of one property against its type and returns them cleaned. Used for seed
 * packages and for configuration changes, so both follow the same rules.
 */
export function normalizeSettings(input: DefinitionInput): PropertySettings {
  const { type } = input;
  const spec = TYPE_CONTRACTS[type];
  if (!spec) invalid(`Unknown property type "${String(type)}".`, "type");
  const config = normalizeConfig(type, input.config);
  if (type === "currency" && config.currency === undefined) invalid("A currency property needs a currency code.", "config.currency");

  const description = input.description === undefined || input.description === null || input.description === "" ? null : input.description;
  if (description !== null && (typeof description !== "string" || description.length > 500)) invalid("The description can have at most 500 characters.", "description");
  const required = input.required ?? false;
  if (typeof required !== "boolean") invalid("required must be true or false.", "required");
  const searchable = input.searchable ?? false;
  if (typeof searchable !== "boolean") invalid("searchable must be true or false.", "searchable");
  if (searchable && !spec.searchable) invalid(`${spec.label} properties cannot be searched.`, "searchable");
  const sensitivity = input.sensitivity ?? "normal";
  if (!SENSITIVITIES.includes(sensitivity)) invalid(`sensitivity must be one of: ${SENSITIVITIES.join(", ")}.`, "sensitivity");

  let defaultValue: unknown = input.defaultValue ?? null;
  if (!spec.writable) {
    if (defaultValue !== null || required) invalid(`${spec.label} values are assigned by the server, so they have no default and are never required from the user.`, "defaultValue");
  } else if (defaultValue !== null) {
    const result = validateValue({ type, config, required: false }, defaultValue);
    if (!result.ok) invalid(`The default value is not valid: ${result.message}`, "defaultValue");
    defaultValue = result.value;
  }
  if (type === "status" && optionsOf(config).length > 0 && defaultValue === null) invalid("A status property needs a default option.", "defaultValue");
  return { description, required, defaultValue, searchable, sensitivity, config };
}

/** True when a settings value equals the default, so it can be left out of seed values and snapshots. */
export function isDefaultSetting(key: keyof PropertySettings, value: unknown): boolean {
  if (key === "config") return isObject(value) && Object.keys(value).length === 0;
  return value === SETTINGS_DEFAULTS[key];
}

/** The public description of the type table, for the interface and for documentation. Reads no data. */
export function describeTypes() {
  return PROPERTY_TYPES.map((type) => {
    const c = TYPE_CONTRACTS[type];
    return { type, label: c.label, physical: c.physical, storage: c.sqliteTypes, writable: c.writable, operators: c.operators, sortable: c.sortable, searchable: c.searchable, usesOptions: c.usesOptions, editor: c.editor, display: c.display, importExport: c.importExport };
  });
}
