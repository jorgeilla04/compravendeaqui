// Servidor SMTP falso para los e2e. El backend usa su envío REAL por SMTP
// apuntando acá (SMTP_HOST/SMTP_PORT); este proceso guarda el último mail de
// cada destinatario y expone el código y el link en GET /__mail?to=<email>.
// Solo para tests: nunca se usa en desarrollo ni en producción.
import http from "node:http";
import net from "node:net";

const smtpPort = Number(process.env.SMTP_FAKE_PORT ?? 2525);
const httpPort = Number(process.env.SMTP_FAKE_HTTP_PORT ?? 9997);
const lastMail = new Map();

function decodeQuotedPrintable(text) {
  const bytes = [];
  const soft = text.replace(/=\r?\n/g, "");
  for (let i = 0; i < soft.length; i++) {
    if (soft[i] === "=" && /^[0-9A-F]{2}$/i.test(soft.slice(i + 1, i + 3))) {
      bytes.push(parseInt(soft.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(...Buffer.from(soft[i], "utf8"));
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

/** Texto plano del mail (decodifica base64 / quoted-printable). */
function plainText(raw) {
  const boundary = raw.match(/boundary="?([^"\r\n;]+)"?/)?.[1];
  const parts = boundary ? raw.split(`--${boundary}`) : [raw];
  const part =
    parts.find((p) => /Content-Type:\s*text\/plain/i.test(p)) ?? parts[0];
  const split = part.search(/\r?\n\r?\n/);
  const headers = part.slice(0, split);
  const body = part.slice(split).trim();
  const encoding = headers.match(/Content-Transfer-Encoding:\s*(\S+)/i)?.[1];
  if (/base64/i.test(encoding ?? "")) {
    return Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8");
  }
  if (/quoted-printable/i.test(encoding ?? "")) return decodeQuotedPrintable(body);
  return body;
}

net
  .createServer((socket) => {
    let buffer = "";
    let inData = false;
    let recipients = [];
    const reply = (line) => socket.write(`${line}\r\n`);
    reply("220 fake-smtp listo");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      while (true) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end === -1) return;
          // Quita el "dot-stuffing" de SMTP.
          const raw = buffer.slice(0, end).replace(/^\.\./gm, ".");
          buffer = buffer.slice(end + 5);
          inData = false;
          const text = plainText(raw);
          const code = text.match(/\b(\d{6})\b/)?.[1] ?? null;
          const link = text.match(/https?:\/\/\S+\/ingresar\/enlace\?\S+/)?.[0] ?? null;
          for (const to of recipients) lastMail.set(to, { code, link, text });
          recipients = [];
          reply("250 OK: guardado");
          continue;
        }
        const eol = buffer.indexOf("\r\n");
        if (eol === -1) return;
        const line = buffer.slice(0, eol);
        buffer = buffer.slice(eol + 2);
        const command = line.slice(0, 4).toUpperCase();
        if (command === "EHLO" || command === "HELO") {
          reply("250-fake-smtp");
          reply("250 8BITMIME");
        } else if (command === "MAIL") {
          recipients = [];
          reply("250 OK");
        } else if (command === "RCPT") {
          const to = line.match(/<([^>]+)>/)?.[1]?.toLowerCase();
          if (to) recipients.push(to);
          reply("250 OK");
        } else if (command === "DATA") {
          inData = true;
          reply("354 Terminá con <CRLF>.<CRLF>");
        } else if (command === "QUIT") {
          reply("221 Chau");
          socket.end();
          return;
        } else {
          reply("250 OK");
        }
      }
    });
    socket.on("error", () => {});
  })
  .listen(smtpPort, () => console.log(`fake SMTP en :${smtpPort}`));

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${httpPort}`);
    if (req.method === "GET" && url.pathname === "/__mail") {
      const mail = lastMail.get((url.searchParams.get("to") ?? "").toLowerCase());
      res.writeHead(mail ? 200 : 404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(mail ?? { error: "sin mail" }));
    }
    res.writeHead(404);
    res.end();
  })
  .listen(httpPort, () => console.log(`fake SMTP (lectura) en :${httpPort}`));
