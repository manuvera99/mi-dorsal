// =============================================================================
// mi-dorsal — publish-post.ts (CLI)
// =============================================================================
// Sube un archivo markdown a Convex. Frontmatter YAML arriba, contenido
// markdown abajo. Ejemplo:
//
//   npx tsx scripts/content/publish-post.ts scripts/content/drafts/mi-post.md
//   npx tsx scripts/content/publish-post.ts scripts/content/drafts/mi-post.md --publish
//   npx tsx scripts/content/publish-post.ts scripts/content/drafts/mi-post.md --dry-run
// =============================================================================

import { publishFromFile } from "./blog-publisher";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Uso: npx tsx scripts/content/publish-post.ts <archivo.md> [opciones]

Opciones:
  --publish          Publica inmediatamente (si no, queda como borrador)
  --dry-run          Solo valida y muestra el resultado, no sube nada
  --base-url=<url>   Override de NEXT_PUBLIC_APP_URL (default: leer de env)
  --help, -h         Muestra esta ayuda

Frontmatter YAML esperado (mínimo):
  ---
  title: "Título del post"
  excerpt: "Resumen de ~200 chars"
  category: historias | guias | curiosidades | tendencias
  publish: true                # opcional
  ---

El contenido empieza justo después del segundo \`---\`.
`);
    process.exit(0);
  }

  const filePath = args[0];
  const publish = args.includes("--publish");
  const dryRun = args.includes("--dry-run");
  const baseUrlArg = args.find((a) => a.startsWith("--base-url="));
  const baseUrl = baseUrlArg?.split("=")[1];

  // Si --publish está en el frontmatter del archivo, lo respetamos.
  // El flag CLI --publish fuerza publicar incluso si el frontmatter dice false.
  console.log(`[publish-post] Procesando ${filePath}…`);
  const result = await publishFromFile(filePath, { dryRun, baseUrl, publish });

  if (result.ok) {
    console.log(`✅ Post procesado correctamente`);
    if (result.slug) console.log(`   Slug: ${result.slug}`);
    if (result.url) console.log(`   URL: ${result.url}`);
    if (result.postId) console.log(`   ID: ${result.postId}`);
    if (dryRun) console.log(`   (DRY-RUN: no se subió a Convex)`);
    if (result.unresolvedRaceSlugs && result.unresolvedRaceSlugs.length > 0) {
      console.warn(
        `⚠️  ${result.unresolvedRaceSlugs.length} slug(s) de relatedRaceSlugs no existen en el catálogo y se han ignorado:`,
      );
      for (const s of result.unresolvedRaceSlugs) console.warn(`   - ${s}`);
      console.warn(`   El internal linking a esas carreras NO se ha guardado. Revisa el slug o quítalo del frontmatter.`);
    }
  } else {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
