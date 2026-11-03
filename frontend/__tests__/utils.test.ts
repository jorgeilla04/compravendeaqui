import { cn } from "@/lib/utils";

describe("cn (tailwind-merge con la escala tipográfica propia)", () => {
  it("conserva el color de texto junto a un tamaño propio", () => {
    expect(cn("text-accent-foreground", "text-meta")).toBe(
      "text-accent-foreground text-meta",
    );
    expect(cn("text-primary-foreground", "text-h3")).toBe(
      "text-primary-foreground text-h3",
    );
  });

  it("resuelve conflictos entre tamaños propios", () => {
    expect(cn("text-base", "text-h3")).toBe("text-h3");
  });
});
