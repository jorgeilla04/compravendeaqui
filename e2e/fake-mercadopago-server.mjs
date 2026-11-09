// Servidor falso de la API de Mercado Pago (Checkout Pro) para los e2e.
// El backend usa su integración REAL apuntando acá (MP_API_BASE_URL): crea la
// preferencia, el "checkout" muestra un botón Pagar que aprueba el pago y
// vuelve a back_urls.success, y GET /v1/payments/:id devuelve ese pago.
// Solo para tests: nunca se usa en desarrollo ni en producción.
import http from "node:http";

const port = Number(process.env.MP_FAKE_PORT ?? 9996);
const base = `http://localhost:${port}`;
const preferences = new Map();
const payments = new Map();
let nextPayment = 5000001;

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", base);
    if (req.method === "POST" && url.pathname === "/checkout/preferences") {
      if (!(req.headers.authorization ?? "").startsWith("Bearer ")) {
        return json(res, 401, { message: "invalid token" });
      }
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const pref = JSON.parse(raw || "{}");
        const id = `pref-${preferences.size + 1}`;
        preferences.set(id, pref);
        json(res, 201, { id, init_point: `${base}/checkout/${id}` });
      });
      return;
    }
    const checkout = url.pathname.match(/^\/checkout\/([\w-]+)$/);
    if (req.method === "GET" && checkout && preferences.has(checkout[1])) {
      const pref = preferences.get(checkout[1]);
      const item = pref.items[0];
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html><html lang="es"><title>Mercado Pago (prueba)</title>
<main><h1>Mercado Pago de prueba</h1><p>${item.title}</p><p>Monto: ${item.unit_price}</p>
<form method="post" action="/checkout/${checkout[1]}/pay"><button name="r" value="approved">Pagar</button>
<button name="r" value="rejected">Rechazar</button></form></main></html>`);
    }
    const pay = url.pathname.match(/^\/checkout\/([\w-]+)\/pay$/);
    if (req.method === "POST" && pay && preferences.has(pay[1])) {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const pref = preferences.get(pay[1]);
        const status = new URLSearchParams(raw).get("r") ?? "approved";
        const id = nextPayment++;
        payments.set(String(id), {
          id,
          status,
          currency_id: "ARS",
          transaction_amount: pref.items[0].unit_price,
          external_reference: pref.external_reference,
        });
        const back = new URL(pref.back_urls[status === "approved" ? "success" : "failure"]);
        back.searchParams.set("payment_id", String(id));
        back.searchParams.set("status", status);
        res.writeHead(302, { Location: back.toString() });
        res.end();
      });
      return;
    }
    const payment = url.pathname.match(/^\/v1\/payments\/(\d+)$/);
    if (req.method === "GET" && payment) {
      const found = payments.get(payment[1]);
      return found ? json(res, 200, found) : json(res, 404, { message: "not found" });
    }
    res.writeHead(404);
    res.end();
  })
  .listen(port, () => console.log(`fake Mercado Pago en :${port}`));
