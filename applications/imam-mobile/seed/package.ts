// Imam Mobile seed package, version 2. The reference application (Story 01, slice 01c).
// Version 2 (Story 04, slice 04a) adds property settings: options for the select and status columns,
// whole-rupee currency settings for amounts, and relation targets. It adds no new items.
// Navigation mirrors the current application: Workspace (Dashboard, Inventory, Customers,
// Customer Entries, Sales) and Analyze (Reports). Admin Studio is not a module: it becomes configure mode (Story 07).
// Business records are never part of a seed package.

import type { SeedPackage, SeedProperty } from "../../../backend/src/platform/config/seed-types";

const p = (seedKey: string, label: string, type: SeedProperty["type"], nullable = false, columnName = seedKey, settings: Partial<SeedProperty> = {}): SeedProperty =>
  ({ seedKey, key: seedKey, label, columnName, type, nullable, ...settings });

// Option keys are the strings already stored in the database ("Sold Out", "In (+)"), so no stored value changes.
type Opt = [key: string, color: string, group?: string];
const options = (list: Opt[]) => list.map(([key, color, group]) => ({ key, label: key, color, ...(group ? { group } : {}) }));

// Amounts are stored as whole rupees (scale 0) from 0 to 100,000,000 PKR, as the owner specified on 2026-11-10.
const MAX_AMOUNT = 100_000_000;
const pkr = (min = 0) => ({ currency: "PKR", scale: 0, min, max: MAX_AMOUNT });
const relation = (target: string, displayProperty: string) => ({ target, displayProperty, onDelete: "restrict" });

export const imamMobileSeed: SeedPackage = {
  packageId: "imam-mobile",
  version: 2,
  minPlatformVersion: "0.1.0",
  applicationKey: "imam-mobile",
  application: { name: "Imam Mobile", description: "Mobile shop inventory, customers, credit ledger and sales." },
  menus: [
    {
      seedKey: "workspace", label: "Workspace", display: "section",
      modules: [
        { seedKey: "dashboard", pageSeedKey: "dashboard", label: "Dashboard", slug: "dashboard", icon: "layout-dashboard" },
        { seedKey: "inventory", pageSeedKey: "inventory", label: "Inventory", slug: "inventory", icon: "boxes" },
        { seedKey: "customers", pageSeedKey: "customers", label: "Customers", slug: "customers", icon: "users" },
        { seedKey: "customer-entries", pageSeedKey: "customer-entries", label: "Customer Entries", slug: "customer-entries", icon: "book-open" },
        { seedKey: "sales", pageSeedKey: "sales", label: "Sales", slug: "sales", icon: "shopping-cart" }
      ]
    },
    {
      seedKey: "analyze", label: "Analyze", display: "section",
      modules: [{ seedKey: "reports", pageSeedKey: "reports", label: "Reports", slug: "reports", icon: "activity" }]
    }
  ],
  pages: [
    { seedKey: "dashboard", title: "Dashboard", components: [{ seedKey: "dashboard-summary", type: "summary" }] },
    { seedKey: "inventory", title: "Inventory", components: [{ seedKey: "inventory-list", type: "list", dataSourceSeedKey: "devices" }] },
    { seedKey: "customers", title: "Customers", components: [{ seedKey: "customer-list", type: "list", dataSourceSeedKey: "customers" }] },
    { seedKey: "customer-entries", title: "Customer Entries", components: [{ seedKey: "ledger-list", type: "list", dataSourceSeedKey: "ledger" }] },
    { seedKey: "sales", title: "Sales", components: [{ seedKey: "sales-list", type: "list", dataSourceSeedKey: "sales" }] },
    { seedKey: "reports", title: "Reports", components: [] }
  ],
  dataSources: [
    {
      seedKey: "devices", key: "devices", label: "Devices", tableName: "mobile_devices",
      properties: [
        p("id", "ID", "uniqueId"), p("model", "Model", "title"), p("company", "Company", "text"), p("color", "Color", "text", true),
        p("condition", "Condition", "select", false, "condition", { config: { options: options([["Pack", "blue"], ["Used", "orange"]]) } }),
        p("status", "Status", "status", false, "status", { defaultValue: "Available", config: { options: options([["Available", "green", "to_do"], ["Booked", "yellow", "in_progress"], ["Sold Out", "gray", "complete"]]) } }),
        p("imei", "IMEI", "text"),
        p("purchase_price", "Purchase price", "currency", false, "purchase_price", { config: pkr() }), p("sale_price", "Sale price", "currency", true, "sale_price", { config: pkr() }),
        p("purchase_date", "Purchase date", "date"), p("sale_date", "Sale date", "date", true),
        p("created_at", "Created", "timestamp"), p("updated_at", "Updated", "timestamp")
      ]
    },
    {
      seedKey: "customers", key: "customers", label: "Customers", tableName: "customers",
      properties: [
        p("id", "ID", "uniqueId"), p("name", "Name", "title"), p("mobile_number", "Mobile number", "phone", true),
        p("type", "Type", "select", false, "type", { defaultValue: "Regular", config: { options: options([["Regular", "gray"], ["Account", "purple"]]) } }),
        p("created_at", "Created", "timestamp"), p("updated_at", "Updated", "timestamp")
      ]
    },
    {
      seedKey: "ledger", key: "ledger", label: "Customer entries", tableName: "customer_entries",
      properties: [
        p("id", "ID", "uniqueId"), p("customer_id", "Customer", "relation", false, "customer_id", { config: relation("customers", "name") }),
        p("sale_id", "Sale", "relation", true, "sale_id", { config: relation("sales", "invoice_number") }),
        p("device_id", "Device", "relation", true, "device_id", { config: relation("devices", "model") }), p("entry_date", "Date", "date"), p("due_date", "Due date", "date", true),
        p("direction", "Direction", "select", false, "direction", { config: { options: options([["In (+)", "green"], ["Out (-)", "red"]]) } }),
        p("amount", "Amount", "currency", false, "amount", { config: pkr(1) }), p("note", "Note", "text", true),
        p("created_at", "Created", "timestamp")
      ]
    },
    {
      seedKey: "sales", key: "sales", label: "Sales", tableName: "sales",
      properties: [
        p("id", "ID", "uniqueId"), p("invoice_number", "Invoice", "text"), p("customer_id", "Customer", "relation", true, "customer_id", { config: relation("customers", "name") }),
        p("sale_date", "Date", "date"), p("total_amount", "Total", "currency", false, "total_amount", { config: pkr() }),
        p("payment_type", "Payment type", "select", false, "payment_type", { config: { options: options([["Cash", "green"], ["Credit", "orange"]]) } }),
        p("status", "Status", "status", false, "status", { defaultValue: "Completed", config: { options: options([["Completed", "green", "complete"], ["Cancelled", "red", "complete"]]) } }), p("created_at", "Created", "timestamp")
      ]
    }
  ]
};
