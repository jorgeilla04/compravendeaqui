"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { CodeStep } from "@/components/auth/login/code-step";
import { PasswordStep } from "@/components/auth/login/password-step";
import { PhoneStep } from "@/components/auth/login/phone-step";
import { ProfileStep } from "@/components/auth/login/profile-step";
import { safeNext } from "@/components/auth/login/safe-next";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuthResponse, OtpRequestResponse } from "@/lib/types";

type Step =
  | { name: "phone" }
  | { name: "password" }
  | { name: "code"; otp: OtpRequestResponse }
  | { name: "profile" };

/**
 * Ingreso en una acción por pantalla: celular → código → (perfil si es nuevo).
 * La redirección al destino (`next`) vive en un solo lugar: el efecto que
 * observa al usuario de la sesión.
 */
export function LoginFlow() {
  const { user, loading, setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [step, setStep] = React.useState<Step>({ name: "phone" });
  const [phone, setPhone] = React.useState("");

  React.useEffect(() => {
    if (!loading && user && !user.profile_pending) router.replace(next);
  }, [loading, user, next, router]);

  function handleAuthenticated(res: AuthResponse) {
    // Perfil pendiente → paso de perfil; si no, el efecto redirige a `next`.
    setUser(res.user);
  }

  if (loading || (user && !user.profile_pending)) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <span className="sr-only">Cargando…</span>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  // Con sesión pero perfil sin completar, el único paso posible es el perfil.
  const current: Step = user?.profile_pending ? { name: "profile" } : step;

  switch (current.name) {
    case "profile":
      return <ProfileStep user={user} onDone={(me) => setUser(me)} />;
    case "code":
      return (
        <CodeStep
          phone={phone}
          otp={current.otp}
          onVerified={handleAuthenticated}
          onResent={(otp) => setStep({ name: "code", otp })}
          onChangePhone={() => setStep({ name: "phone" })}
        />
      );
    case "password":
      return (
        <PasswordStep
          initialPhone={phone}
          onLoggedIn={handleAuthenticated}
          onUseCode={(value) => {
            setPhone(value);
            setStep({ name: "phone" });
          }}
        />
      );
    default:
      return (
        <PhoneStep
          initialPhone={phone}
          onSent={(value, otp) => {
            setPhone(value);
            setStep({ name: "code", otp });
          }}
          onUsePassword={(value) => {
            setPhone(value);
            setStep({ name: "password" });
          }}
        />
      );
  }
}
