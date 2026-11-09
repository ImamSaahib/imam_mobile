// Shapes of the normalized configuration rows and of the release snapshot (Contracts section 12).

export type PropertyType =
  | "text" | "title" | "number" | "currency" | "select" | "status" | "date" | "timestamp"
  | "checkbox" | "url" | "email" | "phone" | "relation" | "uniqueId";

export type ConfigRows = {
  application: { id: string; key: string; name: string; description: string | null; status: "active" | "disabled" };
  menus: { id: string; label: string; icon: string | null; display: "group" | "section"; position: number }[];
  modules: { id: string; menuId: string; pageId: string; label: string; slug: string; icon: string | null; badge: string | null; position: number; enabled: boolean }[];
  pages: { id: string; title: string; description: string | null }[];
  components: { id: string; pageId: string; type: string; typeVersion: number; position: number; config: Record<string, unknown> }[];
  dataSources: { id: string; key: string; label: string; tableName: string; primaryKey: string }[];
  properties: { id: string; dataSourceId: string; key: string; label: string; columnName: string; type: PropertyType; nullable: boolean; position: number }[];
};

export type Snapshot = {
  configSchemaVersion: number;
  minPlatformVersion: string;
  application: { id: string; key: string; name: string; description: string | null };
  menus: {
    id: string; label: string; icon: string | null; display: "group" | "section";
    modules: { id: string; label: string; slug: string; icon: string | null; badge: string | null; pageId: string; enabled: boolean }[];
  }[];
  pages: {
    id: string; title: string; description: string | null;
    components: { id: string; type: string; typeVersion: number; config: Record<string, unknown> }[];
  }[];
  dataSources: {
    id: string; key: string; label: string; tableName: string; primaryKey: string;
    properties: { id: string; key: string; label: string; columnName: string; type: PropertyType; nullable: boolean }[];
  }[];
};

/** The kinds of configuration item that a seed package can own. */
export type SeedItemType = "application" | "menu" | "module" | "page" | "component" | "dataSource" | "property";
