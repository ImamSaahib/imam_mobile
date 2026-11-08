import { env } from "cloudflare:workers";
import worker from "../src/index.js";

export const ORIGIN = "https://imam-mobile-dev.pages.dev";

export async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const init: RequestInit = { method, headers: { Origin: ORIGIN, ...headers } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  const response = await worker.fetch(new Request("https://api.test" + path, init), env);
  const text = await response.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json, headers: response.headers };
}

let imeiCounter = 0;
export function deviceBody(overrides: Record<string, unknown> = {}) {
  imeiCounter += 1;
  return {
    model: "Galaxy A15", company: "Samsung", color: "Black", condition: "Pack",
    status: "Available", imei: "35000000000" + String(imeiCounter).padStart(4, "0"),
    purchasePrice: 40000, purchaseDate: "2026-11-01", ...overrides
  };
}

export async function createDevice(overrides: Record<string, unknown> = {}) {
  const r = await call("POST", "/api/devices", deviceBody(overrides));
  if (r.status !== 201) throw new Error("device setup failed: " + JSON.stringify(r.json));
  return r.json.id as number;
}

export async function createCustomer(name = "Ali Khan") {
  const r = await call("POST", "/api/customers", { name, mobileNumber: "03001234567", type: "Regular" });
  if (r.status !== 201) throw new Error("customer setup failed: " + JSON.stringify(r.json));
  return r.json.id as number;
}
