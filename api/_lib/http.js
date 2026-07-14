function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const raw = await readRawBody(req);
  if (!raw) return {};
  return JSON.parse(raw.toString("utf8"));
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function getSiteUrl(req) {
  const fromEnv = (process.env.SITE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers.host}`;
}

function getRequestOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers.host}`;
}

module.exports = {
  getRequestOrigin,
  getSiteUrl,
  parseJsonBody,
  readRawBody,
  sendJson
};
