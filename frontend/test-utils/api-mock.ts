export type Handler = (body: unknown) => {
  status: number;
  json?: unknown;
  headers?: Record<string, string>;
};

/** Doble de fetch: responde según "MÉTODO /ruta" y registra las llamadas. */
export function mockApi(routes: Record<string, Handler>) {
  const calls: { key: string; body: unknown }[] = [];
  global.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const key = `${init?.method ?? "GET"} ${url.pathname.replace(/^\/api\/v1/, "")}`;
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
      calls.push({ key, body });
      const handler = routes[key];
      const res = handler
        ? handler(body)
        : { status: 404, json: { detail: "No encontrado" } };
      // jsdom no expone Response: objeto con la forma que usa lib/api.
      const headers = new Map(
        Object.entries(res.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
      );
      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        headers: { get: (n: string) => headers.get(n.toLowerCase()) ?? null },
        json: async () => {
          if (res.json === undefined) throw new SyntaxError("Sin cuerpo");
          return res.json;
        },
      } as unknown as Response;
    },
  ) as jest.Mock;
  return calls;
}
