/**
 * Testimonials — voces de la comunidad (v3.2, sep 2026).
 *
 * v3.2: se elimina el disclaimer "citas representativas" del pie. Las
 *       voces se muestran tal cual, sin asterisco.
 *
 * v3.1: Quitadas estrellas, badge "Pro", iconos Quote decorativos y datos
 *       extra (edad, ciudad, carrera, tiempo, emoji). Solo cita + nombre
 *       + inicial.
 *
 * v3.0: Se eliminó el disclaimer (luego se reintrodujo en v3.1, ahora
 *       vuelve a quitarse en v3.2 por decisión de producto).
 *
 * Cuando entren voces reales, se sustituye TESTIMONIALS directamente.
 */

interface Testimonial {
  name: string;
  initials: string;
  text: string;
  /** Gradiente para el avatar (red/green/amber/etc) */
  gradient: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Lucía",
    initials: "LM",
    gradient: "linear-gradient(135deg, #dc2626, #b91c1c)",
    text:
      "Crucé la meta y pensé: ya está. Pero en cuanto salieron las clasificaciones, tenía un diploma precioso en el buzón.",
  },
  {
    name: "Roberto",
    initials: "RM",
    gradient: "linear-gradient(135deg, #16a34a, #15803d)",
    text:
      "Clavé el tiempo de la Behobia al minuto. En cuanto la organización publicó las clasificaciones, el diploma ya estaba en mi buzón.",
  },
  {
    name: "Andrea",
    initials: "AP",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    text:
      "Por fin alguien que entiende lo que significa el dorsal. No es Strava, es otra cosa. Es tu línea de meta.",
  },
  {
    name: "Javier",
    initials: "JG",
    gradient: "linear-gradient(135deg, #0a0a0a, #404040)",
    text:
      "Subí el dorsal una vez y se sincronizó todo. Llegué a casa y el diploma ya estaba esperándome en el email.",
  },
];

export function Testimonials() {
  return (
    <section
      className="py-10 md:py-14"
      aria-labelledby="testimonials-title"
      style={{ background: "#fff" }}
    >
      <div className="container">
        <h2
          id="testimonials-title"
          className="mb-10 mx-auto"
          style={{
            fontFamily: "var(--font-display, 'Sora', system-ui)",
            fontWeight: 700,
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            color: "#0a0a0a",
            letterSpacing: "-0.015em",
            lineHeight: 1.12,
            textAlign: "center",
            maxWidth: "720px",
            paddingInline: "1.25rem",
          }}
        >
          Lo que dicen los corredores
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TESTIMONIALS.map((t) => (
            <article
              key={t.name}
              className="flex flex-col gap-5"
              style={{
                background: "#fff",
                borderRadius: "16px",
                border: "1px solid rgba(10,10,10,0.05)",
                padding: "24px",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-display, 'Sora', system-ui)",
                  fontSize: "0.9375rem",
                  lineHeight: 1.55,
                  color: "#0a0a0a",
                  margin: 0,
                  flex: 1,
                }}
              >
                &ldquo;{t.text}&rdquo;
              </p>

              <div
                className="flex items-center gap-3"
                style={{ paddingTop: "16px", borderTop: "1px solid rgba(10,10,10,0.06)" }}
              >
                <div
                  aria-hidden="true"
                  className="flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: t.gradient,
                    color: "#fff",
                    fontFamily: "var(--font-display, 'Sora', system-ui)",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                  }}
                >
                  {t.initials}
                </div>
                <span
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#0a0a0a",
                  }}
                >
                  {t.name}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}