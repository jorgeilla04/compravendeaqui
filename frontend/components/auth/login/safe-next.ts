/**
 * Sanea el parámetro `next` para evitar open redirects: solo rutas relativas
 * del propio sitio ("/algo"), nunca "//otro.com", "/\\otro.com" ni URLs absolutas.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return "/";
  const value = raw.trim();
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  )
    return "/";
  // Caracteres de control (p. ej. "/\t/otro.com") que el navegador descarta.
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  // Evita volver a la propia pantalla de ingreso.
  if (
    value === "/ingresar" ||
    value.startsWith("/ingresar?") ||
    value.startsWith("/ingresar/")
  ) {
    return "/";
  }
  return value;
}
