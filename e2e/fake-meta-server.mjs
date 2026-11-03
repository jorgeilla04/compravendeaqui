// Servidor falso de la WhatsApp Cloud API (Graph API de Meta) para los e2e.
// El backend usa su integración REAL apuntando acá (WHATSAPP_API_BASE_URL);
// este proceso guarda el código enviado y lo expone en GET /__otp?to=<dígitos>.
// Solo para tests: nunca se usa en desarrollo ni en producción.
import http from "node:http";

const port = Number(process.env.PORT ?? 9998);
const lastCode = new Map();

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    if (req.method === "GET" && url.pathname === "/__otp") {
      const code = lastCode.get(url.searchParams.get("to") ?? "");
      res.writeHead(code ? 200 : 404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(code ? { code } : { error: "sin código" }));
    }
    if (req.method === "GET" && url.pathname === "/__health") {
      res.writeHead(200);
      return res.end("ok");
    }
    if (req.method === "POST" && /^\/v[\d.]+\/[^/]+\/messages$/.test(url.pathname)) {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        const body = JSON.parse(raw || "{}");
        const auth = req.headers.authorization ?? "";
        const code = body?.template?.components?.[0]?.parameters?.[0]?.text;
        if (!auth.startsWith("Bearer ") || body.type !== "template" || !code) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: { code: 100, message: "Invalid parameter" } }));
        }
        lastCode.set(body.to, code);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ messaging_product: "whatsapp", messages: [{ id: `wamid.e2e${Date.now()}` }] }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  })
  .listen(port, () => console.log(`fake Meta Graph API en :${port}`));
