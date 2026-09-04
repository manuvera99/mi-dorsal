import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo tratamos tus datos personales en mi-dorsal.",
  alternates: { canonical: "/legal/privacidad" },
  robots: { index: true, follow: true },
};

export default function PrivacidadPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose prose-gray">
      <h1>Política de privacidad</h1>
      <p className="text-sm text-gray-500">Última actualización: 4 de septiembre de 2026</p>

      <h2>1. Responsable del tratamiento</h2>
      <p>
        <strong>mi-dorsal</strong> (en adelante, "nosotros" o "el servicio") es el responsable del
        tratamiento de los datos personales recogidos a través de este sitio web. Para cualquier
        consulta relativa a protección de datos, puedes escribir a{" "}
        <a href="mailto:privacidad@mi-dorsal.es">privacidad@mi-dorsal.es</a>.
      </p>

      <h2>2. Datos que recogemos</h2>
      <ul>
        <li>
          <strong>De cuenta (si te registras):</strong> nombre, email, foto de perfil y datos de
          autenticación gestionados por Clerk (nuestro proveedor de identidad).
        </li>
        <li>
          <strong>De uso:</strong> páginas visitadas, tiempos de carga, clicks y otras métricas
          anónimas o pseudonimizadas para entender cómo se usa la web.
        </li>
        <li>
          <strong>De cookies y tecnologías similares:</strong> solo si nos das tu consentimiento
          (ver <a href="/legal/cookies">Política de cookies</a>).
        </li>
        <li>
          <strong>De actividad deportiva:</strong> marcas personales (PRs), carreras planeadas y
          resultados, si decides añadirlos.
        </li>
      </ul>

      <h2>3. Finalidad y base legal</h2>
      <ul>
        <li>
          <strong>Prestar el servicio</strong> (base: ejecución de contrato): gestionar tu cuenta,
          mostrar tu calendario, calcular predicciones de tiempo, enviarte resultados.
        </li>
        <li>
          <strong>Mejorar el servicio</strong> (base: interés legítimo): analítica agregada de uso,
          métricas de rendimiento, detección de errores.
        </li>
        <li>
          <strong>Comunicaciones</strong> (base: consentimiento): emails transaccionales sobre
          tus carreras y, opcionalmente, un resumen semanal.
        </li>
        <li>
          <strong>Publicidad personalizada</strong> (base: consentimiento): si la das, Google
          AdSense puede mostrar anuncios relevantes.
        </li>
      </ul>

      <h2>4. Encargados de tratamiento</h2>
      <p>Compartimos datos con los siguientes proveedores de servicios:</p>
      <ul>
        <li>
          <strong>Clerk</strong> — autenticación de usuarios.{" "}
          <a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer">
            Política de privacidad de Clerk
          </a>
        </li>
        <li>
          <strong>Convex</strong> — base de datos y backend serverless.{" "}
          <a href="https://www.convex.dev/privacy" target="_blank" rel="noopener noreferrer">
            Política de privacidad de Convex
          </a>
        </li>
        <li>
          <strong>Vercel</strong> — hosting y CDN.{" "}
          <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
            Política de privacidad de Vercel
          </a>
        </li>
        <li>
          <strong>Resend</strong> — envío de emails transaccionales.{" "}
          <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
            Política de privacidad de Resend
          </a>
        </li>
        <li>
          <strong>Google Analytics 4 y Google AdSense</strong> — analítica y publicidad, solo si
          das tu consentimiento.
        </li>
      </ul>

      <h2>5. Conservación de datos</h2>
      <p>
        Conservamos tus datos de cuenta mientras no solicites la baja. Puedes solicitar la
        eliminación de tu cuenta y todos los datos asociados en cualquier momento escribiéndonos
        a <a href="mailto:privacidad@mi-dorsal.es">privacidad@mi-dorsal.es</a>. Los datos
        anonimizados para analítica agregada pueden conservarse hasta 24 meses.
      </p>

      <h2>6. Tus derechos</h2>
      <p>Tienes derecho a:</p>
      <ul>
        <li><strong>Acceder</strong> a tus datos personales.</li>
        <li><strong>Rectificar</strong> datos inexactos o incompletos.</li>
        <li><strong>Suprimir</strong> tus datos (derecho al olvido).</li>
        <li><strong>Oponerte</strong> al tratamiento o solicitar su <strong>limitación</strong>.</li>
        <li><strong>Portabilidad</strong>: recibir tus datos en un formato estructurado y de uso común.</li>
        <li>Retirar el consentimiento en cualquier momento, sin que afecte a la licitud del tratamiento previo.</li>
      </ul>
      <p>
        Para ejercer estos derechos, escríbenos a{" "}
        <a href="mailto:privacidad@mi-dorsal.es">privacidad@mi-dorsal.es</a>. También puedes
        presentar una reclamación ante la Agencia Española de Protección de Datos
        (<a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>).
      </p>

      <h2>7. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas para proteger tus datos: HTTPS en toda la web,
        encriptación de contraseñas (gestionadas por Clerk), acceso limitado por roles, y
        auditoría periódica de nuestros proveedores.
      </p>

      <h2>8. Cambios en esta política</h2>
      <p>
        Podemos actualizar esta política para reflejar cambios legales o del servicio. Te
        avisaremos por email y/o mediante un aviso visible en la web si los cambios son
        significativos. La fecha de la última actualización aparece al inicio de esta página.
      </p>
    </article>
  );
}
