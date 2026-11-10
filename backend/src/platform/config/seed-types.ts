// Seed package contract (Contracts sections 2 and 12.7). A package is trusted code compiled into the Worker.
// Positions come from array order. Seed keys are stable and never derived from labels.

import type { PropertyType, PropertySettings } from "./types";

export type SeedProperty = { seedKey: string; key: string; label: string; columnName: string; type: PropertyType; nullable: boolean } & Partial<PropertySettings>;
export type SeedDataSource = { seedKey: string; key: string; label: string; tableName: string; primaryKey?: string; properties: SeedProperty[] };
export type SeedComponent = { seedKey: string; type: string; typeVersion?: number; dataSourceSeedKey?: string; config?: Record<string, unknown> };
export type SeedPage = { seedKey: string; title: string; description?: string; components: SeedComponent[] };
export type SeedModule = { seedKey: string; pageSeedKey: string; label: string; slug: string; icon?: string; badge?: string; enabled?: boolean };
export type SeedMenu = { seedKey: string; label: string; icon?: string; display: "group" | "section"; modules: SeedModule[] };

export type SeedPackage = {
  /** Stable package identity, for example "imam-mobile". */
  packageId: string;
  /** Positive integer, increased for every upstream release of the package. */
  version: number;
  /** Lowest platform version that can run this package. */
  minPlatformVersion: string;
  applicationKey: string;
  application: { name: string; description?: string };
  menus: SeedMenu[];
  pages: SeedPage[];
  dataSources: SeedDataSource[];
};
