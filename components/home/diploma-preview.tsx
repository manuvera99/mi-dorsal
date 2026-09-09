/**
 * DiplomaAndSharePreview — la sección estrella "lo que llega cuando cruzas la meta".
 *
 * Muestra los DOS entregables que el usuario recibe al publicarse los resultados
 * oficiales de su carrera, visualizados lado a lado en desktop:
 *
 *   IZQUIERDA — Diploma PDF A4 (ya existía, replica visual de convex/pdf/diploma.tsx)
 *               Para imprimir, enmarcar, llevar a la oficina o regalar.
 *
 *   DERECHA  — Share card PNG 1200x630 (NUEVO, replica visual de
 *               lib/share-card/render.tsx)
 *               Lista para descargar y publicar en Instagram, WhatsApp,
 *               Strava o X. Es la misma imagen que va inline en el email
 *               de resultado y que sirve como og:image al compartir la
 *               URL pública del resultado.
 *
 * La sección es declarativa (no hace fetches ni genera imágenes en runtime
 * — solo muestra el mockup). Los activos reales se generan por el cron
 * `check-results` y se sirven desde:
 *   - /api/diploma/[myRaceId]     → PDF A4 imprimible
 *   - /api/result/[myRaceId]/share-card.png → PNG 1200x630 para RRSS
 *
 * Posición en la home: 4b (entre HowItWorks y WhatsHere) para que el
 * visitante, tras leer "recibe tu resultado oficial con diploma PDF",
 * vea inmediatamente QUÉ recibe.
 *
 * NO interactivo. Sirve para visualizar la promesa. Los CTAs llevan al
 * diploma-preview.html (A4 imprimible de muestra) y al generador real
 * explicado en /perfil.
 */

import Link from "next/link";
import { Award, Download, FileText, Share2, ImageDown, Mail } from "lucide-react";

export function DiplomaAndSharePreview() {
  return (
    <section
      className="py-10 md:py-14"
      aria-labelledby="diploma-title"
    >
      <div className="text-center mb-8 md:mb-10 max-w-3xl mx-auto">
        <p className="text-sm font-semibold text-runner-primary uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
          <Award className="h-4 w-4" aria-hidden="true" />
          Lo que llega cuando cruzas la meta
        </p>
        <h2
          id="diploma-title"
          className="text-3xl md:text-4xl font-bold text-runner-dark"
        >
          Tu diploma PDF + tu imagen para redes, en el buzón al día siguiente
        </h2>
        <p className="text-gray-600 mt-3 max-w-2xl mx-auto">
          Cuando la carrera publica clasificaciones, te llega un email con tu tiempo oficial,
          tu posición, comparativa con tu predicción, y <strong className="text-runner-dark">dos archivos adjuntos</strong>:
          el diploma para imprimir y la imagen lista para compartir en tu club o en redes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 max-w-6xl mx-auto px-2 md:px-0">
        {/* ============================================================ */}
        {/* IZQUIERDA — Diploma A4 imprimible                              */}
        {/* ============================================================ */}
        <article className="flex flex-col">
          <header className="flex items-center gap-2 mb-3 px-1">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-runner-primary text-white"
              aria-hidden="true"
            >
              <FileText className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-base md:text-lg font-bold text-runner-dark leading-tight">
                Diploma PDF A4
              </h3>
              <p className="text-xs text-gray-500">Para imprimir, enmarcar o regalar</p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-runner-warm text-runner-primary border border-runner-primary/30 px-2 py-0.5">
              <Download className="h-3 w-3" aria-hidden="true" />
              Adjunto en el email
            </span>
          </header>

          {/* Diploma card. Aspect ratio 297:210 (A4 landscape). */}
          <div
            className="relative w-full overflow-hidden rounded-2xl border border-gray-200 shadow-xl bg-runner-warm"
            style={{ aspectRatio: "297 / 210" }}
            role="img"
            aria-label="Diploma finisher de la Behobia-San Sebastián. Dorsal 2501, tiempo oficial 01:26:14, nuevo PR en 10K, posición 521 de 14.820"
          >
            {/* Doble marco decorativo rojo (mismo estilo que diploma-preview.html) */}
            <div
              aria-hidden="true"
              className="absolute inset-2 border-[1.5px] border-runner-primary rounded-sm"
            />
            <div
              aria-hidden="true"
              className="absolute inset-3.5 border-[0.5px] border-runner-primary/40 rounded-sm"
            />

            {/* Layout interno. En móvil, dorsal arriba + datos abajo. En md+, grid 2 cols. */}
            <div className="absolute inset-6 md:inset-10 grid grid-cols-1 md:grid-cols-[1.05fr_1fr] gap-3 md:gap-8">
              {/* === COL IZQUIERDA: DORSAL + carrera === */}
              <div className="flex flex-col items-center justify-center relative">
                {/* Badge "Nuevo PR" arriba a la derecha */}
                <div className="absolute -top-1 right-0 md:-top-2 md:-right-2">
                  <span className="inline-flex items-center gap-1 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-full bg-green-100 text-green-800 border-2 border-green-600 px-2 md:px-3 py-0.5 md:py-1">
                    🎉 Nuevo PR en 10K
                  </span>
                </div>

                {/* Dorsal card (rotado -3deg) */}
                <div
                  className="relative w-32 h-44 md:w-44 md:h-60 rounded-lg shadow-lg flex flex-col items-center justify-center text-white"
                  style={{
                    background:
                      "linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)",
                    transform: "rotate(-3deg)",
                    boxShadow:
                      "0 8px 24px rgba(220,38,38,.30), 0 2px 4px rgba(0,0,0,.08)",
                  }}
                >
                  <div
                    aria-hidden="true"
                    className="absolute top-2 left-3 w-1.5 h-1.5 rounded-full bg-white/70"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute top-2 right-3 w-1.5 h-1.5 rounded-full bg-white/70"
                  />
                  <p className="text-[9px] md:text-[11px] font-bold tracking-[3px] opacity-85 uppercase mb-1">
                    Dorsal
                  </p>
                  <p
                    className="font-mono text-4xl md:text-6xl font-extrabold tracking-tighter leading-none"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                  >
                    2501
                  </p>
                  <div
                    className="absolute -bottom-3 -right-3 bg-white text-runner-dark w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center font-mono font-extrabold text-xs md:text-base shadow"
                    style={{ transform: "rotate(6deg)" }}
                  >
                    10<span className="text-[9px] md:text-[11px] opacity-70 ml-0.5">K</span>
                  </div>
                </div>

                <div className="mt-8 md:mt-10 text-center max-w-[200px] md:max-w-[280px]">
                  <p className="text-xs md:text-base font-bold text-runner-dark leading-tight">
                    Behobia-San Sebastián
                  </p>
                  <p className="text-[10px] md:text-xs text-gray-500 tracking-[1.5px] uppercase mt-1">
                    12 nov 2026 · San Sebastián
                  </p>
                </div>
              </div>

              {/* === COL DERECHA: DATOS DEL CORREDOR === */}
              <div className="flex flex-col justify-center gap-2 md:gap-3">
                <p className="text-[9px] md:text-[11px] text-gray-500 tracking-[1px] uppercase">
                  Se otorga el diploma a
                </p>
                <p className="text-base md:text-2xl font-bold text-runner-dark leading-tight">
                  Juan Manuel Vera
                </p>

                <div className="mt-2 md:mt-3 px-3 md:px-5 py-2 md:py-4 bg-white border border-gray-200 rounded-lg flex items-center justify-between">
                  <span className="text-[9px] md:text-[10px] text-gray-500 tracking-[1.5px] uppercase">
                    Tiempo oficial
                  </span>
                  <span
                    className="font-mono text-2xl md:text-5xl font-extrabold text-green-700 tracking-tighter leading-none"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                  >
                    01:26:14
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 md:gap-3 mt-1 md:mt-2">
                  <div className="pb-1 md:pb-2 border-b border-dashed border-gray-300">
                    <p className="text-[9px] md:text-[10px] text-gray-500 tracking-[1.2px] uppercase">
                      Posición
                    </p>
                    <p
                      className="font-mono text-sm md:text-lg font-bold text-runner-dark mt-0.5"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      521{" "}
                      <span className="text-[10px] md:text-xs text-gray-500 font-medium">
                        / 14.820
                      </span>
                    </p>
                  </div>
                  <div className="pb-1 md:pb-2 border-b border-dashed border-gray-300">
                    <p className="text-[9px] md:text-[10px] text-gray-500 tracking-[1.2px] uppercase">
                      Pace
                    </p>
                    <p
                      className="font-mono text-sm md:text-lg font-bold text-runner-dark mt-0.5"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      4:18{" "}
                      <span className="text-[10px] md:text-xs text-gray-500 font-medium">
                        /km
                      </span>
                    </p>
                  </div>
                  <div className="pb-1 md:pb-2 border-b border-dashed border-gray-300">
                    <p className="text-[9px] md:text-[10px] text-gray-500 tracking-[1.2px] uppercase">
                      Cat. M40
                    </p>
                    <p
                      className="font-mono text-sm md:text-lg font-bold text-runner-dark mt-0.5"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      97
                    </p>
                  </div>
                  <div className="pb-1 md:pb-2 border-b border-dashed border-gray-300">
                    <p className="text-[9px] md:text-[10px] text-gray-500 tracking-[1.2px] uppercase">
                      PR 10K
                    </p>
                    <p
                      className="font-mono text-sm md:text-lg font-bold text-runner-dark mt-0.5"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      00:43{" "}
                      <span className="text-[10px] md:text-xs text-gray-400 font-medium line-through ml-1">
                        00:48
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500 px-1">
            <p>
              <span className="font-mono font-semibold text-runner-dark">
                ID · MD-2501-20261112
              </span>
              <span className="hidden sm:inline"> · verificable en tu perfil</span>
            </p>
            <Link
              href="/diploma-preview.html"
              className="inline-flex items-center gap-1.5 text-runner-primary font-semibold hover:underline"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Ver plantilla A4
              <Download className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </article>

        {/* ============================================================ */}
        {/* DERECHA — Share card PNG 1200x630 para RRSS                    */}
        {/* ============================================================ */}
        <article className="flex flex-col">
          <header className="flex items-center gap-2 mb-3 px-1">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-runner-primary text-white"
              aria-hidden="true"
            >
              <Share2 className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-base md:text-lg font-bold text-runner-dark leading-tight">
                Imagen PNG para tus redes
              </h3>
              <p className="text-xs text-gray-500">Lista para Instagram, WhatsApp, Strava o X</p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-runner-warm text-runner-primary border border-runner-primary/30 px-2 py-0.5">
              <ImageDown className="h-3 w-3" aria-hidden="true" />
              Adjunta en el email
            </span>
          </header>

          {/* Share card mockup 1200x630 (aspect ratio aprox 1.905:1) */}
          <div
            className="relative w-full overflow-hidden rounded-2xl border border-gray-200 shadow-xl bg-runner-warm"
            style={{ aspectRatio: "1200 / 630" }}
            role="img"
            aria-label="Share card para redes sociales. Dorsal 2501, Behobia-San Sebastián 12 nov 2026, tiempo oficial 01:26:14, posición 521 de 14.820, pace 4:18 por kilómetro, badge Nuevo PR en 10K"
          >
            <div className="absolute inset-0 flex flex-row">
              {/* COL IZQ 40% — dorsal estilizado */}
              <div className="w-[40%] flex items-center justify-center bg-runner-warm p-3 md:p-5">
                <div
                  className="relative w-full max-w-[180px] md:max-w-[220px] aspect-[8/11] rounded-lg shadow-2xl flex flex-col items-center justify-center text-white"
                  style={{
                    background:
                      "linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)",
                    boxShadow:
                      "0 12px 32px rgba(220,38,38,.35), 0 2px 6px rgba(0,0,0,.10)",
                  }}
                >
                  <p className="text-[10px] md:text-xs font-bold tracking-[3px] opacity-85 uppercase mb-1">
                    Dorsal
                  </p>
                  <p
                    className="font-mono text-5xl md:text-7xl font-extrabold tracking-tighter leading-none"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                  >
                    2501
                  </p>
                  <div
                    className="absolute -bottom-3 -right-3 bg-white text-runner-dark w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center font-mono font-extrabold text-sm md:text-base shadow-lg border-2 border-runner-primary"
                    style={{ transform: "rotate(6deg)" }}
                  >
                    10<span className="text-[10px] opacity-70 ml-0.5">K</span>
                  </div>
                </div>
              </div>

              {/* COL DER 60% — datos */}
              <div className="w-[60%] flex flex-col p-3 md:p-5 bg-runner-warm">
                {/* Brand header */}
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 md:w-6 md:h-6 rounded bg-runner-primary flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <span
                        className="text-white text-[11px] md:text-xs font-bold leading-none"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                      >
                        m
                      </span>
                    </div>
                    <span
                      className="text-sm md:text-base font-bold text-runner-dark"
                      style={{ letterSpacing: "-0.3px" }}
                    >
                      mi-dorsal
                    </span>
                  </div>
                  <span className="text-[9px] md:text-[10px] text-gray-500 tracking-[1.5px] uppercase font-semibold">
                    Resultado oficial
                  </span>
                </div>

                {/* PR badge */}
                <div className="self-start mb-2 inline-flex items-center gap-1 bg-green-50 border-2 border-emerald-600 rounded-full px-2 py-0.5">
                  <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    🎉 Nuevo PR en 10K
                  </span>
                </div>

                {/* Race name */}
                <h4 className="text-sm md:text-lg font-bold text-runner-dark leading-tight mb-0.5 line-clamp-2">
                  Behobia-San Sebastián
                </h4>
                <p className="text-[10px] md:text-xs text-gray-500 mb-2 tracking-wider">
                  12 nov 2026
                </p>

                {/* TIME HERO */}
                <div
                  className="text-3xl md:text-5xl font-extrabold font-mono text-emerald-600 leading-none tracking-tighter"
                  style={{ fontFamily: "JetBrains Mono, monospace" }}
                >
                  01:26:14
                </div>
                <p className="text-[9px] md:text-[10px] text-gray-500 tracking-[2px] uppercase mt-1 mb-2 font-semibold">
                  Tu tiempo oficial
                </p>

                {/* Stats 3 col */}
                <div className="grid grid-cols-3 gap-1.5 md:gap-2 mb-auto">
                  <div className="bg-white border border-gray-200 rounded-md px-1.5 py-1.5 md:px-2 md:py-2">
                    <p className="text-[8px] md:text-[9px] text-gray-500 tracking-wider uppercase font-semibold leading-tight">
                      Pos. gral
                    </p>
                    <p
                      className="text-xs md:text-sm font-bold text-runner-dark font-mono leading-tight mt-0.5"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      521
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-md px-1.5 py-1.5 md:px-2 md:py-2">
                    <p className="text-[8px] md:text-[9px] text-gray-500 tracking-wider uppercase font-semibold leading-tight">
                      Pos. cat
                    </p>
                    <p
                      className="text-xs md:text-sm font-bold text-runner-dark font-mono leading-tight mt-0.5"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      97
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-md px-1.5 py-1.5 md:px-2 md:py-2">
                    <p className="text-[8px] md:text-[9px] text-gray-500 tracking-wider uppercase font-semibold leading-tight">
                      Pace
                    </p>
                    <p
                      className="text-xs md:text-sm font-bold text-runner-dark font-mono leading-tight mt-0.5"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      4:18<span className="text-[9px] text-gray-500 font-sans">/km</span>
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-200">
                  <p className="text-[9px] md:text-[10px] text-gray-500 italic">
                    El hilo que te une a tu dorsal
                  </p>
                  <p className="text-[9px] md:text-[10px] text-gray-400 font-mono">
                    mi-dorsal.com
                  </p>
                </div>
              </div>
            </div>

            {/* Esquina "PNG · 1200×630" para que se vea que es el formato de share image */}
            <div className="absolute top-2 right-2 bg-runner-dark/80 text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
              PNG · 1200×630
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500 px-1">
            <p className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-runner-primary" aria-hidden="true" />
              Llega adjunta en el email, lista para reenviar
            </p>
            <Link
              href="/diploma-preview.html?sample=share"
              className="inline-flex items-center gap-1.5 text-runner-primary font-semibold hover:underline"
            >
              <ImageDown className="h-3.5 w-3.5" aria-hidden="true" />
              Ver ejemplo PNG
            </Link>
          </div>
        </article>
      </div>

      {/* Línea final: cómo llega al usuario */}
      <div className="max-w-3xl mx-auto mt-8 md:mt-10 px-4">
        <div className="rounded-2xl bg-runner-warm border border-runner-primary/20 p-4 md:p-5 flex items-start gap-3">
          <span
            className="flex-shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-runner-primary text-white"
            aria-hidden="true"
          >
            <Mail className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm md:text-base text-runner-dark leading-relaxed">
              <strong>Cruzas la meta el domingo.</strong> Entre 12 y 48 horas después,
              según cuándo publique la organización, te llega un único email con tu
              tiempo, tu diploma PDF y tu imagen para redes. Sin volver a la web del
              organizador, sin buscar en PDFs indescifrables.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Mantener compatibilidad con cualquier import que esperase el nombre antiguo
// (mientras se hace la migración). Se puede borrar en la próxima limpieza.
export const DiplomaPreview = DiplomaAndSharePreview;
