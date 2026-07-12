const { createApp } = require("../backend/src/app");

const app = createApp();

module.exports = function handler(req, res) {
  const apiPath = String(req.query?.path || "").replace(/^\/+/, "");
  const search = new URL(req.url, "http://localhost").searchParams;
  search.delete("path");
  const query = search.toString();
  req.url = `/api/${apiPath}${query ? `?${query}` : ""}`;
  return app(req, res);
};
