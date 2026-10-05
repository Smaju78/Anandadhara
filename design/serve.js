// Tiny static server for the design mockups. Serves the repository root so ../../docs/songs.json resolves.
// Usage: node design/serve.js [root] [port]   then open http://localhost:8010/design/mockups/
const http = require("http"), fs = require("fs"), path = require("path");
const root = process.argv[2] || path.join(__dirname, ".."), port = +process.argv[3] || 8010;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".md": "text/plain; charset=utf-8" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(path.resolve(root))) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}).listen(port, () => console.log("serving", root, "on http://localhost:" + port + "/design/mockups/"));
