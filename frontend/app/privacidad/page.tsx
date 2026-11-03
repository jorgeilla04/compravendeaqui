import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, OWNER } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Cómo CompraVendeAqui trata tus datos personales según la Ley 25.326.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad" updated="3 de noviembre de 2026">
      <p>
        Esta política explica qué datos personales recolectamos, para qué los
        usamos y cómo podés ejercer tus derechos, según la Ley 25.326 de
        Protección de los Datos Personales y la normativa de la Agencia de
        Acceso a la Información Pública (AAIP).
      </p>

      <h2>1. Responsable</h2>
      <p>
        El responsable de la base de datos es {OWNER.name}, CUIT {OWNER.cuit},
        con domicilio en {OWNER.address}. Contacto: {OWNER.email}.
      </p>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>
          Tu número de celular (para verificar tu identidad con un código y para
          que los compradores te contacten).
        </li>
        <li>
          Nombre, nombre de usuario y, si lo cargás, email y foto de perfil.
        </li>
        <li>Tus avisos: textos, fotos, precio, departamento y localidad.</li>
        <li>
          Datos técnicos mínimos: dirección IP y registros de uso, para
          seguridad y para evitar abusos.
        </li>
      </ul>
      <p>
        Las fotos se procesan para quitar los metadatos (incluida la ubicación
        GPS) antes de publicarse.
      </p>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>
          Crear y proteger tu cuenta (código de ingreso por WhatsApp o SMS).
        </li>
        <li>
          Mostrar tus avisos y permitir que te contacten por WhatsApp, si lo
          aceptaste.
        </li>
        <li>Medir vistas y contactos de tus avisos.</li>
        <li>Prevenir fraudes y cumplir obligaciones legales.</li>
      </ul>
      <p>
        No vendemos tus datos. No te enviamos publicidad sin tu consentimiento
        expreso.
      </p>

      <h2>4. Tu teléfono</h2>
      <p>
        Tu número no aparece en las páginas de los avisos. Solo se muestra a
        quien toca “Contactar por WhatsApp” en un aviso tuyo, y podés
        desactivarlo cuando quieras desde Ajustes.
      </p>

      <h2>5. Con quién compartimos datos</h2>
      <p>
        Con proveedores que necesitamos para funcionar, que solo usan los datos
        para prestarnos el servicio: el envío del código de ingreso (Meta
        Platforms — WhatsApp Business — y Twilio para SMS), el almacenamiento de
        fotos y el alojamiento del sitio. Algunos de estos proveedores pueden
        procesar datos fuera de la Argentina, con las garantías que exige la
        normativa vigente.
      </p>

      <h2>6. Tus derechos</h2>
      <ul>
        <li>
          <strong>Acceso:</strong> podés descargar todos tus datos desde{" "}
          <Link
            href="/ajustes"
            className="font-semibold text-primary underline"
          >
            Ajustes
          </Link>
          . La ley prevé que puedas ejercerlo en forma gratuita a intervalos no
          inferiores a seis meses, salvo interés legítimo.
        </li>
        <li>
          <strong>Rectificación:</strong> podés corregir tus datos desde tu
          perfil.
        </li>
        <li>
          <strong>Supresión:</strong> podés eliminar tu cuenta desde Ajustes.
          Borramos tu celular, email, nombre y foto, y damos de baja tus avisos.
        </li>
      </ul>
      <p>
        Respondemos los pedidos de acceso dentro de los 10 días corridos y los
        de rectificación o supresión dentro de los 5 días hábiles. La AAIP,
        órgano de control de la Ley 25.326, atiende las denuncias y reclamos de
        quienes vean afectados sus derechos (argentina.gob.ar/aaip).
      </p>

      <h2>7. Seguridad y conservación</h2>
      <p>
        Usamos conexiones cifradas, guardamos los códigos y contraseñas de forma
        irreversible y limitamos los intentos de ingreso. Conservamos los datos
        mientras tu cuenta esté activa y, después, solo lo que exija la ley.
      </p>

      <h2>8. Cookies</h2>
      <p>
        Usamos cookies técnicas indispensables para mantener tu sesión iniciada.
        No usamos cookies de publicidad.
      </p>
    </LegalPage>
  );
}
