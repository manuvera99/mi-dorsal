import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Qué cookies usa mi-dorsal y cómo gestionarlas.",
  alternates: { canonical: "/legal/cookies" },
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose prose-gray">
      <h1>Política de cookies</h1>
      <p className="text-sm text-gray-500">Última actualización: 4 de septiembre de 2026</p>

      <h2>¿Qué son las cookies?</h2>
      <p>
        Las cookies son pequeños archivos de texto que un sitio web almacena en tu navegador
        cuando lo visitas. Sirven para que la web funcione, recuerde tus preferencias y, en
        algunos casos, para mostrarte publicidad relevante o medir cómo usas el sitio.
      </p>

      <h2>¿Qué cookies usamos?</h2>
      <p>Usamos las siguientes categorías de cookies:</p>

      <h3>1. Cookies técnicas (siempre activas)</h3>
      <p>
        Imprescindibles para que la web funcione. Incluyen cookies de sesión para mantenerte
        autenticado y preferencias de interfaz (idioma, cookies aceptadas). <strong>No</strong>{" "}
        requieren consentimiento según la normativa.
      </p>
      <ul>
        <li><code>__session</code>, <code>__client_uat</code>, <code>__client_uat_*</code> — Clerk (sesión de usuario)</li>
        <li><code>convex-session-*</code> — Convex (estado del backend)</li>
        <li><code>mi-dorsal-cookie-consent</code> — recuerda tu elección de cookies</li>
      </ul>

      <h3>2. Cookies analíticas (solo si aceptas)</h3>
      <p>
        Usamos <strong>Google Analytics 4</strong> para entender qué páginas son las más
        visitadas, de dónde vienen los usuarios y cómo navegan. Estas cookies son anónimas y
        agregadas.
      </p>
      <ul>
        <li><code>_ga</code>, <code>_ga_*</code> — Google Analytics (duración 2 años)</li>
      </ul>

      <h3>3. Cookies de marketing (solo si aceptas)</h3>
      <p>
        Si tenemos <strong>Google AdSense</strong> habilitado, Google puede usar cookies para
        mostrarte anuncios relevantes y medir su rendimiento. Más info en la{" "}
        <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">
          política de Google
        </a>.
      </p>
      <ul>
        <li><code>_gcl_au</code>, <code>IDE</code>, <code>NID</code> — Google AdSense</li>
      </ul>

      <h2>¿Cómo gestionar o rechazar las cookies?</h2>
      <p>
        Cuando entras por primera vez en la web, te mostramos un banner donde puedes aceptar o
        rechazar las cookies no técnicas. Tu elección se guarda en <code>localStorage</code> y
        puedes cambiarla borrando los datos del navegador o escribiéndonos a{" "}
        <a href="mailto:privacidad@mi-dorsal.es">privacidad@mi-dorsal.es</a>.
      </p>
      <p>También puedes gestionar las cookies directamente en tu navegador:</p>
      <ul>
        <li>
          <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">
            Google Chrome
          </a>
        </li>
        <li>
          <a href="https://support.mozilla.org/es/kb/Borrar%20cookies" target="_blank" rel="noopener noreferrer">
            Mozilla Firefox
          </a>
        </li>
        <li>
          <a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">
            Safari
          </a>
        </li>
        <li>
          <a href="https://support.microsoft.com/es-es/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">
            Microsoft Edge
          </a>
        </li>
      </ul>

      <h2>Transferencias internacionales</h2>
      <p>
        Google Analytics y AdSense pueden transferir datos a servidores fuera del Espacio
        Económico Europeo. Estas transferencias están amparadas por las cláusulas contractuales
        tipo de la Comisión Europea y la decisión de adecuación para EE.UU. (Data Privacy
        Framework) cuando aplica.
      </p>

      <h2>Más información</h2>
      <p>
        Para más detalles sobre cómo tratamos tus datos personales, consulta nuestra{" "}
        <a href="/legal/privacidad">Política de privacidad</a>.
      </p>
    </article>
  );
}
