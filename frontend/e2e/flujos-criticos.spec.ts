import { expect, test } from "@playwright/test";

import { createListing, PNG, readOtp, signUp } from "./helpers";

test.describe("Flujos críticos del MVP", () => {
  test("1 · alta e ingreso por OTP de WhatsApp", async ({ page, browser }) => {
    const phone = await signUp(page, "Ana Gómez");
    await page.goto("/perfil");
    await expect(
      page.getByText("+54 9 264 ***-" + phone.digits.slice(-4)),
    ).toBeVisible();

    // Reingreso en otro dispositivo: ya no pide completar el perfil.
    const other = await browser.newContext();
    const second = await other.newPage();
    await second.goto("/ingresar?next=/mis-avisos");
    await second.getByLabel("Tu celular").fill(phone.typed);
    await expect(async () => {
      await second.getByRole("button", { name: "Enviar código" }).click();
      await expect(second.getByLabel("Código de 6 números")).toBeVisible({
        timeout: 2000,
      });
    }).toPass();
    await second
      .getByLabel("Código de 6 números")
      .fill(await readOtp(second.request, phone.digits));
    await second.getByRole("button", { name: "Ingresar" }).click();
    await expect(second).toHaveURL(/\/mis-avisos$/);
    await other.close();
  });

  test("2 · publicar un aviso con foto y precio en dólares", async ({
    page,
  }) => {
    await signUp(page);
    await page.goto("/publicar");

    await page.getByRole("button", { name: /Vehículos/ }).click();
    await page.getByRole("button", { name: /^Autos/ }).click();

    await page.getByLabel("Título").fill("Fiat Cronos Drive 2021");
    await page
      .getByLabel("Descripción")
      .fill("Primera mano, 40.000 km, service oficial al día.");
    await page.getByRole("radio", { name: "Usado" }).check();
    await page.getByRole("button", { name: "Siguiente" }).click();

    await page.getByRole("radio", { name: /Dólares/ }).check();
    await page
      .getByRole("textbox", { name: /Precio en dólares/ })
      .fill("14500");
    await page.getByLabel("Departamento").selectOption("Rawson");
    await page.getByRole("button", { name: "Siguiente" }).click();

    await page.locator("input[type=file]").setInputFiles({
      name: "cronos.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: "Siguiente" }).click();

    await page.getByRole("button", { name: "Publicar aviso" }).click();
    await expect(page).toHaveURL(/\/autos\/fiat-cronos-drive-2021-[a-z0-9]+$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Fiat Cronos Drive 2021" }),
    ).toBeVisible();
    await expect(page.getByText("US$ 14.500").first()).toBeVisible();
    await expect(page.getByRole("img", { name: /Foto 1 de 1/ })).toBeVisible();
  });

  test("3 · buscar y filtrar por categoría, departamento y precio", async ({
    page,
    isMobile,
  }) => {
    await signUp(page);
    const tag = `Prueba${Date.now().toString(36)}`;
    await createListing(page, {
      title: `Peugeot 208 ${tag}`,
      department: "Chimbas",
      price: "12000",
    });
    await createListing(page, {
      title: `Peugeot 308 ${tag}`,
      department: "Pocito",
      price: "21000",
    });

    await page.goto("/");
    const search = page
      .getByRole("combobox", { name: "Buscar avisos" })
      .first();
    await search.fill(tag);
    await search.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/buscar\\?q=${tag}`));
    await expect(
      page.getByRole("link", { name: /Peugeot (2|3)08/ }),
    ).toHaveCount(2);

    if (isMobile) await page.getByRole("button", { name: /Filtros/ }).click();
    const filters = page.getByRole("form", { name: "Filtros" }).last();
    await filters.getByLabel("Departamento").selectOption("Pocito");
    await filters.getByRole("button", { name: "Ver resultados" }).click();
    await expect(
      page.getByRole("link", { name: `Peugeot 308 ${tag}` }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: `Peugeot 208 ${tag}` }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Pocito/ }).first(),
    ).toBeVisible(); // chip

    await page.goto(`/vehiculos?q=${tag}&currency=USD&price_max=15000`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Vehículos en San Juan" }),
    ).toBeVisible();
    await page.goto(`/buscar?q=${tag}&currency=USD&price_max=15000`);
    await expect(
      page.getByRole("link", { name: `Peugeot 208 ${tag}` }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: `Peugeot 308 ${tag}` }),
    ).toHaveCount(0);
  });

  test("4 · contactar al vendedor por WhatsApp y contar el clic", async ({
    page,
    browser,
  }) => {
    const seller = await signUp(page, "Carlos Vende");
    const listing = await createListing(page, {
      title: "Renault Kangoo 2019",
      department: "Capital",
      price: "11000",
    });

    const buyerContext = await browser.newContext();
    await buyerContext.route("https://wa.me/**", (route) =>
      route.fulfill({ body: "WhatsApp" }),
    );
    const buyer = await buyerContext.newPage();
    await buyer.goto(listing.url_path);

    // El teléfono no está en el HTML antes del clic (anti-scraping).
    expect(await buyer.content()).not.toContain(seller.digits.slice(-7));

    const [whatsapp] = await Promise.all([
      buyerContext.waitForEvent("page"),
      buyer.getByRole("button", { name: "Contactar por WhatsApp" }).click(),
    ]);
    await expect
      .poll(() => whatsapp.url())
      .toContain(`https://wa.me/${seller.digits}?text=`);
    expect(decodeURIComponent(whatsapp.url())).toContain("Renault Kangoo 2019");
    await expect(buyer.getByText(/Si WhatsApp no se abrió/)).toBeVisible();
    await buyerContext.close();

    await page.goto("/mis-avisos");
    await expect(page.getByText(/1 contacto/)).toBeVisible();
  });

  test("5 · gestionar avisos: editar, marcar vendido y eliminar", async ({
    page,
  }) => {
    await signUp(page);
    const listing = await createListing(page, {
      title: "Moto Honda Wave 2020",
      department: "Rivadavia",
      price: "1500",
    });

    await page.goto(`/avisos/${listing.id}/editar`);
    await page.getByLabel("Título").fill("Moto Honda Wave 110 2020");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /Guardamos|guardad/i }),
    ).toBeVisible();

    await page.goto("/mis-avisos");
    await expect(
      page.getByRole("heading", { name: "Moto Honda Wave 110 2020" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Marcar como vendido/ }).click();
    await expect(page.getByText("Vendido").first()).toBeVisible();
    const publicPage = await page.request.get(
      listing.url_path.replace("2020-", "110-2020-"),
    );
    expect([404, 200]).toContain(publicPage.status());

    await page.getByRole("button", { name: /^Eliminar/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Eliminar aviso" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Moto Honda Wave 110 2020" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Publicar mi primer aviso" }),
    ).toBeVisible();
  });
});
