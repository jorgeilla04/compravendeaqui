import { formatPrice, relativeDays } from "@/lib/format";
import { jsonLd } from "@/lib/seo";

describe("formatPrice", () => {
  it("muestra siempre la moneda", () => {
    expect(formatPrice("15900", "USD")).toBe("US$ 15.900");
    expect(formatPrice("480000.00", "ARS")).toBe("$ 480.000");
    expect(formatPrice(null, "ARS")).toBe("Precio a consultar");
  });
});

describe("relativeDays", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("expresa la antigüedad en lenguaje natural", () => {
    expect(relativeDays("2026-11-10T08:00:00Z", now)).toBe("hoy");
    expect(relativeDays("2026-11-09T08:00:00Z", now)).toBe("ayer");
    expect(relativeDays("2026-11-03T08:00:00Z", now)).toBe("hace 7 días");
    expect(relativeDays("2026-09-01T08:00:00Z", now)).toBe("hace 2 meses");
  });
});

describe("jsonLd", () => {
  it("no permite cerrar el <script> desde los datos del aviso", () => {
    const out = jsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});
