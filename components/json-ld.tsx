/**
 * Helper para inyectar JSON-LD en cualquier página.
 * Google usa esto para rich results (Eventos, Organización, Breadcrumbs, etc).
 *
 * Uso:
 *   <JsonLd data={mySchema} />
 */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data, jsonLdReplacer),
      }}
    />
  );
}

// Limpia valores undefined que rompen el JSON.stringify por defecto
function jsonLdReplacer(_key: string, value: unknown) {
  if (value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  return value;
}

// =============================================================================
// Schemas reutilizables
// =============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

/**
 * Organization — Google Knowledge Graph.
 * Sale en la home y da identidad al sitio (logo, redes, contacto).
 */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE_URL}/#organization`,
    name: "mi-dorsal",
    url: BASE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${BASE_URL}/icon.svg`,
      width: 64,
      height: 64,
    },
    description:
      "Planificador personal de carreras con tracking automático de dorsales. Catálogo, ranking, calendario y resultados de carreras populares en toda España.",
    foundingDate: "2026",
    sameAs: [
      // Añadir cuando existan
      // "https://twitter.com/midorsal",
      // "https://instagram.com/midorsal",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "hola@mi-dorsal.es",
      availableLanguage: ["Spanish"],
    },
  };
}

/**
 * WebSite con SearchAction — Google lo usa para el "sitelinks searchbox".
 * Cuando alguien busca en Google "mi-dorsal carreras Alicante", puede salir
 * un cuadro de búsqueda directa.
 */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
    url: BASE_URL,
    name: "mi-dorsal",
    description:
      "Planifica tu temporada de carreras, predice tu tiempo en cada una, y recibe tu resultado oficial por email.",
    inLanguage: "es-ES",
    publisher: { "@id": `${BASE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/carreras?q={search_term_string}`,
      },
      // Query input que envía Google al searchbox
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * BreadcrumbList — aparece bajo el título de cada página en Google.
 */
export function breadcrumbJsonLd(
  items: Array<{ name: string; url: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}

/**
 * FAQPage schema — Google muestra las preguntas frecuentes directamente
 * bajo el resultado de búsqueda (rich results). Esto sube CTR brutal.
 *
 * Recibe un array de { question, answer } y devuelve el schema correcto.
 */
export function faqJsonLd(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/**
 * Event schema para una carrera.
 * Esto hace que la carrera pueda aparecer en Google Eventos, Google Maps,
 * y paneles de conocimiento de Google.
 */
export function raceEventJsonLd(race: {
  name: string;
  slug: string;
  description?: string;
  startDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endDate?: string;
  locality?: string;
  province?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  elevationGainM?: number;
  raceType?: string;
  organizer?: string;
  officialUrl?: string;
  imageUrl?: string;
  priceEur?: number;
  priceCurrency?: string;
  maxParticipants?: number;
  registrationUrl?: string;
  registrationOpenDate?: string;
  raceFormats?: Array<{ name: string; startTime?: string; priceEur?: number }>;
}) {
  if (!race.startDate) return null;

  const startDateTime = race.startTime
    ? `${race.startDate}T${race.startTime}:00`
    : `${race.startDate}T09:00:00`;

  const eventSchema: any = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "@id": `${BASE_URL}/carreras/${race.slug}#event`,
    name: race.name,
    url: `${BASE_URL}/carreras/${race.slug}`,
    startDate: startDateTime,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    sport:
      race.raceType === "trail"
        ? "TrailRunning"
        : race.raceType === "road"
        ? "Running"
        : race.raceType === "obstacle"
        ? "ObstacleCourseRacing"
        : "Athletics",
    inLanguage: "es-ES",
    description: race.description,
    image: race.imageUrl || `${BASE_URL}/og-image`,
  };

  // Location (con o sin coordenadas)
  if (race.address || race.locality) {
    eventSchema.location = {
      "@type": "Place",
      name: race.address || race.locality,
      address: {
        "@type": "PostalAddress",
        addressLocality: race.locality,
        addressRegion: race.province,
        addressCountry: "ES",
        streetAddress: race.address,
      },
      ...(race.latitude &&
        race.longitude && {
          geo: {
            "@type": "GeoCoordinates",
            latitude: race.latitude,
            longitude: race.longitude,
          },
        }),
    };
  }

  // Organizer
  if (race.organizer) {
    eventSchema.organizer = {
      "@type": "Organization",
      name: race.organizer,
      url: race.officialUrl,
    };
  }

  // Offers (precio de inscripción)
  if (race.priceEur) {
    eventSchema.offers = {
      "@type": "Offer",
      url: race.registrationUrl || race.officialUrl || `${BASE_URL}/carreras/${race.slug}`,
      price: race.priceEur,
      priceCurrency: race.priceCurrency || "EUR",
      availability: race.registrationUrl
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
      validFrom: race.registrationOpenDate,
    };
  }

  // Sub-eventos (modalidades alternativas: 5K + 10K + 21K)
  if (race.raceFormats && Array.isArray(race.raceFormats) && race.raceFormats.length > 0) {
    eventSchema.subEvent = (race.raceFormats as any[]).map((fmt: any) => ({
      "@type": "SportsEvent",
      name: `${race.name} — ${fmt.name}`,
      startDate: fmt.startTime
        ? `${race.startDate}T${fmt.startTime}:00`
        : startDateTime,
      sport: eventSchema.sport,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      ...(fmt.priceEur && {
        offers: {
          "@type": "Offer",
          price: fmt.priceEur,
          priceCurrency: "EUR",
          url: race.registrationUrl || `${BASE_URL}/carreras/${race.slug}`,
        },
      }),
    }));
  }

  return eventSchema;
}
