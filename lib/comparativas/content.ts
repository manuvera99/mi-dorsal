// =============================================================================
// lib/comparativas/content.ts — Contenido de las 4 comparativas SEO estáticas.
// =============================================================================

import type { GuiaFAQ, GuiaSection } from "@/lib/guias/content";

export interface Comparativa {
  slug: string;
  title: string;
  metaDescription: string;
  keywords: string[];
  intro: string;
  sections: GuiaSection[];
  faq: GuiaFAQ[];
  ctaTitle: string;
  ctaDescription: string;
  ctaPrimaryHref: string;
  ctaPrimaryLabel: string;
  ctaSecondaryHref: string;
  ctaSecondaryLabel: string;
}

export const COMPARATIVAS: Comparativa[] = [
  // ===========================================================================
  // 1. MI-DORSAL VS WALLAPOP
  // ===========================================================================
  {
    slug: "mi-dorsal-vs-wallapop",
    title: "mi-dorsal vs Wallapop: dónde vender un dorsal",
    metaDescription:
      "Comparativa detallada: mi-dorsal.es vs Wallapop para vender dorsales. Comisiones, seguridad, tiempo de venta y perfil del comprador.",
    keywords: [
      "mi-dorsal vs wallapop",
      "wallapop dorsales",
      "dónde vender dorsal",
      "alternativa wallapop dorsales",
    ],
    intro:
      "Wallapop es el marketplace generalista más usado en España. mi-dorsal.es es un marketplace especializado en dorsales. Esta comparativa cubre lo que importa a un corredor que quiere vender o comprar de forma segura.",
    sections: [
      {
        heading: "Resumen rápido",
        paragraphs: [
          "Wallapop: generalista, mucho tráfico, comisión 0 para vendedores. mi-dorsal.es: especializado, tráfico segmentado, comisión 0 para vendedores. En la práctica, mi-dorsal.es cierra la venta en 24–48 h para carreras grandes. Wallapop tarda más pero llega a más gente.",
        ],
      },
      {
        heading: "Diferencias clave",
        paragraphs: ["Lo que cambia entre vender en uno u otro."],
        bullets: [
          "Tiempo medio de venta: Wallapop 3–7 días, mi-dorsal 24–48 h para grandes.",
          "Perfil del comprador: Wallapop generalista (cualquiera), mi-dorsal corredor buscando dorsal específico.",
          "Seguridad: Wallapop tiene sistema de valoraciones, mi-dorsal mensajería interna sin compartir datos hasta cerrar.",
          "Comisión: 0 € en ambos.",
        ],
      },
      {
        heading: "Cuándo elegir Wallapop",
        paragraphs: [
          "Elige Wallapop si:",
        ],
        bullets: [
          "Quieres llegar a un público general (ej. dorsal para una prueba local que no sale en búsquedas especializadas).",
          "Te importa más el precio de venta que el tiempo.",
          "Ya tienes el sistema de valoraciones de Wallapop montado y te funciona.",
        ],
      },
      {
        heading: "Cuándo elegir mi-dorsal.es",
        paragraphs: [
          "Elige mi-dorsal.es si:",
        ],
        bullets: [
          "El dorsal es para una carrera popular grande (Valencia, Behobia, San Silvestre).",
          "Quieres cerrar en menos de 48 horas.",
          "No quieres compartir tu email ni teléfono hasta cerrar.",
        ],
      },
    ],
    faq: [
      {
        question: "¿Cuál es más seguro para vender?",
        answer:
          "mi-dorsal.es. Mensajería interna, perfiles verificados, sin compartir datos hasta cerrar.",
      },
      {
        question: "¿Puedo publicar en ambos a la vez?",
        answer:
          "Sí. Muchos vendedores publican en mi-dorsal y, si en 48 h no han cerrado, publican también en Wallapop.",
      },
      {
        question: "¿Cuál paga más comisión?",
        answer:
          "Ninguno cobra comisión al vendedor particular. Wallapop cobra al comprador gastos de envío en algunas modalidades.",
      },
    ],
    ctaTitle: "Publica gratis en mi-dorsal.es",
    ctaDescription:
      "Mensajería interna, perfiles verificados, cierre rápido. La opción más eficiente para corredores.",
    ctaPrimaryHref: "/publicar",
    ctaPrimaryLabel: "Vender dorsal",
    ctaSecondaryHref: "/carreras",
    ctaSecondaryLabel: "Buscar dorsales",
  },

  // ===========================================================================
  // 2. MI-DORSAL VS MILANUNCIOS
  // ===========================================================================
  {
    slug: "mi-dorsal-vs-milanuncios",
    title: "mi-dorsal vs Milanuncios: comparativa para corredores",
    metaDescription:
      "Milanuncios sigue siendo opción para muchos. Te contamos cuándo merece la pena y cuándo no, frente a un marketplace especializado.",
    keywords: [
      "mi-dorsal vs milanuncios",
      "milanuncios dorsales",
      "dónde vender dorsal",
    ],
    intro:
      "Milanuncios es el veterano de los marketplaces generalistas en España. Sigue activo y con usuarios fieles. ¿Cuándo merece la pena frente a un marketplace especializado?",
    sections: [
      {
        heading: "Milanuncios: el veterano",
        paragraphs: [
          "Milanuncios lleva 20+ años activo y tiene usuarios que ya saben cómo usarlo. La interfaz es menos pulida que Wallapop, pero la barrera de entrada es baja.",
        ],
      },
      {
        heading: "Diferencias prácticas",
        bullets: [
          "Tráfico: menor que Wallapop, pero todavía significativo.",
          "Seguridad: media-baja. Menos moderación que Wallapop.",
          "Tiempo medio de venta: 5–10 días.",
          "Comisión: gratis.",
        ],
      },
      {
        heading: "Cuándo elegir Milanuncios",
        bullets: [
          "Tu público objetivo no es corredor activo (ej. familiar que no usa apps modernas).",
          "El dorsal es para una prueba local con poca demanda.",
          "Ya tienes cuenta y reputación ahí.",
        ],
      },
    ],
    faq: [
      {
        question: "¿Merece la pena Milanuncios en 2026?",
        answer:
          "Para dorsales, es secundario. Úsalo si ya tienes cuenta y no quieres abrir otra en un marketplace nuevo.",
      },
    ],
    ctaTitle: "Prueba mi-dorsal gratis",
    ctaDescription:
      "Publica tu dorsal en 3 minutos. Mensajería interna, sin comisión.",
    ctaPrimaryHref: "/publicar",
    ctaPrimaryLabel: "Publicar",
    ctaSecondaryHref: "/carreras",
    ctaSecondaryLabel: "Buscar dorsales",
  },

  // ===========================================================================
  // 3. DÓNDE VENDER DORSAL MARATÓN
  // ===========================================================================
  {
    slug: "donde-vender-dorsal-maraton",
    title: "Dónde vender un dorsal de maratón: las 4 mejores opciones",
    metaDescription:
      "Valencia, Madrid, Sevilla, Barcelona: comparativa de canales según el tipo de maratón y la urgencia con la que necesites vender.",
    keywords: [
      "vender dorsal maratón",
      "dónde vender dorsal maratón",
      "dorsal marathon valencia madrid sevilla barcelona",
    ],
    intro:
      "Los dorsales de maratón son los más fáciles de. (o más rápidos) porque tienen más demanda. Aquí los 4 canales que mejor funcionan, ordenados por velocidad y seguridad.",
    sections: [
      {
        heading: "Opción 1 — mi-dorsal.es",
        paragraphs: [
          "La más rápida para carreras grandes. Cierre en 24–48 h. Segmentación total: comprador está buscando dorsal de maratón, no 'lo que sea'.",
        ],
      },
      {
        heading: "Opción 2 — Grupos de Facebook de running",
        paragraphs: [
          "Hay grupos muy activos (>50k miembros) donde corredores venden dorsales. Muy rápido si publicas con buena foto y precio competitivo.",
        ],
      },
      {
        heading: "Opción 3 — Wallapop",
        paragraphs: [
          "Llega a más gente, pero tarda más. Útil para dorsales de maratones locales (no grandes nacionales).",
        ],
      },
      {
        heading: "Opción 4 — Contacto directo con el organizador",
        paragraphs: [
          "Algunas grandes (Valencia, Madrid) tienen bolsa de dorsales para corredores lesionados. Es gratuito, pero solo se aplica si hay lesionados.",
        ],
      },
    ],
    faq: [
      {
        question: "¿Cuánto se puede recuperar de un dorsal de maratón?",
        answer:
          "Entre 50–80 % del precio original si vendes con 1–2 semanas de antelación. Si faltan menos de 7 días, 30–60 %.",
      },
      {
        question: "¿Es legal vender un dorsal de maratón?",
        answer:
          "Sí, si el organizador lo permite. Verifica el reglamento antes de publicar.",
      },
    ],
    ctaTitle: "Publica tu dorsal de maratón",
    ctaDescription:
      "3 minutos gratis, sin comisión. Mensajería interna y perfiles verificados.",
    ctaPrimaryHref: "/publicar",
    ctaPrimaryLabel: "Publicar",
    ctaSecondaryHref: "/guias/es-legal-vender-dorsal",
    ctaSecondaryLabel: "¿Es legal?",
  },

  // ===========================================================================
  // 4. MI-DORSAL VS GRUPOS DE FACEBOOK
  // ===========================================================================
  {
    slug: "mi-dorsal-vs-grupos-facebook",
    title: "mi-dorsal vs grupos de Facebook de running",
    metaDescription:
      "Los grupos de Facebook siguen siendo muy activos para corredores. Comparamos pros y contras reales con un marketplace especializado.",
    keywords: [
      "mi-dorsal vs facebook",
      "grupos facebook dorsales",
      "vender dorsal facebook",
    ],
    intro:
      "Hay grupos de Facebook con 50k–100k miembros centrados en vender. y comprar dorsales en España. ¿Cuándo merece la pena frente a un marketplace especializado?",
    sections: [
      {
        heading: "Los grupos: gratis, rápido, pero manual",
        paragraphs: [
          "Los grupos activos ('Venta de dorsales', 'Running España', 'Corredores populares') tienen flujo constante. Publicar es gratis y llega a público segmentado.",
        ],
      },
      {
        heading: "Diferencias con un marketplace especializado",
        bullets: [
          "Gestión: en el grupo gestionas tú todo (responder, filtrar trolls, evitar timos). En marketplace hay moderación.",
          "Seguridad: en el grupo compartes WhatsApp o email desde el primer mensaje. En marketplace, mensajería interna hasta cerrar.",
          "Visibilidad: el grupo tiene audiencia fija. el marketplace escala con SEO.",
        ],
      },
      {
        heading: "Cuándo elegir cada uno",
        bullets: [
          "Grupo: dorsal de carrera popular grande (Valencia, Behobia), quieres cerrar en 1–3 días.",
          "Marketplace: dorsal de cualquier carrera, quieres cerrar en 24 h, valoras la mensajería interna.",
        ],
      },
    ],
    faq: [
      {
        question: "¿Qué grupos son los mejores?",
        answer:
          "Busca 'vender dorsal', 'venta dorsales', 'carreras populares España'. Cada región tiene grupos propios.",
      },
    ],
    ctaTitle: "Publica en mi-dorsal y cierra más rápido",
    ctaDescription:
      "Marketplace con tráfico segmentado. Publicar es gratis.",
    ctaPrimaryHref: "/publicar",
    ctaPrimaryLabel: "Publicar",
    ctaSecondaryHref: "/carreras",
    ctaSecondaryLabel: "Buscar dorsales",
  },
];