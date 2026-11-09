// SQL for writing one configuration item. Shared by seed installation and seed upgrades so that
// both write the same columns. All statements are returned unexecuted so callers can put them in one batch.

import { canonicalJson } from "./canonical";
import type { SeedItemType } from "./types";

export type Stamp = { now: string; by: string | null };
type Row = { id: string } & Record<string, any>;

/** Insert order that satisfies foreign keys. */
export const INSERT_ORDER: SeedItemType[] = ["application", "page", "menu", "dataSource", "module", "component", "property"];

export function insertStatement(db: D1Database, type: SeedItemType, x: Row, applicationId: string, s: Stamp): D1PreparedStatement {
  const st = [s.now, s.now, s.by, s.by] as const;
  switch (type) {
    case "application":
      return db.prepare("INSERT INTO cfg_application (id,key,name,description,status,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?)").bind(x.id, x.key, x.name, x.description, x.status, ...st);
    case "page":
      return db.prepare("INSERT INTO cfg_page (id,application_id,title,description,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?)").bind(x.id, applicationId, x.title, x.description, ...st);
    case "menu":
      return db.prepare("INSERT INTO cfg_menu (id,application_id,label,icon,display,position,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(x.id, applicationId, x.label, x.icon, x.display, x.position, ...st);
    case "module":
      return db.prepare("INSERT INTO cfg_module (id,application_id,menu_id,page_id,label,slug,icon,badge,position,enabled,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(x.id, applicationId, x.menuId, x.pageId, x.label, x.slug, x.icon, x.badge, x.position, x.enabled ? 1 : 0, ...st);
    case "component":
      return db.prepare("INSERT INTO cfg_component (id,page_id,type,type_version,position,config_json,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(x.id, x.pageId, x.type, x.typeVersion, x.position, canonicalJson(x.config), ...st);
    case "dataSource":
      return db.prepare("INSERT INTO cfg_data_source (id,application_id,key,label,table_name,primary_key,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(x.id, applicationId, x.key, x.label, x.tableName, x.primaryKey, ...st);
    case "property":
      return db.prepare("INSERT INTO cfg_property (id,data_source_id,key,label,column_name,type,nullable,position,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(x.id, x.dataSourceId, x.key, x.label, x.columnName, x.type, x.nullable ? 1 : 0, x.position, ...st);
  }
}

export function updateStatement(db: D1Database, type: SeedItemType, x: Row, s: Stamp): D1PreparedStatement {
  const st = [s.now, s.by, x.id] as const;
  switch (type) {
    case "application":
      return db.prepare("UPDATE cfg_application SET name=?,description=?,status=?,updated_at=?,updated_by=? WHERE id=?").bind(x.name, x.description, x.status, ...st);
    case "page":
      return db.prepare("UPDATE cfg_page SET title=?,description=?,updated_at=?,updated_by=? WHERE id=?").bind(x.title, x.description, ...st);
    case "menu":
      return db.prepare("UPDATE cfg_menu SET label=?,icon=?,display=?,position=?,updated_at=?,updated_by=? WHERE id=?").bind(x.label, x.icon, x.display, x.position, ...st);
    case "module":
      return db.prepare("UPDATE cfg_module SET menu_id=?,page_id=?,label=?,slug=?,icon=?,badge=?,position=?,enabled=?,updated_at=?,updated_by=? WHERE id=?").bind(x.menuId, x.pageId, x.label, x.slug, x.icon, x.badge, x.position, x.enabled ? 1 : 0, ...st);
    case "component":
      return db.prepare("UPDATE cfg_component SET page_id=?,type=?,type_version=?,position=?,config_json=?,updated_at=?,updated_by=? WHERE id=?").bind(x.pageId, x.type, x.typeVersion, x.position, canonicalJson(x.config), ...st);
    case "dataSource":
      return db.prepare("UPDATE cfg_data_source SET key=?,label=?,table_name=?,primary_key=?,updated_at=?,updated_by=? WHERE id=?").bind(x.key, x.label, x.tableName, x.primaryKey, ...st);
    case "property":
      return db.prepare("UPDATE cfg_property SET data_source_id=?,key=?,label=?,column_name=?,type=?,nullable=?,position=?,updated_at=?,updated_by=? WHERE id=?").bind(x.dataSourceId, x.key, x.label, x.columnName, x.type, x.nullable ? 1 : 0, x.position, ...st);
  }
}
