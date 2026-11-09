import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { createListing, signUp } from "./helpers";

/** Auditoría WCAG 2.1 AA con axe-core (el motor de accesibilidad de Lighthouse). */
async function audit(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const report = violations.map(
    (v) =>
      `[${v.impact}] ${v.id}: ${v.help} → ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 3)
        .join(" | ")}`,
  );
  expect(report, `Violaciones WCAG en ${label}`).toEqual([]);
}

test.describe("Accesibilidad WCAG 2.1 AA", () => {
  test("páginas públicas", async ({ page }) => {
    await signUp(page);
    const listing = await createListing(page, {
      title: "Bicicleta rodado 29 aluminio",
      department: "Capital",
      price: "350000",
      currency: "ARS",
      category: "bicicletas",
    });
    await page.context().clearCookies();
    for (const path of [
      "/",
      "/buscar?q=bicicleta",
      "/deportes",
      listing.url_path,
      "/ingresar",
      "/ingresar/enlace?t=token-de-prueba-para-la-auditoria-a11y&next=/publicar",
      "/uniformes",
      "/uniformes/colegio-santa-rosa-de-lima",
      "/uniformes/carrito",
      "/terminos",
      "/privacidad",
      "/no-existe",
    ]) {
      await page.goto(path);
      await audit(page, path);
    }
  });

  test("pantallas con sesión", async ({ page }) => {
    await signUp(page);
    const listing = await createListing(page, {
      title: "Heladera Gafa 300 litros",
      department: "Rawson",
      price: "420000",
      currency: "ARS",
      category: "electrodomesticos",
    });
    for (const path of [
      "/mis-avisos",
      "/perfil",
      "/ajustes",
      `/avisos/${listing.id}/editar`,
      "/publicar",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      await audit(page, path);
    }
  });

  test("flujo de ingreso: paso del código y de completar perfil", async ({
    page,
  }) => {
    await page.goto("/ingresar");
    await page
      .getByLabel("Tu email")
      .fill(`a11y.${Date.now()}@e2e.compravendeaqui.com.ar`);
    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page.getByLabel("Código de 6 números")).toBeVisible();
    await audit(page, "/ingresar (código)");
    // Con el mouse encima, el botón primario también tiene que cumplir AA.
    await page.getByRole("button", { name: "Ingresar" }).hover();
    await page.waitForTimeout(400); // fin de la transición de color
    await audit(page, "/ingresar (botón en hover)");
  });
});

test.describe("Uso solo con teclado", () => {
  test.skip(({ isMobile }) => isMobile, "Recorrido de teclado: solo desktop");

  test("saltar al contenido, buscar y abrir un aviso hasta el botón de WhatsApp", async ({
    page,
  }) => {
    await signUp(page);
    const title = `Notebook Lenovo IdeaPad ${Date.now().toString(36)}`;
    await createListing(page, {
      title,
      department: "Chimbas",
      price: "850000",
      currency: "ARS",
      category: "computacion",
    });
    await page.context().clearCookies();
    await page.goto("/");

    // El primer Tab muestra el link "Saltar al contenido".
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    // Buscar escribiendo y con Enter.
    const search = page
      .getByRole("combobox", { name: "Buscar avisos" })
      .first();
    await search.focus();
    await page.keyboard.type("Lenovo IdeaPad");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/buscar\?q=Lenovo/);

    // Llegar al aviso con Tab y abrirlo con Enter.
    const result = page.getByRole("link", {
      name: title,
    });
    for (
      let i = 0;
      i < 60 && !(await result.evaluate((el) => el === document.activeElement));
      i++
    ) {
      await page.keyboard.press("Tab");
    }
    await expect(result).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: title,
      }),
    ).toBeVisible();

    // El CTA de WhatsApp se alcanza con Tab y tiene foco visible.
    const cta = page.getByRole("button", { name: "Contactar por WhatsApp" });
    for (
      let i = 0;
      i < 40 && !(await cta.evaluate((el) => el === document.activeElement));
      i++
    ) {
      await page.keyboard.press("Tab");
    }
    await expect(cta).toBeFocused();
    const outline = await cta.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.outlineStyle !== "none" || s.boxShadow !== "none";
    });
    expect(outline, "el botón enfocado debe mostrar el foco").toBe(true);
  });

  test("publicar: elegir categoría y avanzar con el teclado", async ({
    page,
  }) => {
    await signUp(page);
    await page.goto("/publicar");
    const vehiculos = page.getByRole("button", { name: /Vehículos/ });
    await vehiculos.focus();
    await page.keyboard.press("Enter");
    const autos = page.getByRole("button", { name: /^Autos/ });
    await autos.focus();
    await page.keyboard.press("Enter");
    // El foco va al título del nuevo paso (anuncio para lectores de pantalla).
    await expect(page.getByLabel("Título")).toBeVisible();
    await page.getByLabel("Título").focus();
    await page.keyboard.type("Chevrolet Onix 2020");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Muy cuidado, único dueño, papeles al día.");
    await expect(page.getByLabel("Descripción")).toHaveValue(/único dueño/);
  });

  test("los diálogos atrapan el foco y se cierran con Escape", async ({
    page,
  }) => {
    await signUp(page);
    await createListing(page, {
      title: "Mesa de algarrobo 6 sillas",
      department: "Pocito",
      price: "300000",
      currency: "ARS",
      category: "muebles",
    });
    await page.goto("/mis-avisos");
    await page.getByRole("button", { name: /^Eliminar/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((d) => d.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Mesa de algarrobo 6 sillas" }),
    ).toBeVisible();
  });
});
