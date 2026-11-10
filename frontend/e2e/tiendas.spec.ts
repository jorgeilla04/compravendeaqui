import { expect, type Page, test } from "@playwright/test";

const FAKE_SMTP = process.env.E2E_FAKE_SMTP_URL ?? "http://localhost:9997";
const VENDEDORA = "virginialauratello@gmail.com";

async function armarCarrito(page: Page) {
  await page.goto("/tiendas/uniformes");
  await page.getByLabel("Buscá tu colegio").fill("santa rosa");
  await page.getByRole("link", { name: /Colegio Santa Rosa de Lima/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Colegio Santa Rosa de Lima" }),
  ).toBeVisible();

  const remera = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: "Remera / chomba" }),
  });
  await remera.getByLabel("Talle").selectOption("10");
  await remera.getByRole("button", { name: "Una remera / chomba más" }).click();
  await remera.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(remera.getByText(/Agregaste 2 remera/)).toBeVisible();

  const corbata = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: "Corbata" }),
  });
  await corbata.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(
    page.getByRole("link", { name: "Ver carrito, 3 productos" }),
  ).toBeVisible();
}

/** Productos distintos guardados en el carrito de la tienda de uniformes. */
async function carrito(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (
        JSON.parse(
          localStorage.getItem("cva-carrito-uniformes") ?? "[]",
        ) as unknown[]
      ).length,
  );
}

async function completarDatos(page: Page) {
  await page.getByLabel("Nombre y apellido").fill("María González");
  await page.getByLabel(/Celular/).fill("264 412-3456");
  await page.getByLabel("Dirección de entrega").fill("Av. Libertador 1234 (O)");
  await page.getByLabel("Departamento").selectOption("Rawson");
}

test.describe("Tiendas: uniformes escolares", () => {
  test("comprar con seña y Mercado Pago, y avisar a la vendedora", async ({
    page,
  }) => {
    await armarCarrito(page);
    await page.getByRole("link", { name: "Ver carrito, 3 productos" }).click();
    const resumen = page.getByRole("complementary", { name: "Resumen" });
    await expect(resumen.getByText("$ 35.000")).toBeVisible(); // 30.000 + envío
    await completarDatos(page);
    await resumen
      .getByRole("button", { name: "Pagar $ 8.000 con Mercado Pago" })
      .click();

    // Checkout de Mercado Pago (servidor de prueba).
    await expect(
      page.getByRole("heading", { name: "Mercado Pago de prueba" }),
    ).toBeVisible();
    await expect(page.getByText("Monto: 8000")).toBeVisible();
    await page.getByRole("button", { name: "Pagar" }).click();

    await expect(page).toHaveURL(/\/tiendas\/pedido\/[\w-]+\?payment_id=\d+/);
    await expect(
      page.getByRole("heading", { name: "¡Listo! Recibimos tu pago" }),
    ).toBeVisible();
    await expect(page.getByText(/Pagaste la seña de \$ 8.000/)).toBeVisible();
    // El carrito de la tienda queda vacío.
    await expect.poll(() => carrito(page)).toBe(0);

    // A la vendedora le llega el detalle por mail.
    await expect
      .poll(async () => {
        const res = await page.request.get(
          `${FAKE_SMTP}/__mail?to=${encodeURIComponent(VENDEDORA)}`,
        );
        return res.ok() ? ((await res.json()).text as string) : "";
      })
      .toContain("Saldo contra entrega: $27.000");
  });

  test("si el pago se rechaza se puede probar de nuevo", async ({ page }) => {
    await armarCarrito(page);
    await page.goto("/tiendas/uniformes/carrito");
    await page.getByRole("radio", { name: /Express 24 hs/ }).check();
    await page.getByRole("radio", { name: /^Total/ }).check();
    await completarDatos(page);
    await page
      .getByRole("button", { name: "Pagar $ 41.000 con Mercado Pago" })
      .click();
    await page.getByRole("button", { name: "Rechazar" }).click();

    await expect(
      page.getByRole("heading", { name: "El pago no se aprobó" }),
    ).toBeVisible();
    // El carrito sigue armado por si quiere cambiar algo.
    expect(await carrito(page)).toBe(2);
    await page.getByRole("link", { name: "Probar de nuevo" }).click();
    await page.getByRole("button", { name: "Pagar" }).click();
    await expect(
      page.getByRole("heading", { name: "¡Listo! Recibimos tu pago" }),
    ).toBeVisible();
    await expect(
      page.getByText("No tenés que pagar nada en la entrega."),
    ).toBeVisible();
  });
});

test("la dirección vieja /uniformes lleva a la tienda", async ({ page }) => {
  await page.goto("/uniformes");
  await expect(page).toHaveURL(/\/tiendas\/uniformes$/);
  await page.goto("/tiendas");
  // El header también enlaza la tienda: se elige la tarjeta del listado.
  await page
    .getByRole("main")
    .getByRole("link", { name: /Uniformes escolares/ })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Uniformes escolares" }),
  ).toBeVisible();
});
