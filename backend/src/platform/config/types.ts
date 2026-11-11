// Shapes of the normalized configuration rows and of the release snapshot (Contracts section 12).

export type PropertyType =
  | "text" | "title" | "number" | "currency" | "select" | "multiSelect" | "status" | "date" | "timestamp"
  | "checkbox" | "url" | "email" | "phone" | "relation" | "uniqueId"
  | "createdTime" | "lastEditedTime" | "createdBy" | "lastEditedBy";

export type Sensitivity = "normal" | "sensitive";

/** Configuration of one property beyond its column mapping (Story 04). Defaults are omitted from seed values and snapshots. */
export type PropertySettings = {
  description: string | null;
  required: boolean;
  /** The default value, or null for none. A checkbox default of false is a value, not "none". */
  defaultValue: unknown;
  searchable: boolean;
  sensitivity: Sensitivity;
  /** Kept in the table and the configuration, left out of forms and lists. Changed by the hide_property operation. */
  hidden: boolean;
  /** Why a searchable property has no index. Needed to mark a property searchable on a table over 1,000 rows without an index. */
  indexExceptionReason: string | null;
  /** Type-specific settings: options, number and currency format, relation target, unique ID prefix. */
  config: Record<string, unknown>;
};

export type ConfigRows = {
  application: { id: string; key: string; name: string; description: string | null; status: "active" | "disabled" };
  menus: { id: string; label: string; icon: string | null; display: "group" | "section"; position: number }[];
  modules: { id: string; menuId: string; pageId: string; label: string; slug: string; icon: string | null; badge: string | null; position: number; enabled: boolean }[];
  pages: { id: string; title: string; description: string | null }[];
  components: { id: string; pageId: string; type: string; typeVersion: number; position: number; config: Record<string, unknown> }[];
  dataSources: { id: string; key: string; label: string; tableName: string; primaryKey: string }[];
  properties: ({ id: string; dataSourceId: string; key: string; label: string; columnName: string; type: PropertyType; nullable: boolean; position: number } & PropertySettings)[];
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
    /** Settings appear only when they differ from the default, so releases of unchanged properties keep their shape. */
    properties: ({ id: string; key: string; label: string; columnName: string; type: PropertyType; nullable: boolean } & Partial<PropertySettings>)[];
  }[];
};

/** The kinds of configuration item that a seed package can own. */
export type SeedItemType = "application" | "menu" | "module" | "page" | "component" | "dataSource" | "property";
