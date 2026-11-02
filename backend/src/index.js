const FRONTEND_ORIGIN = "https://imam-mobile.pages.dev";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === FRONTEND_ORIGIN ? origin : FRONTEND_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function json(data, status = 200, origin = FRONTEND_ORIGIN) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function error(message, status = 400, origin) { return json({ error: message }, status, origin); }
function cachedJson(data, status = 200, origin = FRONTEND_ORIGIN) { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60, s-maxage=300" } }); }
async function readJson(request) { try { return await request.json(); } catch { return null; } }
function deviceRow(r) {
  return { id:r.id, model:r.model, company:r.company, color:r.color, condition:r.condition, status:r.status, imei:r.imei, purchasePrice:r.purchase_price, salePrice:r.sale_price ?? 0, purchaseDate:r.purchase_date, saleDate:r.sale_date || "" };
}
function customerRow(r) { return { id:r.id, name:r.name, mobileNumber:r.mobile_number || "", type:r.type }; }
function entryRow(r) {
  return { id:r.id, customerId:r.customer_id, saleId:r.sale_id, deviceId:r.device_id, date:r.entry_date, dueDate:r.due_date || "", direction:r.direction, amount:r.amount, note:r.note || "" };
}
function validId(value) { return /^\d+$/.test(String(value)) && Number(value) > 0; }

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || FRONTEND_ORIGIN;
    if (request.method === "OPTIONS") return new Response(null, { status:204, headers:corsHeaders(origin) });
    if (request.headers.has("Origin") && origin !== FRONTEND_ORIGIN) return error("Origin not allowed.",403,origin);
    if (!env.DB) return error("Database binding DB is not configured.",500,origin);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/,"") || "/";
    const parts = path.split("/").filter(Boolean);
    try {
      // Published configuration is read-only and cached briefly at the edge/browser.
      if (path === "/api/configuration" && request.method === "GET") {
        const row = await env.DB.prepare("SELECT published_json, published_version, updated_at FROM app_configuration WHERE id=1").first();
        if (!row) return cachedJson({ configuration:null, version:0 },200,origin);
        return cachedJson({ configuration:JSON.parse(row.published_json), version:row.published_version, updatedAt:row.updated_at },200,origin);
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
        if (statements.length) await env.DB.batch(statements);
        return json({saved:statements.length},200,origin);
      }

      if (path === "/api/health" && request.method === "GET") {
        await env.DB.prepare("SELECT 1").first();
        return json({ ok:true, service:"imam-mobile-api", database:"connected" },200,origin);
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
          const r=await env.DB.prepare(`UPDATE mobile_devices SET model=?,company=?,color=?,condition=?,status=?,imei=?,purchase_price=?,sale_price=?,purchase_date=?,sale_date=?,updated_at=datetime('now') WHERE id=?`).bind(String(b.model).trim(),String(b.company).trim(),b.color||null,b.condition,b.status||"Available",String(b.imei).trim(),Number(b.purchasePrice),Number(b.salePrice||0),b.purchaseDate,b.saleDate||null,id).run();
          if (!r.meta.changes) return error("Device not found.",404,origin);
          return json({id,message:"Device updated."},200,origin);
        }
        if (request.method==="DELETE") {
          const r=await env.DB.prepare("DELETE FROM mobile_devices WHERE id=?").bind(id).run();
          return r.meta.changes ? json({message:"Device deleted."},200,origin) : error("Device not found.",404,origin);
        }
      }
      if (path==="/api/devices" && request.method==="POST") {
        const b=await readJson(request);
        if (!b || !b.model || !b.company || !b.imei || !b.condition || !b.purchaseDate || !Number.isFinite(Number(b.purchasePrice)) || Number(b.purchasePrice)<0) return error("Required device fields are missing or invalid.",400,origin);
        const r=await env.DB.prepare("INSERT INTO mobile_devices (model,company,color,condition,status,imei,purchase_price,sale_price,purchase_date,sale_date) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(String(b.model).trim(),String(b.company).trim(),b.color||null,b.condition,b.status||"Available",String(b.imei).trim(),Number(b.purchasePrice),Number(b.salePrice||0),b.purchaseDate,b.saleDate||null).run();
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
          const r=await env.DB.prepare("UPDATE customers SET name=?,mobile_number=?,type=?,updated_at=datetime('now') WHERE id=?").bind(String(b.name).trim(),b.mobileNumber?String(b.mobileNumber).trim():null,b.type||"Regular",id).run();
          return r.meta.changes ? json({id,message:"Customer updated."},200,origin) : error("Customer not found.",404,origin);
        }
        if (request.method==="DELETE") {
          const r=await env.DB.prepare("DELETE FROM customers WHERE id=?").bind(id).run();
          return r.meta.changes ? json({message:"Customer deleted."},200,origin) : error("Customer not found.",404,origin);
        }
      }
      if (path==="/api/customers" && request.method==="POST") {
        const b=await readJson(request);
        if (!b || !String(b.name||"").trim()) return error("Customer name is required.",400,origin);
        const r=await env.DB.prepare("INSERT INTO customers (name,mobile_number,type) VALUES (?,?,?)").bind(String(b.name).trim(),b.mobileNumber?String(b.mobileNumber).trim():null,b.type||"Regular").run();
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
          const r=await env.DB.prepare("UPDATE customer_entries SET customer_id=?,device_id=?,entry_date=?,due_date=?,direction=?,amount=?,note=? WHERE id=?").bind(Number(b.customerId),b.deviceId?Number(b.deviceId):null,b.date,b.dueDate||null,b.direction,Number(b.amount),b.note||null,id).run();
          return r.meta.changes ? json({id,message:"Entry updated."},200,origin) : error("Entry not found.",404,origin);
        }
        if (request.method==="DELETE") {
          const r=await env.DB.prepare("DELETE FROM customer_entries WHERE id=?").bind(id).run();
          return r.meta.changes ? json({message:"Entry deleted."},200,origin) : error("Entry not found.",404,origin);
        }
      }
      if (path==="/api/customer-entries" && request.method==="POST") {
        const b=await readJson(request);
        if (!b || !validId(b.customerId) || !b.date || !["In (+)","Out (-)"].includes(b.direction) || !Number.isFinite(Number(b.amount)) || Number(b.amount)<=0) return error("Required entry fields are missing or invalid.",400,origin);
        const r=await env.DB.prepare("INSERT INTO customer_entries (customer_id,device_id,entry_date,due_date,direction,amount,note) VALUES (?,?,?,?,?,?,?)").bind(Number(b.customerId),b.deviceId?Number(b.deviceId):null,b.date,b.dueDate||null,b.direction,Number(b.amount),b.note||null).run();
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
        const sale=await env.DB.prepare("INSERT INTO sales (invoice_number,customer_id,sale_date,total_amount,payment_type) VALUES (?,?,?,?,?)").bind(invoice,b.credit?Number(b.customerId):null,b.date||new Date().toISOString().slice(0,10),total,b.credit?"Credit":"Cash").run();
        const saleId=sale.meta.last_row_id;
        const statements=[];
        for (const id of ids) {
          statements.push(env.DB.prepare("INSERT INTO sale_items (sale_id,device_id,sale_price) VALUES (?,?,?)").bind(saleId,id,Number(b.prices[id])));
          statements.push(env.DB.prepare("UPDATE mobile_devices SET status='Sold Out',sale_price=?,sale_date=?,updated_at=datetime('now') WHERE id=? AND status!='Sold Out'").bind(Number(b.prices[id]),b.date||new Date().toISOString().slice(0,10),id));
        }
        if (b.credit) statements.push(env.DB.prepare("INSERT INTO customer_entries (customer_id,sale_id,device_id,entry_date,due_date,direction,amount,note) VALUES (?,?,NULL,?,?, 'Out (-)',?,?)").bind(Number(b.customerId),saleId,b.date||new Date().toISOString().slice(0,10),b.dueDate||null,total,"Credit sale · Invoice "+invoice));
        await env.DB.batch(statements);
        return json({id:saleId,invoiceNumber:invoice,date:b.date||new Date().toISOString().slice(0,10),total,customerId:b.credit?Number(b.customerId):null,message:"Sale completed."},201,origin);
      }

      return error("Route not found.",404,origin);
    } catch (err) {
      if (err?.message?.includes("UNIQUE constraint failed: mobile_devices.imei")) return error("This IMEI already exists.",409,origin);
      if (err?.message?.includes("FOREIGN KEY constraint failed")) return error("This record is linked to existing sales or ledger entries and cannot be deleted.",409,origin);
      return error("An unexpected server error occurred.",500,origin);
    }
  }
};
