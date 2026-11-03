/** JSON-LD seguro dentro de <script>: escapa "<" para que no cierre el tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
