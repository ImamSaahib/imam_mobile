// Frozen copy of seed package version 1 as installed in the dev database. Do not edit. Tests install it as the baseline for upgrades to version 2.
// Navigation mirrors the current application: Workspace (Dashboard, Inventory, Customers,
// Customer Entries, Sales) and Analyze (Reports). Admin Studio is not a module: it becomes configure mode (Story 07).
// Business records are never part of a seed package.

import type { SeedPackage, SeedProperty } from "../../src/platform/config/seed-types";

const p = (seedKey: string, label: string, type: SeedProperty["type"], nullable = false, columnName = seedKey): SeedProperty =>
  ({ seedKey, key: seedKey, label, columnName, type, nullable });

export const imamMobileSeedV1: SeedPackage = {
  packageId: "imam-mobile",
  version: 1,
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
        p("condition", "Condition", "select"), p("status", "Status", "status"), p("imei", "IMEI", "text"),
        p("purchase_price", "Purchase price", "number"), p("sale_price", "Sale price", "number", true),
        p("purchase_date", "Purchase date", "date"), p("sale_date", "Sale date", "date", true),
        p("created_at", "Created", "timestamp"), p("updated_at", "Updated", "timestamp")
      ]
    },
    {
      seedKey: "customers", key: "customers", label: "Customers", tableName: "customers",
      properties: [
        p("id", "ID", "uniqueId"), p("name", "Name", "title"), p("mobile_number", "Mobile number", "phone", true),
        p("type", "Type", "select"), p("created_at", "Created", "timestamp"), p("updated_at", "Updated", "timestamp")
      ]
    },
    {
      seedKey: "ledger", key: "ledger", label: "Customer entries", tableName: "customer_entries",
      properties: [
        p("id", "ID", "uniqueId"), p("customer_id", "Customer", "relation"), p("sale_id", "Sale", "relation", true),
        p("device_id", "Device", "relation", true), p("entry_date", "Date", "date"), p("due_date", "Due date", "date", true),
        p("direction", "Direction", "select"), p("amount", "Amount", "number"), p("note", "Note", "text", true),
        p("created_at", "Created", "timestamp")
      ]
    },
    {
      seedKey: "sales", key: "sales", label: "Sales", tableName: "sales",
      properties: [
        p("id", "ID", "uniqueId"), p("invoice_number", "Invoice", "text"), p("customer_id", "Customer", "relation", true),
        p("sale_date", "Date", "date"), p("total_amount", "Total", "number"), p("payment_type", "Payment type", "select"),
        p("status", "Status", "status"), p("created_at", "Created", "timestamp")
      ]
    }
  ]
};
