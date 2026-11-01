const FRONTEND_ORIGIN = "https://imam-mobile.pages.dev";

function corsHeaders(origin) {
  const allowedOrigin = origin === FRONTEND_ORIGIN ? origin : FRONTEND_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status = 200, origin = FRONTEND_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function error(message, status = 400, origin = FRONTEND_ORIGIN) {
  return json({ error: message }, status, origin);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || FRONTEND_ORIGIN;
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (origin !== FRONTEND_ORIGIN && request.headers.has("Origin")) {
      return error("Origin not allowed.", 403, origin);
    }

    if (!env.DB) {
      return error("Database binding DB is not configured.", 500, origin);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    try {
      if (path === "/api/health" && request.method === "GET") {
        await env.DB.prepare("SELECT 1").first();
        return json({
          ok: true,
          service: "imam-mobile-api",
          database: "connected"
        }, 200, origin);
      }

      if (path === "/api/devices" && request.method === "GET") {
        const status = url.searchParams.get("status");
        const result = status
          ? await env.DB.prepare(
              "SELECT * FROM mobile_devices WHERE status = ? ORDER BY id DESC"
            ).bind(status).all()
          : await env.DB.prepare(
              "SELECT * FROM mobile_devices ORDER BY id DESC"
            ).all();
        return json(result.results, 200, origin);
      }

      if (path === "/api/devices" && request.method === "POST") {
        const body = await readJson(request);
        if (!body || !body.model || !body.company || !body.imei ||
            !body.condition || !body.purchaseDate ||
            !Number.isInteger(Number(body.purchasePrice)) ||
            Number(body.purchasePrice) < 0) {
          return error("Required device fields are missing or invalid.", 400, origin);
        }

        const result = await env.DB.prepare(`
          INSERT INTO mobile_devices
            (model, company, color, condition, status, imei, purchase_price, purchase_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          String(body.model).trim(),
          String(body.company).trim(),
          body.color || null,
          body.condition,
          body.status || "Available",
          String(body.imei).trim(),
          Number(body.purchasePrice),
          body.purchaseDate
        ).run();

        return json({ id: result.meta.last_row_id, message: "Device created." }, 201, origin);
      }

      if (path === "/api/customers" && request.method === "GET") {
        const result = await env.DB.prepare(
          "SELECT * FROM customers ORDER BY id DESC"
        ).all();
        return json(result.results, 200, origin);
      }

      if (path === "/api/customers" && request.method === "POST") {
        const body = await readJson(request);
        if (!body || !body.name || !String(body.name).trim()) {
          return error("Customer name is required.", 400, origin);
        }

        const result = await env.DB.prepare(
          "INSERT INTO customers (name, mobile_number, type) VALUES (?, ?, ?)"
        ).bind(
          String(body.name).trim(),
          body.mobileNumber ? String(body.mobileNumber).trim() : null,
          body.type || "Regular"
        ).run();

        return json({ id: result.meta.last_row_id, message: "Customer created." }, 201, origin);
      }

      if (path === "/api/customer-entries" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT ce.*, c.name AS customer_name, d.model AS device_model
          FROM customer_entries ce
          JOIN customers c ON c.id = ce.customer_id
          LEFT JOIN mobile_devices d ON d.id = ce.device_id
          ORDER BY ce.id DESC
        `).all();
        return json(result.results, 200, origin);
      }

      return error("Route not found.", 404, origin);
    } catch (err) {
      if (err?.message?.includes("UNIQUE constraint failed: mobile_devices.imei")) {
        return error("This IMEI already exists.", 409, origin);
      }
      return error("An unexpected server error occurred.", 500, origin);
    }
  }
};
