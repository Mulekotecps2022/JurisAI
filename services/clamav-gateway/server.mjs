// Standalone internal scanner gateway. Run only in a private network beside clamd.
// Node.js 20+. No external dependencies. Do not expose this HTTP server publicly.
import http from "node:http";
import net from "node:net";
import { createHash, timingSafeEqual } from "node:crypto";

const token = process.env.JURISAI_SCANNER_TOKEN;
const host = process.env.CLAMD_HOST || "127.0.0.1";
const port = Number(process.env.CLAMD_PORT || 3310);
const listenHost = process.env.SCANNER_LISTEN_HOST || "127.0.0.1";
const listenPort = Number(process.env.SCANNER_LISTEN_PORT || 8788);
const maxBytes = 25 * 1024 * 1024;
if (!token || token.length < 32) throw new Error("Scanner token must have at least 32 characters");

function equalBearer(value) {
  const a = Buffer.from(value || "");
  const b = Buffer.from(`Bearer ${token}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}
function scanWithClamd(bytes) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(90000);
    const responses = [];
    let settled = false;
    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err); else resolve(result);
    };
    socket.on("connect", () => {
      socket.write(Buffer.from("zINSTREAM\0"));
      for (let i = 0; i < bytes.length; i += 65536) {
        const chunk = bytes.subarray(i, i + 65536);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(chunk.length);
        socket.write(len);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", chunk => responses.push(chunk));
    socket.on("end", () => {
      const response = Buffer.concat(responses).toString("utf8").replace(/\0/g, "").trim();
      if (/^stream: OK$/.test(response)) finish(null, "clean");
      else if (/^stream: .+ FOUND$/.test(response)) finish(null, "infected");
      else finish(new Error("Unexpected clamd response"));
    });
    socket.on("error", err => finish(err));
    socket.on("timeout", () => finish(new Error("clamd timeout")));
  });
}

http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/scan") return json(res, 404, { error: "not found" });
  if (!equalBearer(req.headers.authorization)) return json(res, 401, { error: "unauthorized" });
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBytes) return json(res, 413, { error: "too large" });
      chunks.push(chunk);
    }
    if (size === 0) return json(res, 400, { error: "empty" });
    const bytes = Buffer.concat(chunks);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (req.headers["x-content-sha256"] !== sha256) return json(res, 422, { error: "hash mismatch" });
    const verdict = await scanWithClamd(bytes);
    return json(res, 200, { verdict, sha256 });
  } catch {
    return json(res, 503, { error: "scanner unavailable" });
  }
}).listen(listenPort, listenHost);
