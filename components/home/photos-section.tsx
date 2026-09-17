/**
 * PhotosSection — sección nueva de la home (v3.1, sep 2026).
 *
 * Reclamo de las dos features Pro de búsqueda de fotos:
 *   1. "Te avisamos": cuando la organización publica las fotos, llega
 *      un email automático al corredor.
 *   2. "Te encontramos": el corredor sube una selfie y la IA busca entre
 *      las fotos usando cara + dorsal. Las coincidencias se muestran para
 *      que el usuario elija.
 *
 * Disclaimer pequeño: solo disponible en carreras con fotos públicas.
 * Requiere plan Pro.
 *
 * Stack: server component declarativo. Sin JS. Sin fetches.
 */

export function PhotosSection() {
  return (
    <section
      className="py-10 md:py-14"
      aria-labelledby="photos-title"
      style={{ background: "#fff" }}
    >
      <div className="container">
        <div className="text-center mb-10 md:mb-12 max-w-3xl mx-auto px-4">
          <p
            className="text-sm font-semibold uppercase tracking-wider mb-3"
            style={{
              color: "#dc2626",
              letterSpacing: "0.14em",
              textAlign: "center",
            }}
          >
            Tus fotos, sin rebuscar
          </p>
          <h2
            id="photos-title"
            className="text-3xl md:text-4xl font-bold"
            style={{
              fontFamily: "var(--font-display, 'Sora', system-ui)",
              color: "#0a0a0a",
              letterSpacing: "-0.015em",
              lineHeight: 1.12,
              textAlign: "center",
            }}
          >
            Te avisamos cuando publican fotos y te encontramos con un selfie.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto px-4">
          {/* Card 1 — Te avisamos */}
          <article
            className="flex flex-col gap-3"
            style={{
              background: "#f5f5f4",
              borderRadius: "24px",
              padding: "24px",
            }}
          >
            <div
              aria-hidden="true"
              className="flex items-center justify-center"
              style={{
                width: 40,
                height: 40,
                borderRadius: "10px",
                background: "#dc2626",
                color: "#fff",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </div>
            <h3
              style={{
                fontFamily: "var(--font-display, 'Sora', system-ui)",
                fontWeight: 700,
                fontSize: "1.125rem",
                color: "#0a0a0a",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Te avisamos
            </h3>
            <p
              style={{
                fontSize: "0.875rem",
                lineHeight: 1.55,
                color: "#1f1f1f",
                margin: 0,
              }}
            >
              Cuando la organización publica las fotos, te llega un email.
              Nada de volver a la web del organizador cada día a comprobar.
            </p>
          </article>

          {/* Card 2 — Te encontramos */}
          <article
            className="flex flex-col gap-3"
            style={{
              background: "#f5f5f4",
              borderRadius: "24px",
              padding: "24px",
            }}
          >
            <div
              aria-hidden="true"
              className="flex items-center justify-center"
              style={{
                width: 40,
                height: 40,
                borderRadius: "10px",
                background: "#dc2626",
                color: "#fff",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <h3
              style={{
                fontFamily: "var(--font-display, 'Sora', system-ui)",
                fontWeight: 700,
                fontSize: "1.125rem",
                color: "#0a0a0a",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Te encontramos
            </h3>
            <p
              style={{
                fontSize: "0.875rem",
                lineHeight: 1.55,
                color: "#1f1f1f",
                margin: 0,
              }}
            >
              Sube una selfie y te buscamos con IA entre las fotos
              (cara + dorsal). Te aparecen las coincidencias para que elijas.
            </p>
          </article>
        </div>

        {/* Disclaimer honesto */}
        <p
          className="text-center mt-8 mx-auto"
          style={{
            fontSize: "0.75rem",
            color: "#525252",
            maxWidth: "600px",
          }}
        >
          Disponible en carreras con fotos públicas. Requiere plan Pro.
        </p>
      </div>
    </section>
  );
}