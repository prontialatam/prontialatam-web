function isConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function request(path, options) {
  const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: options.prefer || "return=representation"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Supabase request failed");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

async function findOne(table, filters) {
  const data = await request(`${table}?${filters}&limit=1`, { method: "GET", prefer: "return=representation" });
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function insert(table, payload) {
  return request(table, { method: "POST", body: payload });
}

async function upsert(table, payload, onConflict) {
  return request(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    body: payload,
    prefer: "resolution=merge-duplicates,return=representation"
  });
}

async function update(table, filters, payload) {
  return request(`${table}?${filters}`, {
    method: "PATCH",
    body: payload
  });
}

module.exports = {
  findOne,
  insert,
  isConfigured,
  update,
  upsert
};
