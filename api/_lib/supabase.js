function isConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getBaseUrl() {
  return String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
}

function getServiceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
}

async function request(path, options) {
  const baseUrl = getBaseUrl();
  const key = getServiceRoleKey();
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

async function list(table, filters) {
  const query = filters ? `${table}?${filters}` : table;
  return request(query, { method: "GET", prefer: "return=representation" });
}

async function storageRequest(path, options) {
  const baseUrl = getBaseUrl();
  const key = getServiceRoleKey();
  const response = await fetch(`${baseUrl}/storage/v1/${path}`, {
    method: options.method || "GET",
    headers: Object.assign(
      {
        apikey: key,
        Authorization: `Bearer ${key}`
      },
      options.contentType ? { "Content-Type": options.contentType } : {},
      options.headers || {}
    ),
    body: options.body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Supabase storage request failed");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

async function uploadStorageObject(bucket, objectPath, buffer, contentType) {
  return storageRequest(`object/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    body: buffer,
    contentType: contentType || "application/octet-stream",
    headers: {
      "x-upsert": "true",
      "cache-control": "3600"
    }
  });
}

function getPublicStorageUrl(bucket, objectPath) {
  return `${getBaseUrl()}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
}

module.exports = {
  findOne,
  getPublicStorageUrl,
  insert,
  isConfigured,
  list,
  uploadStorageObject,
  update,
  upsert
};
