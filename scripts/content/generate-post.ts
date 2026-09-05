// =============================================================================
// mi-dorsal — generate-post.ts (CLI)
// =============================================================================
// Genera el esqueleto de un post con frontmatter y estructura markdown con
// placeholders, para que Manu lo rellene. Si OPENAI_API_KEY está configurado,
// puede generar un primer borrador con LLM (opcional, requiere flag --llm).
//
// Uso:
//   npx tsx scripts/content/generate-post.ts historia "Mi primera Behobia"
//   npx tsx scripts/content/generate-post.ts guia "Cómo preparar una media maratón"
//   npx tsx scripts/content/generate-post.ts --llm curiosidades "Por qué el 10K es la distancia más democrática"
//
// Genera un .md en scripts/content/drafts/ con la fecha en el nombre.
// =============================================================================

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

type Category = "historias" | "guias" | "curiosidades" | "tendencias";
type CategoryOrAll = Category | "all";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function plantillaHistoria(topic: string, slug: string): string {
  return `---
title: "${topic}"
slug: "${slug}"
excerpt: "TODO: 1-2 frases que enganchen. Cuéntale al lector por qué debería leer esto en 30 segundos. Sin clickbait."
category: historias
tags: [tag1, tag2, tag3]
seoTitle: "TODO: título SEO ≤ 60 chars (si difiere del title)"
seoDescription: "TODO: descripción SEO ≤ 160 chars"
publish: false
---

# ${topic}

> Sugerencia: empieza con un momento concreto. Una imagen, una sensación, una frase. Lo abstracto viene después.

## El contexto

TODO: pon al lector en situación. ¿Dónde estábamos? ¿Quiénes éramos? ¿Qué hora era? Detalles sensoriales, no solo datos.

## Lo que pasó

TODO: cuenta la historia con ritmo. Alterna párrafos cortos (tensión, pausas) y largos (desarrollo, contexto).

### El km X

TODO: si la historia tiene un momento clave (un avituallamiento, un puerto, una meta), hazle su propia sección.

> Sugerencia: usa blockquotes para frases que quieres que el lector se lleve.

## Lo que aprendí

TODO: cierra con aprendizaje, no con moraleja. El lector ya sabe correr; tú sabes lo que se siente.

---

Tags internos (bórralos antes de publicar):
- relatedRaceSlugs: []   # ej. [mi-behobia-2026, san-silvestre-vallecana-2026]
- coverImageUrl: ""      # 1200x630 mínimo
- coverImageAlt: ""      # accesibilidad
`;
}

function plantillaGuia(topic: string, slug: string): string {
  return `---
title: "${topic}"
slug: "${slug}"
excerpt: "TODO: qué se va a llevar el lector de esta guía. Concreto y útil."
category: guias
tags: [tag1, tag2]
seoTitle: "TODO"
seoDescription: "TODO"
publish: false
---

# ${topic}

> Sugerencia: empieza con el QUÉ antes del CÓMO. Dile al lector qué va a conseguir en 3 frases.

## Para quién es esta guía

TODO: ¿es para primerizos? ¿para veteranos que quieren mejorar marca? ¿para una distancia concreta? Sé específico.

## Lo que necesitas saber antes

TODO: 2-3 requisitos mínimos. Si no los cumple, esta guía no es para él/ella.

- Requisito 1
- Requisito 2

## El plan: 4 semanas antes

### Semana 1

TODO: qué hacer, cuánto, cómo medir el progreso.

### Semana 2

TODO: …

### Semana 3

TODO: …

### Semana 4 (la semana de la carrera)

TODO: qué hacer, qué NO hacer, qué errores son normales.

## El día D

TODO: hora de dormir, qué desayunar, cuándo llegar, qué ponerse.

## Después

TODO: cómo recuperarse, cuándo volver a correr, qué apuntar en la app.

---

Tags internos:
- relatedRaceSlugs: []
- coverImageUrl: ""
- coverImageAlt: ""
`;
}

function plantillaCuriosidad(topic: string, slug: string): string {
  return `---
title: "${topic}"
slug: "${slug}"
excerpt: "TODO: el dato o la historia que engancha. Empieza por la sorpresa, no por el contexto."
category: curiosidades
tags: [tag1, tag2]
seoTitle: "TODO"
seoDescription: "TODO"
publish: false
---

# ${topic}

> Sugerencia: la primera frase tiene que ser la sorpresa. Si la quitas y la respuesta cambia, no es la buena.

## El dato

TODO: el número, la fecha, el récord, el detalle raro. Cita fuentes.

## El contexto

TODO: por qué este dato importa o qué tiene de raro. Compara con algo que el lector popular ya conozca.

## Lo que yo no sabía

TODO: tu opinión como corredor popular, qué te ha sorprendido. Sin postureo.

## Fuentes

TODO: lista las fuentes. Aunque sean dos líneas, que se vea que has mirado.

---

Tags internos:
- coverImageUrl: ""
- coverImageAlt: ""
`;
}

function plantillaTendencia(topic: string, slug: string): string {
  return `---
title: "${topic}"
slug: "${slug}"
excerpt: "TODO: qué está pasando y por qué. Sin postureo, sin afiliado."
category: tendencias
tags: [tag1, tag2]
seoTitle: "TODO"
seoDescription: "TODO"
publish: false
---

# ${topic}

> Sugerencia: este tipo de post tiene que ser 'con contexto'. No "las mejores X de 2026" (genérico). SÍ "qué buscar en X si corres Y en Z condiciones" (específico).

## Qué está pasando

TODO: el cambio o la novedad. 2-3 párrafos máximo.

## Por qué importa para el corredor popular

TODO: lo que de verdad afecta al corredor popular, no al elite. Cosas concretas:

- Coste
- Disponibilidad
- Curva de aprendizaje
- Cuándo se nota el cambio

## Mi prueba (si la he hecho)

TODO: cuenta tu propia experiencia. Sin afiliado, sin descuento. Si no la has hecho, dilo y cita 2-3 fuentes que sí.

## Lo que sigue

TODO: qué mirar en los próximos meses, qué evitar, qué merece la pena probar.

---

Tags internos:
- coverImageUrl: ""
- coverImageAlt: ""
`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Uso: npx tsx scripts/content/generate-post.ts <categoría> "<título>"

Categorías:
  historias       Reportajes, crónicas, Behobia, San Silvestre
  guias          Planes, preparación, qué llevar
  curiosidades   Datos, récords, historia del running
  tendencias     Lo que se mueve, con contexto

El archivo se crea en scripts/content/drafts/<fecha>-<slug>.md
`);
    process.exit(0);
  }

  const category = args[0] as Category;
  const title = args[1];
  if (!["historias", "guias", "curiosidades", "tendencias"].includes(category)) {
    console.error(`❌ Categoría inválida: ${category}`);
    process.exit(1);
  }

  const slug = slugify(title);
  const date = todayDate();
  const filename = `${date}-${slug}.md`;
  const dir = join(process.cwd(), "scripts", "content", "drafts");
  const filepath = join(dir, filename);

  let body: string;
  switch (category) {
    case "historias":
      body = plantillaHistoria(title, slug);
      break;
    case "guias":
      body = plantillaGuia(title, slug);
      break;
    case "curiosidades":
      body = plantillaCuriosidad(title, slug);
      break;
    case "tendencias":
      body = plantillaTendencia(title, slug);
      break;
  }

  await mkdir(dir, { recursive: true });
  await writeFile(filepath, body, "utf-8");

  console.log(`✅ Esqueleto creado: ${filepath}`);
  console.log(`\nPróximos pasos:`);
  console.log(`  1. Rellena los TODO del archivo`);
  console.log(`  2. Cuando esté listo: npx tsx scripts/content/publish-post.ts "${filepath}" --publish`);
  console.log(`     (sin --publish queda como borrador, lo publicas desde /admin/blog)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
