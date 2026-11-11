import { matchRoute, getActor, authorize, policyHealth } from "./platform/policy.ts";
import { handlePlatformRoute } from "./platform/routes.ts";
import { meterDb, newUsage } from "./platform/usage.ts";
import { countersOnCreate, countersOnDelete, countersOnGroupChange, versionBump } from "./platform/counters.ts";
import { governor, rateLimiter, isLimitError, nextResetIso, CORE_PERMISSIONS } from "./platform/governor.ts";

const FRONTEND_ORIGIN = "https://imam-mobile.pages.dev";
const ALLOWED_ORIGINS = [
  FRONTEND_ORIGIN,
  "https://imam-mobile-dev.pages.dev"
];

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : FRONTEND_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers": "ETag, Retry-After, X-Resource-State",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function json(data, status = 200, origin = FRONTEND_ORIGIN) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function error(message, status = 400, origin) { return json({ error: message }, status, origin); }
// Revalidated by the browser on every use and never cached at the edge (Decisions D13): a publish shows on the next request.
function revalidatedJson(request, data, version, status = 200, origin = FRONTEND_ORIGIN) {
  const etag = '"cfg-' + version + '"';
  const headers = { ...corsHeaders(origin), "Cache-Control": "no-cache", "ETag": etag };
  if ((request.headers.get("If-None-Match") || "").split(",").some((t) => t.trim().replace(/^W\//, "") === etag)) return new Response(null, { status: 304, headers });
  return new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
}
function limitResponse(origin, now = Date.now()) {
  const resetAt = nextResetIso(now);
  const seconds = Math.max(1, Math.ceil((Date.parse(resetAt) - now) / 1000));
  return new Response(JSON.stringify({ error: "The daily usage limit has been reached. Everything works again at 00:00 UTC.", code: "DAILY_LIMIT_REACHED", resetAt }), { status: 503, headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Retry-After": String(seconds) } });
}
async function readJson(request) { try { return await request.json(); } catch { return null; } }
function deviceRow(r) {
  return { id:r.id, model:r.model, company:r.company, color:r.color, condition:r.condition, status:r.status, imei:r.imei, purchasePrice:r.purchase_price, salePrice:r.sale_price ?? 0, purchaseDate:r.purchase_date, saleDate:r.sale_date || "" };
}
function customerRow(r) { return { id:r.id, name:r.name, mobileNumber:r.mobile_number || "", type:r.type }; }
function entryRow(r) {
  return { id:r.id, customerId:r.customer_id, saleId:r.sale_id, deviceId:r.device_id, date:r.entry_date, dueDate:r.due_date || "", direction:r.direction, amount:r.amount, note:r.note || "" };
}
function validId(value) { return /^\d+$/.test(String(value)) && Number(value) > 0; }

async function handleRequest(request, env) {
    const origin = request.headers.get("Origin") || FRONTEND_ORIGIN;
    if (request.method === "OPTIONS") return new Response(null, { status:204, headers:corsHeaders(origin) });
    if (request.headers.has("Origin") && !ALLOWED_ORIGINS.includes(origin)) return error("Origin not allowed.",403,origin);
    if (!env.DB) return error("Database binding DB is not configured.",500,origin);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/,"") || "/";
    const parts = path.split("/").filter(Boolean);
    // Placeholder policy layer (Decisions D7): one decision point for every route.
    const route = matchRoute(request.method, path);
    const actor = getActor(request, env);
    if (route && !authorize(actor, route.permission)) return error("You do not have access to this action.",403,origin);
    const actorId = actor ? actor.id : null;
    try {
      // Published configuration is read-only and cached briefly at the edge/browser.
      if (path === "/api/configuration" && request.method === "GET") {
        const row = await env.DB.prepare("SELECT published_json, published_version, updated_at FROM app_configuration WHERE id=1").first();
        if (!row) return revalidatedJson(request,{ configuration:null, version:0 },0,200,origin);
        return revalidatedJson(request,{ configuration:JSON.parse(row.published_json), version:row.published_version, updatedAt:row.updated_at },row.published_version,200,origin);
      }
      if (path === "/api/admin/configuration" && request.method === "GET") {
        if (!env.ADMIN_CONFIG_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.ADMIN_CONFIG_TOKEN) return error("Admin configuration access is not authorized. Configure ADMIN_CONFIG_TOKEN on the Worker.",401,origin);
        const row = await env.DB.prepare("SELECT draft_json,published_json,published_version FROM app_configuration WHERE id=1").first();
        if (!row) return json({ draft:null, published:null, version:0 },200,origin);
        return json({ draft:JSON.parse(row.draft_json), published:JSON.parse(row.published_json), version:row.published_version },200,origin);
      }
      if (path === "/api/admin/configuration" && request.method === "PUT") {
        if (!env.ADMIN_CONFIG_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.ADMIN_CONFIG_TOKEN) return error("Admin configuration access is not authorized.",401,origin);
        const body = await readJson(request);
        const configuration = body?.configuration;
        if (!configuration || configuration.schemaVersion !== 1 || !Array.isArray(configuration.pages) || !Array.isArray(configuration.components) || !Array.isArray(configuration.fields) || !Array.isArray(configuration.reports)) return error("Configuration structure is invalid.",400,origin);
        if (JSON.stringify(configuration).length > 100000) return error("Configuration is too large.",413,origin);
        const serialized = JSON.stringify(configuration);
        await env.DB.prepare(`INSERT INTO app_configuration (id,draft_json,published_json,published_version) VALUES (1,?,?,1) ON CONFLICT(id) DO UPDATE SET draft_json=excluded.draft_json,updated_at=datetime('now')`).bind(serialized,serialized).run();
        return json({ saved:true },200,origin);
      }
      if (path === "/api/admin/configuration/publish" && request.method === "POST") {
        if (!env.ADMIN_CONFIG_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.ADMIN_CONFIG_TOKEN) return error("Admin configuration access is not authorized.",401,origin);
        const current = await env.DB.prepare("SELECT draft_json,published_version FROM app_configuration WHERE id=1").first();
        if (!current) return error("Save a draft before publishing.",409,origin);
        const nextVersion = Number(current.published_version) + 1;
        const statements = [
          env.DB.prepare("INSERT INTO configuration_versions (version,configuration_json,summary) VALUES (?,?,?)").bind(nextVersion,current.draft_json,(await readJson(request))?.summary || "Configuration published"),
          env.DB.prepare("UPDATE app_configuration SET published_json=draft_json,published_version=?,updated_at=datetime('now') WHERE id=1").bind(nextVersion)
        ];
        await env.DB.batch(statements);
        return json({ published:true, version:nextVersion },200,origin);
      }

      if (path === "/api/admin/configuration/versions" && request.method === "GET") {
        if (!env.ADMIN_CONFIG_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.ADMIN_CONFIG_TOKEN) return error("Admin configuration access is not authorized.",401,origin);
        const result = await env.DB.prepare("SELECT version,summary,created_at FROM configuration_versions ORDER BY version DESC LIMIT 20").all();
        return json({versions:result.results},200,origin);
      }
      if (path === "/api/admin/configuration/restore" && request.method === "POST") {
        if (!env.ADMIN_CONFIG_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.ADMIN_CONFIG_TOKEN) return error("Admin configuration access is not authorized.",401,origin);
        const body = await readJson(request);
        const version = Number(body?.version);
        if (!Number.isInteger(version) || version < 1) return error("A valid configuration version is required.",400,origin);
        const row = await env.DB.prepare("SELECT configuration_json FROM configuration_versions WHERE version=?").bind(version).first();
        if (!row) return error("Configuration version not found.",404,origin);
        const configuration = JSON.parse(row.configuration_json);
        if (!configuration || configuration.schemaVersion !== 1 || !Array.isArray(configuration.pages) || !Array.isArray(configuration.components) || !Array.isArray(configuration.fields) || !Array.isArray(configuration.reports)) return error("Stored configuration version is invalid.",409,origin);
        await env.DB.prepare("UPDATE app_configuration SET draft_json=?,updated_at=datetime('now') WHERE id=1").bind(JSON.stringify(configuration)).run();
        return json({restored:true,configuration},200,origin);
      }

      if (path === "/api/admin/schema/add-column" && request.method === "POST") {
        if (!env.ADMIN_CONFIG_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.ADMIN_CONFIG_TOKEN) return error("Admin configuration access is not authorized.",401,origin);
        const body = await readJson(request);
        const allowedTables = new Set(["mobile_devices","customers","sales","customer_entries"]);
        const allowedTypes = new Set(["TEXT","INTEGER","REAL"]);
        const table = String(body?.table || "");
        const column = String(body?.column || "");
        const type = String(body?.type || "").toUpperCase();
        if (!allowedTables.has(table) || !/^[a-z][a-z0-9_]{0,39}$/.test(column) || !allowedTypes.has(type)) return error("Invalid table, column or type.",400,origin);
        const existing = await env.DB.prepare("PRAGMA table_info(" + table + ")").all();
        if (existing.results.some(c => c.name === column)) return error("That column already exists.",409,origin);
        try {
          await env.DB.prepare("ALTER TABLE " + table + " ADD COLUMN " + column + " " + type).run();
          await env.DB.prepare("INSERT INTO schema_changes (table_name,column_name,column_type,status) VALUES (?,?,?,'applied')").bind(table,column,type).run();
          return json({ applied:true, table, column, type },200,origin);
        } catch (e) {
          await env.DB.prepare("INSERT INTO schema_changes (table_name,column_name,column_type,status) VALUES (?,?,?,'failed')").bind(table,column,type).run();
          throw e;
        }
      }



      // Database Studio: schema inspection and safe, allowlisted DDL operations.
      const schemaAdmin = () => Boolean(env.ADMIN_CONFIG_TOKEN) && request.headers.get("Authorization") === "Bearer " + env.ADMIN_CONFIG_TOKEN;
      const quoteIdentifier = value => '"' + String(value).replace(/"/g, '""') + '"';
      const listUserTables = async () => {
        const result = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
        return result.results.map(row => row.name).filter(name => !["app_configuration","configuration_versions","schema_changes","custom_field_values"].includes(name));
      };
      if (path === "/api/admin/schema" && request.method === "GET") {
        if (!schemaAdmin()) return error("Admin configuration access is not authorized.",401,origin);
        const tables = await listUserTables();
        const schema = [];
        for (const table of tables) {
          const quoted = quoteIdentifier(table);
          const [columnsResult,indexResult] = await Promise.all([
            env.DB.prepare("PRAGMA table_info(" + quoted + ")").all(),
            env.DB.prepare("PRAGMA index_list(" + quoted + ")").all()
          ]);
          const indexes = [];
          for (const index of indexResult.results) {
            const details = await env.DB.prepare("PRAGMA index_info(" + quoteIdentifier(index.name) + ")").all();
            indexes.push({ name:index.name, unique:Boolean(index.unique), origin:index.origin, columns:details.results.map(c=>c.name) });
          }
          schema.push({ name:table, columns:columnsResult.results.map(c=>({name:c.name,type:c.type,notNull:Boolean(c.notnull),primaryKey:Boolean(c.pk),defaultValue:c.dflt_value})), indexes });
        }
        const history = await env.DB.prepare("SELECT id,table_name,column_name,column_type,status,created_at FROM schema_changes ORDER BY id DESC LIMIT 50").all();
        return json({tables:schema,history:history.results},200,origin);
      }
      if (path === "/api/admin/schema/columns" && request.method === "POST") {
        if (!schemaAdmin()) return error("Admin configuration access is not authorized.",401,origin);
        const body = await readJson(request);
        const table = String(body?.table || "");
        const column = String(body?.column || "");
        const type = String(body?.type || "").toUpperCase();
        const allowedTypes = new Set(["TEXT","INTEGER","REAL","NUMERIC","BLOB"]);
        const tables = await listUserTables();
        if (!tables.includes(table) || !/^[a-z][a-z0-9_]{0,39}$/.test(column) || !allowedTypes.has(type)) return error("Choose a valid application table, column name and SQLite type.",400,origin);
        const quoted = quoteIdentifier(table);
        const existing = await env.DB.prepare("PRAGMA table_info(" + quoted + ")").all();
        if (existing.results.some(c=>c.name===column)) return error("That column already exists.",409,origin);
        try {
          await env.DB.prepare("ALTER TABLE " + quoted + " ADD COLUMN " + quoteIdentifier(column) + " " + type).run();
          await env.DB.prepare("INSERT INTO schema_changes (table_name,column_name,column_type,status) VALUES (?,?,?,'applied')").bind(table,column,type).run();
          return json({applied:true,table,column,type},200,origin);
        } catch (e) {
          await env.DB.prepare("INSERT INTO schema_changes (table_name,column_name,column_type,status) VALUES (?,?,?,'failed')").bind(table,column,type).run();
          return error("Column could not be added. SQLite requires new columns to be nullable and use a supported type: " + String(e.message||"").slice(0,180),400,origin);
        }
      }
      if (path === "/api/admin/schema/indexes" && request.method === "POST") {
        if (!schemaAdmin()) return error("Admin configuration access is not authorized.",401,origin);
        const body = await readJson(request);
        const action = String(body?.action || "create");
        const table = String(body?.table || "");
        const indexName = String(body?.name || "");
        const tables = await listUserTables();
        if (!tables.includes(table)) return error("Choose a valid application table.",400,origin);
        if (action === "drop") {
          if (!/^idx_[a-z][a-z0-9_]{0,100}$/.test(indexName)) return error("Only custom indexes created through Database Studio can be removed.",400,origin);
          const found = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=? AND tbl_name=?").bind(indexName,table).first();
          if (!found) return error("Index not found on the selected table.",404,origin);
          await env.DB.prepare("DROP INDEX " + quoteIdentifier(indexName)).run();
          await env.DB.prepare("INSERT INTO schema_changes (table_name,column_name,column_type,status) VALUES (?,?,?,'applied')").bind(table,indexName,"INDEX DROPPED").run();
          return json({applied:true,action,name:indexName,table},200,origin);
        }
        const columns = Array.isArray(body?.columns) ? body.columns.map(String) : [];
        if (!columns.length || columns.length>4 || columns.some(c=>!/^[a-z][a-z0-9_]{0,39}$/.test(c))) return error("Select between one and four valid columns.",400,origin);
        const tableInfo = await env.DB.prepare("PRAGMA table_info(" + quoteIdentifier(table) + ")").all();
        if (columns.some(c=>!tableInfo.results.some(col=>col.name===c))) return error("One or more selected columns do not exist.",400,origin);
        const generated = "idx_" + table + "_" + columns.join("_");
        if (!/^idx_[a-z][a-z0-9_]{0,100}$/.test(generated)) return error("The generated index name is too long or invalid.",400,origin);
        const duplicate = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").bind(generated).first();
        if (duplicate) return error("That index already exists.",409,origin);
        await env.DB.prepare("CREATE " + (body?.unique===true?"UNIQUE ":"") + "INDEX " + quoteIdentifier(generated) + " ON " + quoteIdentifier(table) + " (" + columns.map(quoteIdentifier).join(",") + ")").run();
        await env.DB.prepare("INSERT INTO schema_changes (table_name,column_name,column_type,status) VALUES (?,?,?,'applied')").bind(table,generated,"INDEX CREATED").run();
        return json({applied:true,action:"create",name:generated,table,columns,unique:body?.unique===true},200,origin);
      }

      if (path === "/api/custom-field-values" && request.method === "GET") {
        const table = url.searchParams.get("table") || "";
        const recordId = url.searchParams.get("recordId") || "";
        const allowedTables = new Set(["mobile_devices","customers","sales","customer_entries"]);
        if (!allowedTables.has(table) || !validId(recordId)) return error("A valid entity table and record ID are required.",400,origin);
        const row = await env.DB.prepare("SELECT id FROM " + table + " WHERE id=?").bind(Number(recordId)).first();
        if (!row) return error("Record not found.",404,origin);
        const configRow = await env.DB.prepare("SELECT published_json FROM app_configuration WHERE id=1").first();
        const config = configRow ? JSON.parse(configRow.published_json) : {fields:[]};
        const fields = (config.fields||[]).filter(f=>f.enabled!==false&&f.table===table);
        const physical = fields.filter(f=>f.storage==="physical"&&/^[a-z][a-z0-9_]{0,39}$/.test(f.key));
        const metadata = await env.DB.prepare("SELECT field_key,value_text FROM custom_field_values WHERE entity_table=? AND record_id=?").bind(table,Number(recordId)).all();
        let physicalValues = {};
        if (physical.length) {
          const columns = physical.map(f=>f.key).join(",");
          const valuesRow = await env.DB.prepare("SELECT " + columns + " FROM " + table + " WHERE id=?").bind(Number(recordId)).first();
          if (valuesRow) physicalValues = Object.fromEntries(physical.map(f=>[f.key,valuesRow[f.key]==null?"":String(valuesRow[f.key])]));
        }
        return json({values:{...physicalValues,...Object.fromEntries(metadata.results.map(v=>[v.field_key,v.value_text]))}},200,origin);
      }
      if (path === "/api/custom-field-values" && request.method === "POST") {
        const body = await readJson(request);
        const table = String(body?.table || "");
        const recordId = body?.recordId;
        const values = body?.values;
        const allowedTables = new Set(["mobile_devices","customers","sales","customer_entries"]);
        if (!allowedTables.has(table) || !validId(recordId) || !values || typeof values !== "object" || Array.isArray(values)) return error("Custom field values are invalid.",400,origin);
        const record = await env.DB.prepare("SELECT id FROM " + table + " WHERE id=?").bind(Number(recordId)).first();
        if (!record) return error("Record not found.",404,origin);
        const configRow = await env.DB.prepare("SELECT published_json FROM app_configuration WHERE id=1").first();
        const config = configRow ? JSON.parse(configRow.published_json) : {fields:[]};
        const allowedFields = new Map((config.fields||[]).filter(f=>f.enabled!==false&&f.table===table).map(f=>[f.key,f]));
        const entries = Object.entries(values);
        if (entries.length > 50) return error("Too many custom field values.",413,origin);
        const statements = [];
        for (const [key, raw] of entries) {
          const field = allowedFields.get(key);
          if (!field || !/^[a-z][a-z0-9_]{0,39}$/.test(key)) return error("Field is not configured for this record type: " + key,400,origin);
          const value = raw == null ? "" : String(raw);
          if (value.length > 2000) return error("Custom field value is too long: " + key,400,origin);
          if (field.type==="number" && value!=="" && !Number.isFinite(Number(value))) return error("Invalid number for " + field.label,400,origin);
          if (field.type==="boolean" && value!=="" && !["true","false","1","0"].includes(value)) return error("Invalid yes/no value for " + field.label,400,origin);
          if (field.storage==="physical") {
            const columns = await env.DB.prepare("PRAGMA table_info(" + table + ")").all();
            if (!columns.results.some(column=>column.name===key)) return error("Physical column is missing. Recreate the field after applying its schema change.",409,origin);
            statements.push(env.DB.prepare("UPDATE " + table + " SET " + key + "=? WHERE id=?").bind(value===""?null:(field.type==="number"?Number(value):field.type==="boolean"?(value==="true"||value==="1"?1:0):value),Number(recordId)));
          } else if (field.storage==="metadata") {
            statements.push(env.DB.prepare("INSERT INTO custom_field_values (entity_table,record_id,field_key,value_text) VALUES (?,?,?,?) ON CONFLICT(entity_table,record_id,field_key) DO UPDATE SET value_text=excluded.value_text").bind(table,Number(recordId),key,value));
          } else return error("Unsupported custom field storage type.",400,origin);
        }
        const saved = statements.length;
        if (saved) {
          // A custom field value is a write to the record: set updated_at and bump the data source version in the same batch.
          const dataSource = { mobile_devices:"devices", customers:"customers", sales:"sales", customer_entries:"ledger" }[table];
          statements.push(env.DB.prepare("UPDATE " + table + " SET updated_at=datetime('now') WHERE id=?").bind(Number(recordId)), versionBump(env.DB, dataSource));
          await env.DB.batch(statements);
        }
        return json({saved},200,origin);
      }

      if (path === "/api/health" && request.method === "GET") {
        await env.DB.prepare("SELECT 1").first();
        const policy = policyHealth(env);
        if (!policy.ok) return json({ ok:false, service:"imam-mobile-api", database:"connected", auth:policy.mode, error:policy.message },503,origin);
        return json({ ok:true, service:"imam-mobile-api", database:"connected", auth:policy.mode, resources:governor.snapshot() },200,origin);
      }

      if (path === "/api/devices" && request.method === "GET") {
        const status=url.searchParams.get("status");
        const result=status
          ? await env.DB.prepare("SELECT * FROM mobile_devices WHERE status=? ORDER BY id DESC").bind(status).all()
          : await env.DB.prepare("SELECT * FROM mobile_devices ORDER BY id DESC").all();
        return json(result.results.map(deviceRow),200,origin);
      }
      if (parts[0]==="api" && parts[1]==="devices" && parts.length===3 && validId(parts[2])) {
        const id=Number(parts[2]);
        if (request.method==="PATCH") {
          const b=await readJson(request);
          if (!b || !b.model || !b.company || !b.imei || !b.condition || !b.purchaseDate || !Number.isFinite(Number(b.purchasePrice)) || Number(b.purchasePrice)<0) return error("Required device fields are missing or invalid.",400,origin);
          const status=b.status||"Available";
          // Counter changes read the row as it is now, so they come before the UPDATE. Counters, version and record change together.
          const before=countersOnGroupChange(env.DB,"devices",id,status);
          const results=await env.DB.batch([...before,
            env.DB.prepare(`UPDATE mobile_devices SET model=?,company=?,color=?,condition=?,status=?,imei=?,purchase_price=?,sale_price=?,purchase_date=?,sale_date=?,updated_at=datetime('now'),updated_by=? WHERE id=?`).bind(String(b.model).trim(),String(b.company).trim(),b.color||null,b.condition,status,String(b.imei).trim(),Number(b.purchasePrice),Number(b.salePrice||0),b.purchaseDate,b.saleDate||null,actorId,id),
            versionBump(env.DB,"devices")]);
          if (!results[before.length].meta.changes) return error("Device not found.",404,origin);
          return json({id,message:"Device updated."},200,origin);
        }
        if (request.method==="DELETE") {
          const before=countersOnDelete(env.DB,"devices",id);
          const results=await env.DB.batch([...before,env.DB.prepare("DELETE FROM mobile_devices WHERE id=?").bind(id),versionBump(env.DB,"devices")]);
          return results[before.length].meta.changes ? json({message:"Device deleted."},200,origin) : error("Device not found.",404,origin);
        }
      }
      if (path==="/api/devices" && request.method==="POST") {
        const b=await readJson(request);
        if (!b || !b.model || !b.company || !b.imei || !b.condition || !b.purchaseDate || !Number.isFinite(Number(b.purchasePrice)) || Number(b.purchasePrice)<0) return error("Required device fields are missing or invalid.",400,origin);
        const status=b.status||"Available";
        const [r]=await env.DB.batch([
          env.DB.prepare("INSERT INTO mobile_devices (model,company,color,condition,status,imei,purchase_price,sale_price,purchase_date,sale_date,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(String(b.model).trim(),String(b.company).trim(),b.color||null,b.condition,status,String(b.imei).trim(),Number(b.purchasePrice),Number(b.salePrice||0),b.purchaseDate,b.saleDate||null,actorId,actorId),
          ...countersOnCreate(env.DB,"devices",status),versionBump(env.DB,"devices")]);
        return json({id:r.meta.last_row_id,message:"Device created."},201,origin);
      }

      if (path==="/api/customers" && request.method==="GET") {
        const r=await env.DB.prepare("SELECT * FROM customers ORDER BY id DESC").all();
        return json(r.results.map(customerRow),200,origin);
      }
      if (parts[0]==="api" && parts[1]==="customers" && parts.length===3 && validId(parts[2])) {
        const id=Number(parts[2]);
        if (request.method==="PATCH") {
          const b=await readJson(request);
          if (!b || !String(b.name||"").trim()) return error("Customer name is required.",400,origin);
          const [r]=await env.DB.batch([env.DB.prepare("UPDATE customers SET name=?,mobile_number=?,type=?,updated_at=datetime('now'),updated_by=? WHERE id=?").bind(String(b.name).trim(),b.mobileNumber?String(b.mobileNumber).trim():null,b.type||"Regular",actorId,id),versionBump(env.DB,"customers")]);
          return r.meta.changes ? json({id,message:"Customer updated."},200,origin) : error("Customer not found.",404,origin);
        }
        if (request.method==="DELETE") {
          const before=countersOnDelete(env.DB,"customers",id);
          const results=await env.DB.batch([...before,env.DB.prepare("DELETE FROM customers WHERE id=?").bind(id),versionBump(env.DB,"customers")]);
          const r=results[before.length];
          return r.meta.changes ? json({message:"Customer deleted."},200,origin) : error("Customer not found.",404,origin);
        }
      }
      if (path==="/api/customers" && request.method==="POST") {
        const b=await readJson(request);
        if (!b || !String(b.name||"").trim()) return error("Customer name is required.",400,origin);
        const [r]=await env.DB.batch([env.DB.prepare("INSERT INTO customers (name,mobile_number,type,created_by,updated_by) VALUES (?,?,?,?,?)").bind(String(b.name).trim(),b.mobileNumber?String(b.mobileNumber).trim():null,b.type||"Regular",actorId,actorId),...countersOnCreate(env.DB,"customers"),versionBump(env.DB,"customers")]);
        return json({id:r.meta.last_row_id,message:"Customer created."},201,origin);
      }

      if (path==="/api/customer-entries" && request.method==="GET") {
        const r=await env.DB.prepare("SELECT * FROM customer_entries ORDER BY id DESC").all();
        return json(r.results.map(entryRow),200,origin);
      }
      if (parts[0]==="api" && parts[1]==="customer-entries" && parts.length===3 && validId(parts[2])) {
        const id=Number(parts[2]);
        if (request.method==="PATCH") {
          const b=await readJson(request);
          if (!b || !validId(b.customerId) || !b.date || !["In (+)","Out (-)"].includes(b.direction) || !Number.isFinite(Number(b.amount)) || Number(b.amount)<=0) return error("Required entry fields are missing or invalid.",400,origin);
          const [r]=await env.DB.batch([env.DB.prepare("UPDATE customer_entries SET customer_id=?,device_id=?,entry_date=?,due_date=?,direction=?,amount=?,note=?,updated_at=datetime('now'),updated_by=? WHERE id=?").bind(Number(b.customerId),b.deviceId?Number(b.deviceId):null,b.date,b.dueDate||null,b.direction,Number(b.amount),b.note||null,actorId,id),versionBump(env.DB,"ledger")]);
          return r.meta.changes ? json({id,message:"Entry updated."},200,origin) : error("Entry not found.",404,origin);
        }
        if (request.method==="DELETE") {
          const before=countersOnDelete(env.DB,"ledger",id);
          const results=await env.DB.batch([...before,env.DB.prepare("DELETE FROM customer_entries WHERE id=?").bind(id),versionBump(env.DB,"ledger")]);
          const r=results[before.length];
          return r.meta.changes ? json({message:"Entry deleted."},200,origin) : error("Entry not found.",404,origin);
        }
      }
      if (path==="/api/customer-entries" && request.method==="POST") {
        const b=await readJson(request);
        if (!b || !validId(b.customerId) || !b.date || !["In (+)","Out (-)"].includes(b.direction) || !Number.isFinite(Number(b.amount)) || Number(b.amount)<=0) return error("Required entry fields are missing or invalid.",400,origin);
        const [r]=await env.DB.batch([env.DB.prepare("INSERT INTO customer_entries (customer_id,device_id,entry_date,due_date,direction,amount,note,created_by,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))").bind(Number(b.customerId),b.deviceId?Number(b.deviceId):null,b.date,b.dueDate||null,b.direction,Number(b.amount),b.note||null,actorId,actorId),...countersOnCreate(env.DB,"ledger"),versionBump(env.DB,"ledger")]);
        return json({id:r.meta.last_row_id,message:"Entry created."},201,origin);
      }

      if (path==="/api/sales" && request.method==="GET") {
        const r=await env.DB.prepare(`SELECT s.*,c.name AS customer_name,
          (SELECT json_group_array(json_object('id',d.id,'model',d.model,'company',d.company,'imei',d.imei,'salePrice',si.sale_price,'purchasePrice',d.purchase_price,'condition',d.condition,'status',d.status,'color',d.color,'purchaseDate',d.purchase_date,'saleDate',d.sale_date)) FROM sale_items si JOIN mobile_devices d ON d.id=si.device_id WHERE si.sale_id=s.id) AS items_json
          FROM sales s LEFT JOIN customers c ON c.id=s.customer_id ORDER BY s.id DESC`).all();
        return json(r.results.map(s=>({id:s.id,date:s.sale_date,total:s.total_amount,customerId:s.customer_id,customerName:s.customer_name||"",deviceIds:JSON.parse(s.items_json||"[]").map(d=>d.id),devices:JSON.parse(s.items_json||"[]"),invoiceNumber:s.invoice_number})),200,origin);
      }
      if (path==="/api/sales" && request.method==="POST") {
        const b=await readJson(request);
        const ids=Array.isArray(b?.deviceIds)?[...new Set(b.deviceIds.map(Number))]:[];
        if (!ids.length || ids.some(id=>!validId(id)) || !b.prices || !ids.every(id=>Number.isFinite(Number(b.prices[id])) && Number(b.prices[id])>0)) return error("Select at least one device and provide valid sale prices.",400,origin);
        if (b.credit && !validId(b.customerId)) return error("A valid customer is required for a credit sale.",400,origin);
        const placeholders=ids.map(()=>"?").join(",");
        const found=await env.DB.prepare(`SELECT id,status FROM mobile_devices WHERE id IN (${placeholders})`).bind(...ids).all();
        if (found.results.length!==ids.length || found.results.some(d=>d.status==="Sold Out")) return error("One or more selected devices are no longer in stock. Refresh and try again.",409,origin);
        if (b.credit) {
          const c=await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(Number(b.customerId)).first();
          if (!c) return error("Customer not found.",404,origin);
        }
        const total=ids.reduce((sum,id)=>sum+Number(b.prices[id]),0);
        const invoice="S-"+crypto.randomUUID();
        const saleDate=b.date||new Date().toISOString().slice(0,10);
        const saleIdOf="(SELECT id FROM sales WHERE invoice_number=?)";
        // One batch: the sale, its items, the device status changes, the credit entry, the counters and the versions.
        // Counter statements that read a device come before the UPDATE of that device.
        const statements=[env.DB.prepare("INSERT INTO sales (invoice_number,customer_id,sale_date,total_amount,payment_type,created_by,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,datetime('now'))").bind(invoice,b.credit?Number(b.customerId):null,saleDate,total,b.credit?"Credit":"Cash",actorId,actorId),...countersOnCreate(env.DB,"sales")];
        for (const id of ids) {
          statements.push(env.DB.prepare("INSERT INTO sale_items (sale_id,device_id,sale_price) VALUES ("+saleIdOf+",?,?)").bind(invoice,id,Number(b.prices[id])));
          statements.push(...countersOnGroupChange(env.DB,"devices",id,"Sold Out"));
          statements.push(env.DB.prepare("UPDATE mobile_devices SET status='Sold Out',sale_price=?,sale_date=?,updated_at=datetime('now'),updated_by=? WHERE id=? AND status!='Sold Out'").bind(Number(b.prices[id]),saleDate,actorId,id));
        }
        if (b.credit) {
          statements.push(env.DB.prepare("INSERT INTO customer_entries (customer_id,sale_id,device_id,entry_date,due_date,direction,amount,note,created_by,updated_by,updated_at) VALUES (?,"+saleIdOf+",NULL,?,?, 'Out (-)',?,?,?,?,datetime('now'))").bind(Number(b.customerId),invoice,saleDate,b.dueDate||null,total,"Credit sale · Invoice "+invoice,actorId,actorId));
          statements.push(...countersOnCreate(env.DB,"ledger"),versionBump(env.DB,"ledger"));
        }
        statements.push(versionBump(env.DB,"sales"),versionBump(env.DB,"devices"));
        const results=await env.DB.batch(statements);
        const saleId=results[0].meta.last_row_id;
        return json({id:saleId,invoiceNumber:invoice,date:b.date||new Date().toISOString().slice(0,10),total,customerId:b.credit?Number(b.customerId):null,message:"Sale completed."},201,origin);
      }

      const platform = await handlePlatformRoute(request, env, path, actor);
      if (platform) return new Response(platform.body === undefined ? null : JSON.stringify(platform.body), { status: platform.status, headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(platform.headers || {}) } });
      return error("Route not found.",404,origin);
    } catch (err) {
      if (isLimitError(err)) throw err; // mapped to DAILY_LIMIT_REACHED by the wrapper below
      if (err?.message?.includes("UNIQUE constraint failed: mobile_devices.imei")) return error("This IMEI already exists.",409,origin);
      if (err?.message?.includes("FOREIGN KEY constraint failed")) return error("This record is linked to existing sales or ledger entries and cannot be deleted.",409,origin);
      return error("An unexpected server error occurred.",500,origin);
    }
}

// Wrapper around every request: rows read and written are counted, the resource governor and the per-client
// rate limit run first, and a D1 daily limit becomes one calm DAILY_LIMIT_REACHED response (Contracts section 10.7).
async function guarded(request, env, rawDb, origin) {
  const path = new URL(request.url).pathname.replace(/\/$/,"") || "/";
  if (path !== "/api/health") {
    const wait = rateLimiter.check(request.headers.get("CF-Connecting-IP") || "unknown");
    if (wait > 0) return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment and try again.", code: "RATE_LIMITED" }), { status: 429, headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Retry-After": String(wait) } });
  }
  await governor.sync(rawDb);
  const state = governor.state();
  if (state === "limit" && path !== "/api/health" && !governor.shouldProbe()) return limitResponse(origin);
  if ((state === "essential" || state === "limit") && request.method !== "GET") {
    const route = matchRoute(request.method, path);
    if (route && route.permission !== "public" && !CORE_PERMISSIONS.has(route.permission)) {
      return new Response(JSON.stringify({ error: "This action is paused for a short time to protect the system. Please try again later.", code: "RESOURCE_CONSERVING" }), { status: 503, headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "300" } });
    }
  }
  return handleRequest(request, env);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS" || !env.DB) return handleRequest(request, env);
    const origin = request.headers.get("Origin") || FRONTEND_ORIGIN;
    if (request.headers.has("Origin") && !ALLOWED_ORIGINS.includes(origin)) return error("Origin not allowed.",403,origin);
    const usage = newUsage();
    let response;
    let limited = false;
    try {
      response = await guarded(request, { ...env, DB: meterDb(env.DB, usage) }, env.DB, origin);
    } catch (err) {
      if (!isLimitError(err)) throw err;
      governor.markLimit();
      limited = true;
      response = limitResponse(origin);
    }
    governor.record(usage);
    if (!limited && usage.queries > 0 && response.status < 500) governor.clearLimit();
    if (env.ENVIRONMENT === "development") {
      response = new Response(response.body, response);
      response.headers.set("X-Rows-Read", String(usage.rowsRead));
      response.headers.set("X-Rows-Written", String(usage.rowsWritten));
    }
    return response;
  }
};
