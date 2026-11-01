const FRONTEND_ORIGIN = "https://imam-mobile.pages.dev";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === FRONTEND_ORIGIN ? origin : FRONTEND_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function json(data, status = 200, origin = FRONTEND_ORIGIN) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function error(message, status = 400, origin) { return json({ error: message }, status, origin); }
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
