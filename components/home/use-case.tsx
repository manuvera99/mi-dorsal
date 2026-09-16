/**
 * UseCase — solo quote + autor (v3.1, sep 2026).
 *
 * Cambio respecto a v3.0: se eliminan los 4 momentos con timeline vertical
 * y los 2 mockups de email. Solo queda una cita editorial centrada con
 * nombre y carrera. Sin emojis decorativos, sin mockups.
 *
 * Copy alineado con brand-guide §2 (tuteo, honestidad) y la promesa "en
 * cuanto publican clasificaciones" sin sugerir un tiempo concreto.
 */

export function UseCase() {
  return (
    <section
      className="py-10 md:py-14 text-center"
      aria-labelledby="usecase-title"
      style={{
        background:
          "radial-gradient(800px 400px at 50% 50%, rgba(245, 158, 11, 0.06), transparent 60%), #f5f5f4",
      }}
    >
      <div className="max-w-3xl mx-auto px-5">
        <h2
          id="usecase-title"
          className="mb-8"
          style={{
            fontFamily: "var(--font-display, 'Sora', system-ui)",
            fontWeight: 600,
            fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)",
            lineHeight: 1.2,
            letterSpacing: "-0.015em",
            color: "#0a0a0a",
            margin: 0,
          }}
        >
          &ldquo;Crucé la meta y, en cuanto la organización publicó las
          clasificaciones, tenía mi diploma en el buzón.&rdquo;
        </h2>

        <div
          className="inline-flex items-center gap-3"
          style={{ color: "#525252", fontSize: "0.875rem" }}
        >
          <span
            aria-hidden="true"
            className="flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#f5f5f4",
              color: "#0a0a0a",
              fontFamily: "var(--font-display, 'Sora', system-ui)",
              fontWeight: 700,
              fontSize: "0.75rem",
            }}
          >
            CV
          </span>
          <span>Carlos · Behobia 2026</span>
        </div>
      </div>
    </section>
  );
}