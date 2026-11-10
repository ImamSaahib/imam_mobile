import { describe, it, expect } from "vitest";
import {
  TYPE_CONTRACTS, PROPERTY_TYPES, OPERATORS, validateValue, normalizeConfig, normalizeSettings, newOptionKey, checkOptionChanges,
  parseDate, parseTimestamp, currencyBounds, acceptedSqliteTypes, describeTypes, isPropertyType, type PropertyOption
} from "../src/platform/config/property-types";
import { PlatformError } from "../src/platform/errors";
import type { PropertyType } from "../src/platform/config/types";

const errorCode = (fn: () => unknown): string | null => {
  try { fn(); } catch (e) { return e instanceof PlatformError ? e.code : "OTHER"; }
  return null;
};
const value = (type: PropertyType, input: unknown, config: Record<string, unknown> = {}, required = false) => validateValue({ type, config, required }, input);
const okValue = (type: PropertyType, input: unknown, config: Record<string, unknown> = {}) => {
  const r = value(type, input, config);
  if (!r.ok) throw new Error(`expected ok, got: ${r.message}`);
  return r.value;
};
const message = (type: PropertyType, input: unknown, config: Record<string, unknown> = {}) => {
  const r = value(type, input, config);
  if (r.ok) throw new Error(`expected a rejection, got ${JSON.stringify(r.value)}`);
  return r.message;
};

const PKR = { currency: "PKR", scale: 0, min: 0, max: 100_000_000 };
const option = (key: string, extra: Partial<PropertyOption> = {}): PropertyOption => ({ key, label: key, color: "gray", active: true, ...extra });

describe("type table", () => {
  it("describes every property type once, with operators from the shared list", () => {
    expect(PROPERTY_TYPES.length).toBe(19);
    for (const type of PROPERTY_TYPES) {
      const c = TYPE_CONTRACTS[type];
      expect(c.type).toBe(type);
      for (const op of c.operators) expect(OPERATORS as readonly string[]).toContain(op);
      expect(new Set(c.operators).size).toBe(c.operators.length);
      expect(c.operators.length, type).toBeGreaterThan(0);
    }
    expect(describeTypes().map((t) => t.type)).toEqual(PROPERTY_TYPES);
    expect(isPropertyType("currency")).toBe(true);
    expect(isPropertyType("toString")).toBe(false);
    expect(isPropertyType("formula")).toBe(false);
  });

  it("keeps list, filter, sort, search and import rules consistent per type (one table-driven check)", () => {
    for (const type of PROPERTY_TYPES) {
      const c = TYPE_CONTRACTS[type];
      // Server-assigned types cannot be edited, so they have no editor and no emptiness operators that imply user input.
      if (!c.writable) expect(c.editor, type).toBe("none");
      // A type with a range operator must be sortable, because a range implies an order.
      if (c.operators.includes("between") || c.operators.includes("gt") || c.operators.includes("before")) expect(c.sortable, type).toBe(true);
      // Text matching operators exist only for text-like types, and only those can be searched.
      const textLike = c.operators.includes("contains") && c.operators.includes("starts_with");
      expect(c.searchable, type).toBe(textLike);
      // Option types are the only ones with option operators and the only ones that use an option list.
      expect(c.usesOptions, type).toBe(["select", "multiSelect", "status"].includes(type));
      // A junction type stores no column, so it accepts no SQLite column type.
      expect(c.sqliteTypes.length === 0, type).toBe(c.physical === "junction");
      expect(acceptedSqliteTypes(type)).toEqual(c.sqliteTypes);
      expect(c.importExport.length, type).toBeGreaterThan(0);
    }
  });
});

describe("text, email, phone and url", () => {
  it("trims text, enforces the length limit and treats blank as empty", () => {
    expect(okValue("text", "  Galaxy A15 ")).toBe("Galaxy A15");
    expect(okValue("text", "   ")).toBeNull();
    expect(okValue("text", null)).toBeNull();
    expect(message("text", 5)).toMatch(/text/i);
    expect(message("title", "x".repeat(201))).toMatch(/200/);
    expect(okValue("title", "x".repeat(200))).toHaveLength(200);
    expect(message("text", "abcd", { maxLength: 3 })).toMatch(/3 characters/);
  });
  it("rejects a blank value when the property is required", () => {
    expect(value("text", "  ", {}, true)).toEqual({ ok: false, message: "A value is required." });
    expect(value("number", null, {}, true).ok).toBe(false);
  });
  it("normalizes emails and rejects malformed ones", () => {
    expect(okValue("email", " Imam@Example.COM ")).toBe("imam@example.com");
    for (const bad of ["no-at", "a@b", "a b@c.com", "@c.com", `${"a".repeat(250)}@x.com`]) expect(value("email", bad).ok, bad).toBe(false);
  });
  it("normalizes phone numbers to digits with an optional plus", () => {
    expect(okValue("phone", "0300-1234567")).toBe("03001234567");
    expect(okValue("phone", "+92 (300) 123 4567")).toBe("+923001234567");
    for (const bad of ["abc", "123456", "1234567890123456", "+92-300-12x", "++923001234567"]) expect(value("phone", bad).ok, bad).toBe(false);
  });
  it("accepts only http and https web addresses", () => {
    expect(okValue("url", "https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    for (const bad of ["javascript:alert(1)", "ftp://example.com", "example.com", "https://", "data:text/html,x"]) expect(value("url", bad).ok, bad).toBe(false);
  });
});

describe("number", () => {
  it("accepts whole numbers by default and rejects fractions, NaN, infinity and strings", () => {
    expect(okValue("number", 42)).toBe(42);
    for (const bad of [1.5, Number.NaN, Infinity, -Infinity, "5", true, Number.MAX_SAFE_INTEGER + 2]) expect(value("number", bad).ok, String(bad)).toBe(false);
  });
  it("applies the range and the decimal places", () => {
    expect(message("number", -1, { min: 0 })).toMatch(/smallest/);
    expect(message("number", 101, { max: 100 })).toMatch(/largest/);
    expect(okValue("number", 100, { max: 100 })).toBe(100);
    expect(okValue("number", 12.34, { integer: false, decimals: 2 })).toBe(12.34);
    expect(message("number", 12.345, { integer: false, decimals: 2 })).toMatch(/2 decimal/);
    expect(okValue("number", 0.1 + 0.2, { integer: false, decimals: 2 })).toBeCloseTo(0.3, 10);
  });
});

describe("currency (whole rupees, 0 to 100,000,000 PKR)", () => {
  it("accepts the whole range and rejects values outside it", () => {
    expect(okValue("currency", 0, PKR)).toBe(0);
    expect(okValue("currency", 28_500, PKR)).toBe(28_500);
    expect(okValue("currency", 100_000_000, PKR)).toBe(100_000_000);
    expect(message("currency", 100_000_001, PKR)).toMatch(/largest allowed amount is 100000000 PKR/);
    expect(message("currency", -1, PKR)).toMatch(/smallest/);
  });
  it("never accepts a fraction, a string or an unsafe integer", () => {
    for (const bad of [1.5, 0.1, "500", Number.NaN, Infinity, 2 ** 53, Number.MAX_SAFE_INTEGER + 1]) expect(value("currency", bad, PKR).ok, String(bad)).toBe(false);
  });
  it("applies the minimum, for example an amount that must be positive", () => {
    const positive = { ...PKR, min: 1 };
    expect(message("currency", 0, positive)).toMatch(/smallest allowed amount is 1 PKR/);
    expect(okValue("currency", 1, positive)).toBe(1);
  });
  it("stores minor units for a scale of 2, and bounds stay exact at 100 million", () => {
    const minor = { currency: "PKR", scale: 2, min: 0, max: 100_000_000 };
    expect(currencyBounds(minor)).toEqual({ min: 0, max: 10_000_000_000 });
    expect(okValue("currency", 10_000_000_000, minor)).toBe(10_000_000_000);
    expect(value("currency", 10_000_000_001, minor).ok).toBe(false);
    expect(currencyBounds(PKR)).toEqual({ min: 0, max: 100_000_000 });
    expect(currencyBounds({ currency: "PKR" }).max).toBe(Number.MAX_SAFE_INTEGER);
  });
  it("validates currency settings", () => {
    expect(errorCode(() => normalizeConfig("currency", { currency: "PKR", scale: 0, min: 0, max: 100_000_000 }))).toBeNull();
    expect(errorCode(() => normalizeConfig("currency", {}))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("currency", { currency: "pkr" }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("currency", { currency: "PK" }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("currency", { currency: "PKR", scale: 5 }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("currency", { currency: "PKR", scale: 1.5 }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("currency", { currency: "PKR", min: 10, max: 5 }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("currency", { currency: "PKR", min: -1 }))).toBe("PROPERTY_INVALID");
    // A limit that cannot be represented exactly at the stored scale is refused.
    expect(errorCode(() => normalizeConfig("currency", { currency: "PKR", scale: 4, max: 1e12 }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("currency", { currency: "PKR", extra: true }))).toBe("PROPERTY_INVALID");
  });
});

describe("select, multi-select and status", () => {
  const options = [option("Available", { group: "to_do" }), option("Booked", { group: "in_progress" }), option("Sold Out", { group: "complete", active: false })];
  it("accepts only active option keys, never labels or unknown keys", () => {
    expect(okValue("select", "Booked", { options })).toBe("Booked");
    expect(message("select", "Nope", { options })).toMatch(/Choose/);
    expect(message("select", "Sold Out", { options })).toMatch(/no longer available/);
    expect(message("status", 1, { options })).toMatch(/Choose/);
  });
  it("accepts no value when no options are configured (properties installed before options existed)", () => {
    expect(message("select", "Pack", {})).toMatch(/Choose/);
    expect(okValue("select", null, {})).toBeNull();
  });
  it("removes duplicates from a multi-select and returns the keys in option order", () => {
    const opts = [option("a"), option("b"), option("c")];
    expect(okValue("multiSelect", ["c", "a", "c"], { options: opts })).toEqual(["a", "c"]);
    expect(okValue("multiSelect", [], { options: opts })).toEqual([]);
    expect(message("multiSelect", ["a", "x"], { options: opts })).toMatch(/Choose/);
    expect(message("multiSelect", ["a", "b", "c"], { options: opts, maxSelected: 2 })).toMatch(/at most 2/);
    expect(message("multiSelect", "a", { options: opts })).toMatch(/Choose/);
  });
  it("builds readable, unique option keys", () => {
    expect(newOptionKey("Sold Out", [])).toBe("sold_out");
    expect(newOptionKey("Sold Out", ["sold_out"])).toBe("sold_out_2");
    expect(newOptionKey("Sold Out", ["sold_out", "sold_out_2"])).toBe("sold_out_3");
    expect(newOptionKey("???", [])).toBe("option");
  });
  it("validates the option list", () => {
    const cfg = (opts: unknown, type: PropertyType = "select") => () => normalizeConfig(type, { options: opts });
    expect(errorCode(cfg([{ label: "A" }]))).toBeNull();
    expect(errorCode(cfg([]))).toBe("PROPERTY_INVALID");
    expect(errorCode(cfg("x"))).toBe("PROPERTY_INVALID");
    expect(errorCode(cfg([{ label: "A", key: "k" }, { label: "B", key: "k" }]))).toBe("PROPERTY_INVALID");       // duplicate key
    expect(errorCode(cfg([{ label: "A" }, { label: "a" }]))).toBe("PROPERTY_INVALID");                              // duplicate label, any case
    expect(errorCode(cfg([{ label: "" }]))).toBe("PROPERTY_INVALID");
    expect(errorCode(cfg([{ label: "x".repeat(61) }]))).toBe("PROPERTY_INVALID");
    expect(errorCode(cfg([{ label: "A", color: "teal" }]))).toBe("PROPERTY_INVALID");
    expect(errorCode(cfg([{ label: "A", key: " lead" }]))).toBe("PROPERTY_INVALID");
    expect(errorCode(cfg([{ label: "A", key: "x".repeat(61) }]))).toBe("PROPERTY_INVALID");
    expect(errorCode(cfg([{ label: "A", active: false }]))).toBe("PROPERTY_INVALID");                               // none active
    expect(errorCode(cfg([{ label: "A", group: "to_do" }]))).toBe("PROPERTY_INVALID");                              // group only on status
    expect(errorCode(cfg([{ label: "A" }], "status"))).toBe("PROPERTY_INVALID");                                    // status needs a group
    expect(errorCode(cfg([{ label: "A", group: "later" }], "status"))).toBe("PROPERTY_INVALID");
    expect(errorCode(cfg([{ label: "A", surprise: 1 }]))).toBe("PROPERTY_INVALID");
    expect(errorCode(cfg(Array.from({ length: 101 }, (_, i) => ({ label: `o${i}` }))))).toBe("PROPERTY_INVALID");
    expect(errorCode(cfg(Array.from({ length: 100 }, (_, i) => ({ label: `o${i}` }))))).toBeNull();
  });
  it("keeps keys stable: rename, recolor, reorder and deactivate are allowed, removing is not", () => {
    const before = [option("a"), option("b"), option("c")];
    const changed = [option("c", { color: "red" }), { ...option("a"), label: "Alpha" }, option("b", { active: false }), option("d")];
    expect(errorCode(() => checkOptionChanges(before, changed))).toBeNull();
    expect(errorCode(() => checkOptionChanges(before, [option("a"), option("b")]))).toBe("OPTION_REMOVED");
    expect(errorCode(() => checkOptionChanges(before, [option("a"), option("b"), option("c2")]))).toBe("OPTION_REMOVED"); // a new key is a different option
  });
});

describe("date and timestamp", () => {
  it("accepts real calendar dates only", () => {
    expect(parseDate("2026-11-10")).toBe("2026-11-10");
    expect(parseDate("2024-02-29")).toBe("2024-02-29");
    for (const bad of ["2026-02-29", "2026-13-01", "2026-00-10", "2026-11-31", "2026-1-1", "26-11-10", "0999-01-01", "2026-11-10T00:00:00Z", " 2026-11-10", "10/11/2026"]) expect(parseDate(bad), bad).toBeNull();
    expect(okValue("date", " 2026-11-10 ")).toBe("2026-11-10");
    expect(value("date", 20261110).ok).toBe(false);
  });
  it("accepts leap day only in leap years, including century rules", () => {
    expect(parseDate("2000-02-29")).toBe("2000-02-29");
    expect(parseDate("1900-02-29")).toBeNull();
    expect(parseDate("2100-02-29")).toBeNull();
  });
  it("converts timestamps with an offset to UTC and requires a zone on ISO times", () => {
    expect(parseTimestamp("2026-11-10T08:30:00Z")).toBe("2026-11-10T08:30:00.000Z");
    expect(parseTimestamp("2026-11-10T13:30:00+05:00")).toBe("2026-11-10T08:30:00.000Z");
    expect(parseTimestamp("2026-11-10T03:30:00-05:00")).toBe("2026-11-10T08:30:00.000Z");
    expect(parseTimestamp("2026-11-10T08:30:00.5Z")).toBe("2026-11-10T08:30:00.500Z");
    expect(parseTimestamp("2026-11-10 08:30:00")).toBe("2026-11-10T08:30:00.000Z"); // the form SQLite datetime('now') stores, always UTC
    expect(parseTimestamp("2026-01-01T00:30:00+05:00")).toBe("2025-12-31T19:30:00.000Z"); // crosses a year boundary
    for (const bad of ["2026-11-10T08:30:00", "2026-11-10 08:30:00Z", "2026-11-10T24:00:00Z", "2026-11-10T23:59:60Z", "2026-11-10T08:60:00Z", "2026-02-30T08:30:00Z", "2026-11-10T08:30:00+24:00", "yesterday", "2026-11-10"]) expect(parseTimestamp(bad), bad).toBeNull();
    expect(okValue("timestamp", "2026-11-10T13:30:00+05:00")).toBe("2026-11-10T08:30:00.000Z");
    expect(message("timestamp", "2026-11-10")).toMatch(/Z or a UTC offset/);
  });
});

describe("checkbox, relation and server-assigned types", () => {
  it("stores a checkbox as 1 or 0 and accepts only booleans", () => {
    expect(okValue("checkbox", true)).toBe(1);
    expect(okValue("checkbox", false)).toBe(0);
    for (const bad of ["true", 1, 0, "yes"]) expect(value("checkbox", bad).ok, String(bad)).toBe(false);
  });
  it("accepts a positive integer or a short key as a relation target value", () => {
    expect(okValue("relation", 12)).toBe(12);
    expect(okValue("relation", " c_01 ")).toBe("c_01");
    for (const bad of [0, -3, 1.5, {}, [], "x".repeat(65)]) expect(value("relation", bad).ok, String(bad)).toBe(false);
  });
  it("refuses to set values the server assigns", () => {
    for (const type of ["uniqueId", "createdTime", "lastEditedTime", "createdBy", "lastEditedBy"] as PropertyType[]) {
      expect(message(type, "x"), type).toMatch(/server assigns/);
      expect(message(type, null), type).toMatch(/server assigns/);
    }
  });
});

describe("property settings", () => {
  const status = { type: "status" as const, config: { options: [{ label: "Open", key: "open", group: "to_do" }, { label: "Done", key: "done", group: "complete", active: false }] } };
  it("requires a default option for a status property that has options, and the default must be active", () => {
    expect(errorCode(() => normalizeSettings(status))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeSettings({ ...status, defaultValue: "done" }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeSettings({ ...status, defaultValue: "missing" }))).toBe("PROPERTY_INVALID");
    expect(normalizeSettings({ ...status, defaultValue: "open" }).defaultValue).toBe("open");
    // Installed before options existed: still valid.
    expect(errorCode(() => normalizeSettings({ type: "status" }))).toBeNull();
  });
  it("checks the default value with the same rules as a written value", () => {
    expect(errorCode(() => normalizeSettings({ type: "currency", config: PKR, defaultValue: 100_000_001 }))).toBe("PROPERTY_INVALID");
    expect(normalizeSettings({ type: "currency", config: PKR, defaultValue: 0 }).defaultValue).toBe(0);
    expect(normalizeSettings({ type: "checkbox", defaultValue: false }).defaultValue).toBe(0);
    expect(normalizeSettings({ type: "email", defaultValue: "A@B.CO" }).defaultValue).toBe("a@b.co");
  });
  it("rejects searchable on types that cannot be searched, and defaults on server-assigned types", () => {
    expect(errorCode(() => normalizeSettings({ type: "number", searchable: true }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeSettings({ type: "text", searchable: true }))).toBeNull();
    expect(errorCode(() => normalizeSettings({ type: "uniqueId", required: true }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeSettings({ type: "createdTime", defaultValue: "2026-01-01T00:00:00Z" }))).toBe("PROPERTY_INVALID");
  });
  it("rejects unknown types, bad sensitivity and long descriptions", () => {
    expect(errorCode(() => normalizeSettings({ type: "formula" as never }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeSettings({ type: "text", sensitivity: "secret" as never }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeSettings({ type: "text", description: "x".repeat(501) }))).toBe("PROPERTY_INVALID");
    expect(normalizeSettings({ type: "text", description: "" }).description).toBeNull();
  });
  it("rejects unknown settings instead of ignoring them", () => {
    expect(errorCode(() => normalizeConfig("text", { maxLenght: 5 }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("checkbox", { x: 1 }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("uniqueId", { prefix: "INV-" }))).toBeNull();
    expect(errorCode(() => normalizeConfig("uniqueId", { prefix: "has space" }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("text", "oops"))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("date", { displayFormat: "us" }))).toBe("PROPERTY_INVALID");
  });
  it("validates relation settings and refuses cascading deletes and two-way relations", () => {
    expect(errorCode(() => normalizeConfig("relation", { target: "customers", displayProperty: "name", onDelete: "restrict" }))).toBeNull();
    expect(errorCode(() => normalizeConfig("relation", {}))).toBeNull(); // installed before targets existed
    expect(errorCode(() => normalizeConfig("relation", { displayProperty: "name" }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("relation", { target: "Customers" }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("relation", { target: "customers", onDelete: "cascade" }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("relation", { target: "customers", twoWay: true }))).toBe("PROPERTY_INVALID");
  });
  it("validates number settings", () => {
    expect(errorCode(() => normalizeConfig("number", { min: 0, max: 10, integer: true }))).toBeNull();
    expect(errorCode(() => normalizeConfig("number", { min: 10, max: 0 }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("number", { decimals: 2 }))).toBe("PROPERTY_INVALID");            // decimals need integer: false
    expect(errorCode(() => normalizeConfig("number", { integer: false, decimals: 7 }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("number", { min: Number.NaN }))).toBe("PROPERTY_INVALID");
    expect(errorCode(() => normalizeConfig("number", { format: "roman" }))).toBe("PROPERTY_INVALID");
  });
});
