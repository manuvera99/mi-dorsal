/**
 * DiplomaAndSharePreview — la sección estrella "lo que llega cuando cruzas la meta".
 *
 * Muestra DOS cosas relacionadas con el resultado oficial de una carrera,
 * visualizadas lado a lado en desktop:
 *
 *   IZQUIERDA — Diploma PDF A4 (replica visual de convex/pdf/diploma.tsx)
 *               Adjunto automático en el email de resultado. Para
 *               imprimir, enmarcar, llevar a la oficina o regalar.
 *
 *   DERECHA  — Sticker vertical personalizable (replica visual de
 *               lib/sticker-editor/StickerCanvas.tsx y su plantilla
 *               "classic" en lib/sticker-editor/templates.ts).
 *               A diferencia del diploma (fijo, automático), este es el
 *               reclamo de la feature premium /editor-sticker: el usuario
 *               mueve, redimensiona y elige qué datos mostrar, y lo
 *               exporta en PNG transparente o se lo manda por email.
 *
 * La sección es declarativa (no hace fetches ni genera imágenes en runtime
 * — solo muestra el mockup, ninguna de las dos mitades importa el
 * componente real). El diploma real se genera por el cron `check-results`
 * y se sirve desde /api/diploma/[myRaceId]; el sticker real se edita en
 * /editor-sticker/{myRaceId} (ver app/editor-sticker/[myRaceId]/client.tsx)
 * y se exporta client-side con html-to-image (lib/sticker-editor/export.ts).
 *
 * Posición en la home: 4b (entre HowItWorks y WhatsHere) para que el
 * visitante, tras leer "recibe tu resultado oficial con diploma PDF",
 * vea inmediatamente QUÉ recibe. Justo después va la sección 4d
 * (components/home/sticker-editor-teaser.tsx), que retoma este mismo
 * sticker para explicar la feature premium con más detalle y su CTA.
 *
 * NO interactivo. Sirve para visualizar la promesa. El CTA del diploma
 * lleva a diploma-preview.html (A4 imprimible de muestra); el del sticker
 * lleva a /premium (el editor real requiere una carrera concreta, que no
 * existe en el contexto de un visitante anónimo en la home).
 */

import Link from "next/link";
import { Award, Download, FileText, Sparkles, Mail } from "lucide-react";

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
        {/* DERECHA — Sticker vertical personalizable (editor Pro)         */}
        {/* Mockup Tailwind (mismo patrón que el diploma de la izquierda,  */}
        {/* no importa StickerCanvas real — ver cabecera del archivo).    */}
        {/* Colores y layout replican lib/sticker-editor/StickerCanvas.tsx */}
        {/* y la plantilla "classic" de lib/sticker-editor/templates.ts:   */}
        {/* badge PR arriba, tiempo hero, fila pace+distancia debajo.      */}
        {/* ============================================================ */}
        <article className="flex flex-col">
          <header className="flex items-center gap-2 mb-3 px-1">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-runner-primary text-white"
              aria-hidden="true"
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-base md:text-lg font-bold text-runner-dark leading-tight">
                Tu sticker, a tu gusto
              </h3>
              <p className="text-xs text-gray-500">Mueve, redimensiona y elige qué mostrar</p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Editor Pro
            </span>
          </header>

          {/* Sticker mockup vertical 1080x1920 (aspect ratio 9:16), con
              checkerboard sutil de fondo igual que el editor real
              (transparencia = el sticker se exporta sin fondo). */}
          <div
            className="relative w-full max-w-[280px] mx-auto overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
            style={{
              aspectRatio: "1080 / 1920",
              backgroundImage:
                "repeating-conic-gradient(#e5e5e5 0% 25%, #f5f5f5 0% 50%)",
              backgroundSize: "16px 16px",
            }}
            role="img"
            aria-label="Sticker personalizable con badge Nuevo PR, tiempo oficial 01:26:14, pace 4:18 por kilómetro y distancia 10 kilómetros, listo para exportar en PNG transparente"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 md:gap-4 px-4">
              {/* Badge PR */}
              <div className="inline-flex items-center rounded-full bg-green-100 px-3 py-1">
                <span className="text-[10px] md:text-xs font-bold text-green-700 tracking-wide">
                  🎉 Nuevo PR
                </span>
              </div>

              {/* Panel tiempo hero */}
              <div className="flex flex-col items-center rounded-2xl bg-white/90 px-4 py-3 md:px-5 md:py-4">
                <p className="text-[8px] md:text-[9px] font-bold uppercase tracking-[2px] text-stone-500 mb-1">
                  Tu tiempo oficial
                </p>
                <p
                  className="text-2xl md:text-3xl font-bold leading-none text-green-600"
                  style={{ fontFamily: "JetBrains Mono, monospace" }}
                >
                  01:26:14
                </p>
              </div>

              {/* Fila pace + distancia */}
              <div className="flex gap-2 md:gap-3">
                <div className="flex flex-col items-center rounded-2xl bg-white/90 px-3 py-2 md:px-4 md:py-2.5">
                  <p className="text-[7px] md:text-[8px] font-bold uppercase tracking-[2px] text-stone-500 mb-0.5">
                    Pace
                  </p>
                  <p
                    className="text-sm md:text-base font-bold text-stone-800"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                  >
                    4:18 /km
                  </p>
                </div>
                <div className="flex flex-col items-center rounded-2xl bg-white/90 px-3 py-2 md:px-4 md:py-2.5">
                  <p className="text-[7px] md:text-[8px] font-bold uppercase tracking-[2px] text-stone-500 mb-0.5">
                    Distancia
                  </p>
                  <p
                    className="text-sm md:text-base font-bold text-stone-800"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                  >
                    10,000km
                  </p>
                </div>
              </div>
            </div>

            {/* Logo mi-dorsal anclado hacia el final, igual que el real */}
            <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-1.5">
              <div className="w-5 h-5 rounded bg-runner-primary flex items-center justify-center">
                <span
                  className="text-white text-[10px] font-bold leading-none"
                  style={{ fontFamily: "JetBrains Mono, monospace" }}
                >
                  m
                </span>
              </div>
              <span className="text-xs font-bold text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,.5)" }}>
                mi-dorsal
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500 px-1">
            <p className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-runner-primary" aria-hidden="true" />
              Descarga en PNG o mándatelo por email
            </p>
            <Link
              href="/premium"
              className="inline-flex items-center gap-1.5 text-runner-primary font-semibold hover:underline"
            >
              Personalizar el mío
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
