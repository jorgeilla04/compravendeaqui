/**
 * Cliente de la API.
 *
 * - `serverGet`: Server Components (SSR/ISR). Sin cookies: solo datos públicos.
 * - `api`: navegador. Usa la sesión por cookie httpOnly (credentials: include)
 *   y, si el access token venció (401), rota el refresh una vez y reintenta.
 */

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");
const PREFIX = "/api/v1";
/**
 * En el servidor (SSR/ISR) se puede usar una URL interna (p. ej. http://api:8000
 * dentro de Docker) para no salir a internet y volver. Solo la lee el server.
 */
const SERVER_API_URL = (process.env.API_INTERNAL_URL ?? API_URL).replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | null | undefined>;

export function buildUrl(
  path: string,
  query?: Query,
  base: string = API_URL,
): string {
  const url = new URL(`${base}${PREFIX}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseError(response: Response): Promise<ApiError> {
  let message = "Algo salió mal. Probá de nuevo.";
  try {
    const body = await response.json();
    if (typeof body.detail === "string") message = body.detail;
    else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      message = String(body.detail[0].msg).replace(/^Value error, /, "");
    }
  } catch {
    /* respuesta sin JSON */
  }
  const retry = Number(response.headers.get("Retry-After"));
  return new ApiError(
    response.status,
    message,
    Number.isFinite(retry) ? retry : undefined,
  );
}

/** GET público para Server Components, con revalidación ISR. */
export async function serverGet<T>(
  path: string,
  query?: Query,
  revalidate: number | false = 60,
): Promise<T | null> {
  const response = await fetch(buildUrl(path, query, SERVER_API_URL), {
    next: revalidate === false ? undefined : { revalidate },
    cache: revalidate === false ? "no-store" : undefined,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as T;
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(buildUrl("/auth/refresh"), {
    method: "POST",
    credentials: "include",
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  /** Para endpoints de auth: no intentar refresh ante 401. */
  noRefresh?: boolean;
}

export async function api<T = void>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, noRefresh } = options;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const init: RequestInit = {
    method,
    credentials: "include",
    headers:
      body !== undefined && !isForm
        ? { "Content-Type": "application/json" }
        : undefined,
    body:
      body === undefined
        ? undefined
        : isForm
          ? (body as FormData)
          : JSON.stringify(body),
  };

  let response = await fetch(buildUrl(path, query), init);
  if (response.status === 401 && !noRefresh && (await refreshSession())) {
    response = await fetch(buildUrl(path, query), init);
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "No pudimos conectarnos. Revisá tu conexión.";
}
