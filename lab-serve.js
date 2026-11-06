// Serves app.html (a QA Interview Ready practice app) at / for the Lab run workflow.
// Paths other than / redirect to the matching hash route, like the in-browser runtime does.
const http = require("http");
const fs = require("fs");
const html = fs.readFileSync(process.argv[2] || "app.html");
const port = Number(process.env.PORT || 8080);
http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/" || url.pathname === "/index.html") return res.end(html);
    if (url.pathname === "/favicon.ico") { res.statusCode = 204; return res.end(); }
    res.end(`<!doctype html><script>location.replace("/" + location.search + "#" + location.pathname)</script>`);
  })
  .listen(port, () => console.log("practice app on http://localhost:" + port));
