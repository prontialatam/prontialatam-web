const { sendJson } = require("../../_lib/http");
const { clearAuthCookies } = require("../../_lib/affiliate-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  clearAuthCookies(res);
  return sendJson(res, 200, {
    ok: true
  });
};
