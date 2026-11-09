import { type APIRequestContext, expect, type Page } from "@playwright/test";

export const API = process.env.E2E_API_URL ?? "http://localhost:8010";
const FAKE_SMTP = process.env.E2E_FAKE_SMTP_URL ?? "http://localhost:9997";
const ORIGIN = process.env.E2E_BASE_URL ?? "http://localhost:3010";

/** Celular válido y único por test: 264 4xx-xxxx. */
export function randomPhone(): { typed: string; digits: string } {
  const n = `4${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
  return { typed: `264 ${n.slice(0, 3)}-${n.slice(3)}`, digits: `549264${n}` };
}

/** Email único por test. */
export function randomEmail(): string {
  return `e2e.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}@e2e.compravendeaqui.com.ar`;
}

/** Último mail que el backend mandó por SMTP (al servidor falso): código y link. */
export async function readMail(
  request: APIRequestContext,
  email: string,
  previousCode = "",
): Promise<{ code: string; link: string }> {
  let mail = { code: "", link: "" };
  await expect
    .poll(async () => {
      const response = await request.get(
        `${FAKE_SMTP}/__mail?to=${encodeURIComponent(email)}`,
      );
      if (!response.ok()) return "";
      mail = await response.json();
      return mail.code === previousCode ? "" : mail.code;
    })
    .toMatch(/^\d{6}$/);
  return mail;
}

/** Completa el perfil de un usuario recién creado por email. */
export async function completeProfile(
  page: Page,
  name: string,
  phone: { typed: string; digits: string },
) {
  await expect(
    page.getByRole("heading", { name: "Completá tu perfil" }),
  ).toBeVisible();
  await page
    .getByLabel("Nombre de usuario")
    .fill(`e2e${phone.digits.slice(-7)}`);
  await page.getByLabel("Nombre y apellido").fill(name);
  await page.getByLabel(/Tu celular/).fill(phone.typed);
  await page.getByLabel(/Acepto los/).check();
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
}

/** Alta completa por email (código) desde la UI, con celular de WhatsApp. */
export async function signUp(page: Page, name = "Vendedora E2E") {
  const phone = randomPhone();
  const email = randomEmail();
  await page.goto("/ingresar");
  await page.getByLabel("Tu email").fill(email);
  await page.getByRole("button", { name: "Enviar código" }).click();
  const { code } = await readMail(page.request, email);
  await page.getByLabel("Código de 6 números").fill(code);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await completeProfile(page, name, phone);
  await expect(page).not.toHaveURL(/\/ingresar/);
  return { ...phone, email };
}

/** Crea un aviso por API con la sesión del navegador (para preparar datos). */
export async function createListing(
  page: Page,
  data: {
    title: string;
    department: string;
    price: string;
    currency?: "ARS" | "USD";
    category?: string;
  },
): Promise<{ id: string; url_path: string }> {
  const categories = await (
    await page.request.get(
      `${API}/api/v1/categories/${data.category ?? "autos"}`,
    )
  ).json();
  const response = await page.request.post(`${API}/api/v1/listings`, {
    headers: { Origin: ORIGIN },
    data: {
      title: data.title,
      description: "Excelente estado, se puede ver sin compromiso.",
      category_id: categories.id,
      price: data.price,
      price_currency: data.currency ?? "USD",
      condition: "usado",
      department: data.department,
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

/** PNG de 1x1 válido para subir como foto. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
