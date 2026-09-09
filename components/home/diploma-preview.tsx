/**
 * DiplomaPreview — replica visual del diploma PDF en la home.
 *
 * El diploma real (PDF generado con @react-pdf/renderer) está en
 * convex/pdf/diploma.tsx + diploma-preview.html (preview no-prod).
 * Esta sección es la versión HTML/Tailwind del diploma, dimensionada
 * para que se vea completa en cualquier viewport:
 *   - desktop: tarjeta ancha 16:9 con dorsal grande + datos
 *   - móvil:  la misma composición apilada con dorsal más pequeño
 *
 * NO es interactivo (no genera PDF real, no se descarga). Sirve para
 * que el visitante vea QUÉ va a recibir cuando cruce la meta. El CTA
 * debajo ("Ver plantilla real") enlaza al diploma-preview.html para
 * que vea el diploma A4 con calidad de impresión.
 *
 * Para SEO: la sección lleva aria-label descriptivo y el nombre del
 * archivo diploma-preview.html se enlaza como recurso adicional.
 */

import Link from "next/link";
import { Award, Download, FileText } from "lucide-react";

export function DiplomaPreview() {
  return (
    <section
      className="py-8 md:py-12"
      aria-labelledby="diploma-title"
    >
      <div className="text-center mb-8 md:mb-10">
        <p className="text-sm font-semibold text-runner-primary uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
          <Award className="h-4 w-4" aria-hidden="true" />
          Lo que llega cuando cruzas la meta
        </p>
        <h2
          id="diploma-title"
          className="text-3xl md:text-4xl font-bold text-runner-dark"
        >
          Tu diploma PDF, en el buzón al día siguiente
        </h2>
        <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
          Cuando la carrera publica las clasificaciones, te llega un email
          con tu tiempo oficial, tu posición, comparativa con tu predicción y
          un diploma A4 listo para imprimir o compartir.
        </p>
      </div>

      {/* Diploma card. width total ~ max-w-4xl, aspect ratio 297:210 (A4 landscape). */}
      <div className="max-w-4xl mx-auto px-2 md:px-0">
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
                {/* Pinholes decorativos */}
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
                {/* Distance badge redondo abajo-derecha */}
                <div
                  className="absolute -bottom-3 -right-3 bg-white text-runner-dark w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center font-mono font-extrabold text-xs md:text-base shadow"
                  style={{ transform: "rotate(6deg)" }}
                >
                  10<span className="text-[9px] md:text-[11px] opacity-70 ml-0.5">K</span>
                </div>
              </div>

              {/* Carrera + fecha */}
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

              {/* Tiempo oficial card */}
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

              {/* Grid 2x2 de stats */}
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

        {/* Footer del diploma: ID verificable + CTA a preview */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>
            <span className="font-mono font-semibold text-runner-dark">
              ID · MD-2501-20261112
            </span>
            <span className="hidden sm:inline"> · verificable en mi-dorsal.vercel.app</span>
          </p>
          <Link
            href="/diploma-preview.html"
            className="inline-flex items-center gap-1.5 text-runner-primary font-semibold hover:underline"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            Ver plantilla A4 (imprimible)
            <Download className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
