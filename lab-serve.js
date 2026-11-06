// Serves app.html (a QA Interview Ready practice app) at / for the Lab run workflow.
// Paths other than / redirect to the matching hash route, like the in-browser runtime does.
// /api/* is proxied to the practice app's REST API on the site (LAB_API_ORIGIN), so request.get('/api/products')
// and the app's own calls work exactly as they do in the browser lab.
const http = require("http");
const https = require("https");
const fs = require("fs");
const html = fs.readFileSync(process.argv[2] || "app.html");
const port = Number(process.env.PORT || 8080);
const apiOrigin = (process.env.LAB_API_ORIGIN || "").replace(/\/$/, "");
const app = process.env.LAB_APP || "";

function proxy(req, res, url) {
  if (!apiOrigin) { res.statusCode = 502; res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ error: { code: "no_api", message: "LAB_API_ORIGIN is not set" } })); }
  let p = url.pathname;
  if (!p.startsWith("/api/sandbox/")) p = "/api/sandbox/" + app + p.slice(4);
  const target = new URL(p + url.search, apiOrigin);
  const headers = { ...req.headers, host: target.host };
  delete headers["accept-encoding"];
  const client = target.protocol === "https:" ? https : http;
  const up = client.request(target, { method: req.method, headers }, (r) => {
    const h = { ...r.headers };
    if (h["set-cookie"]) h["set-cookie"] = h["set-cookie"].map((c) => c.replace(/;\s*secure/gi, "").replace(/;\s*domain=[^;]*/gi, ""));
    delete h["content-encoding"]; delete h["transfer-encoding"]; delete h["content-length"];
    res.writeHead(r.statusCode || 502, h);
    r.pipe(res);
  });
  up.on("error", (e) => { res.statusCode = 502; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: { code: "upstream", message: e.message } })); });
  req.pipe(up);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return proxy(req, res, url);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/" || url.pathname === "/index.html") return res.end(html);
    if (url.pathname === "/favicon.ico") { res.statusCode = 204; return res.end(); }
    res.end(`<!doctype html><script>location.replace("/" + location.search + "#" + location.pathname)</script>`);
  })
  .listen(port, () => console.log("practice app on http://localhost:" + port + (apiOrigin ? ", API via " + apiOrigin : "")));
