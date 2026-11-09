import { serverGet } from "@/lib/api";
import type { LoginMethod } from "@/lib/types";

/** Lo decide la API (LOGIN_METHOD); si no responde, se ofrece email. */
export async function loginMethod(): Promise<LoginMethod> {
  try {
    const res = await serverGet<{ otp: LoginMethod }>(
      "/auth/methods",
      undefined,
      60,
    );
    return res?.otp === "phone" ? "phone" : "email";
  } catch {
    return "email";
  }
}
