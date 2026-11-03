import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, OWNER } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Condiciones de uso de CompraVendeAqui, clasificados de San Juan.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Términos y condiciones" updated="3 de noviembre de 2026">
      <p>
        Estos términos regulan el uso de CompraVendeAqui (en adelante, “la
        plataforma”), operada por {OWNER.name}, CUIT {OWNER.cuit}, con domicilio
        en {OWNER.address}. Al usar la plataforma aceptás estos términos y la{" "}
        <Link
          href="/privacidad"
          className="font-semibold text-primary underline"
        >
          Política de privacidad
        </Link>
        .
      </p>

      <h2>1. Qué es la plataforma</h2>
      <p>
        CompraVendeAqui es un espacio de clasificados para publicar y encontrar
        productos y servicios en la provincia de San Juan. La plataforma no
        vende, no compra ni intermedia en el pago: pone en contacto a quien
        publica con quien está interesado. La operación se acuerda directamente
        entre las partes.
      </p>

      <h2>2. Tu cuenta</h2>
      <ul>
        <li>
          Para publicar tenés que registrarte con un número de celular que
          verificamos con un código de un solo uso.
        </li>
        <li>
          Sos responsable de la actividad de tu cuenta y de mantener tu celular
          y tu contraseña bajo tu control.
        </li>
        <li>
          Tenés que ser mayor de 18 años o contar con autorización de tus padres
          o tutores.
        </li>
      </ul>

      <h2>3. Publicaciones</h2>
      <ul>
        <li>
          Lo que publicás tiene que ser veraz: fotos reales del producto,
          precio, moneda y estado (nuevo, usado o reacondicionado).
        </li>
        <li>
          Si sos proveedor o comerciante, tu oferta debe cumplir la Ley 24.240
          de Defensa del Consumidor: información clara, precio final y
          condiciones de la operación.
        </li>
        <li>
          Los avisos vencen a los 90 días y podés renovarlos desde “Mis avisos”.
        </li>
        <li>
          Está prohibido publicar productos ilegales, robados, falsificados,
          armas, medicamentos, animales protegidos, contenido sexual,
          discriminatorio o que infrinja derechos de terceros.
        </li>
        <li>
          Podemos pausar o dar de baja avisos que no cumplan estos términos, y
          suspender cuentas que los incumplan de forma reiterada.
        </li>
      </ul>

      <h2>4. Contacto por WhatsApp</h2>
      <p>
        Cuando alguien toca “Contactar por WhatsApp”, le mostramos tu número
        para que te escriba. Podés dejar de recibir consultas por WhatsApp
        cuando quieras desde Ajustes. No uses los datos de otros usuarios para
        fines distintos de la operación (por ejemplo, publicidad no solicitada).
      </p>

      <h2>5. Responsabilidad</h2>
      <p>
        La plataforma no garantiza la existencia, calidad, estado o legitimidad
        de lo publicado ni la capacidad de las partes para concretar la
        operación. Te recomendamos revisar el producto en persona, encontrarte
        en lugares públicos y no adelantar dinero. Esto no limita los derechos
        que te reconoce la Ley 24.240 frente al proveedor.
      </p>

      <h2>6. Cambios</h2>
      <p>
        Podemos actualizar estos términos. Si el cambio es importante, te
        avisamos en la plataforma antes de que entre en vigencia.
      </p>

      <h2>7. Contacto y jurisdicción</h2>
      <p>
        Por consultas o reclamos escribinos a {OWNER.email}. Estos términos se
        rigen por las leyes de la República Argentina. Si sos consumidor, podés
        reclamar ante la Dirección de Defensa del Consumidor de San Juan o en la
        Ventanilla Única Federal
        (argentina.gob.ar/produccion/defensadelconsumidor).
      </p>
    </LegalPage>
  );
}
