/** Respuesta HTTP mínima para tests (jsdom no expone `Response`). */
export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        headers[name] ?? headers[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  } as unknown as Response;
}
