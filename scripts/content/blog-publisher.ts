// =============================================================================
// mi-dorsal — Blog publisher (script)
// =============================================================================
// Helper para subir un post markdown a Convex. Lo usan los scripts CLI
// (publish-post.ts) y se puede llamar desde código.
//
// Frontmatter esperado:
//   ---
//   title: "Mi primera Behobia"
//   slug: "mi-primera-behobia"     # opcional
//   excerpt: "Resumen de ~200 chars"
//   category: historias | guias | curiosidades | tendencias
//   tags: [behobia, 10k]
//   seoTitle: "..."                  # opcional
//   seoDescription: "..."            # opcional
//   publish: true                    # opcional, default false
//   featured: true                   # opcional, default false
//   ---
//
// El contenido empieza justo después del segundo `---`.
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { readFile } from "fs/promises";

export type PostFrontmatter = {
  title: string;
  slug?: string;
  excerpt: string;
  category: "historias" | "guias" | "curiosidades" | "tendencias";
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  publish?: boolean;
  featured?: boolean;
  coverImageUrl?: string;
  coverImageAlt?: string;
  relatedRaceSlugs?: string[];
};

export type PublishResult = {
  ok: boolean;
  postId?: string;
  slug?: string;
  url?: string;
  published?: boolean;
  unresolvedRaceSlugs?: string[];
  error?: string;
};

/**
 * Parsea el frontmatter YAML de un markdown. Soporta solo el subset que
 * necesitamos (no usa librería externa para evitar dependencias):
 *   - clave: valor
 *   - clave: "valor con comillas"
 *   - clave: true / false
 *   - clave: [a, b, c]              (array inline)
 *   - clave:\n  - a\n  - b\n  - c   (array en formato bloque, el que generan
 *                                    generate-post.ts y los agentes de contenido)
 */
export function parseFrontmatter(md: string): { frontmatter: PostFrontmatter; content: string } {
  const match = md.match(/^---\s*\n([\s\S]+?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    throw new Error(
      "No se encontró frontmatter. Empieza el archivo con:\n---\ntitle: ...\n---\n\nContenido…",
    );
  }
  const [, fmRaw, content] = match;

  const frontmatter: any = {};
  const lines = fmRaw.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1];
    let rawValue = m[2].trim();

    // Array en formato bloque: "clave:" (sin valor en la misma línea) seguido
    // de líneas "  - item". Ej. el relatedRaceSlugs de generate-post.ts.
    if (rawValue === "") {
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+(.*)$/.test(lines[j])) {
        const itemMatch = lines[j].match(/^\s*-\s+(.*)$/)!;
        items.push(itemMatch[1].trim().replace(/^["']|["']$/g, ""));
        j++;
      }
      if (items.length > 0) {
        frontmatter[key] = items;
        i = j;
        continue;
      }
      // "clave:" sin valor y sin lista debajo → string vacío, no undefined
      frontmatter[key] = "";
      i++;
      continue;
    }

    let value: any = rawValue;

    // Quitar comillas
    if (typeof value === "string" && /^["'].*["']$/.test(value)) {
      value = value.slice(1, -1);
    }

    // Boolean
    if (value === "true") value = true;
    else if (value === "false") value = false;
    // Array inline: clave: [a, b, c]
    else if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((v: string) => v.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }

    frontmatter[key] = value;
    i++;
  }

  return { frontmatter: frontmatter as PostFrontmatter, content: content.trim() };
}

/**
 * Sube un post a Convex vía `blog.systemCreate` (mutation auth-free para
 * scripts CLI — igual patrón que `races.systemCreate`). Las mutations
 * `blog.create` / `blog.publish` / `blog.toggleFeatured` / `blog.adminGet`
 * exigen `requireAdmin` (JWT de Clerk vía `ctx.auth.getUserIdentity()`), que
 * un `ConvexHttpClient` de script CLI no tiene forma de satisfacer — por
 * eso este script NUNCA debe llamarlas directamente.
 *
 * Resuelve `relatedRaceSlugs` a `relatedRaceIds` dentro de la mutation. Si
 * algún slug no existe en el catálogo, se reporta en `unresolvedRaceSlugs`
 * en vez de fallar — así el internal linking roto se ve, no se pierde en
 * silencio.
 */
export async function publishPost(
  client: ConvexHttpClient,
  fm: PostFrontmatter,
  content: string,
  baseUrl: string = "https://www.mi-dorsal.com",
): Promise<PublishResult> {
  try {
    const result = await client.mutation(api.blog.systemCreate, {
      title: fm.title,
      slug: fm.slug,
      excerpt: fm.excerpt,
      content,
      category: fm.category,
      tags: fm.tags,
      seoTitle: fm.seoTitle,
      seoDescription: fm.seoDescription,
      seoKeywords: fm.seoKeywords,
      coverImageUrl: fm.coverImageUrl,
      coverImageAlt: fm.coverImageAlt,
      relatedRaceSlugs: fm.relatedRaceSlugs,
      publish: fm.publish,
      featured: fm.featured,
    });

    return {
      ok: true,
      postId: result.postId,
      slug: result.slug,
      url: `${baseUrl}/blog/${result.slug}`,
      published: !!fm.publish,
      unresolvedRaceSlugs: result.unresolvedRaceSlugs,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/**
 * Lee un archivo markdown y lo sube a Convex.
 */
export async function publishFromFile(
  filePath: string,
  options: { baseUrl?: string; dryRun?: boolean } = {},
): Promise<PublishResult> {
  const md = await readFile(filePath, "utf-8");
  const { frontmatter, content } = parseFrontmatter(md);

  // Validación mínima
  const required: (keyof PostFrontmatter)[] = ["title", "excerpt", "category"];
  for (const k of required) {
    if (!frontmatter[k]) {
      return { ok: false, error: `Falta campo obligatorio en frontmatter: ${k}` };
    }
  }
  if (!["historias", "guias", "curiosidades", "tendencias"].includes(frontmatter.category)) {
    return { ok: false, error: `Categoría inválida: ${frontmatter.category}` };
  }
  if (content.length < 200) {
    return {
      ok: false,
      error: `Contenido muy corto (${content.length} chars). Mínimo recomendado: 600.`,
    };
  }

  if (options.dryRun) {
    console.log(`[blog-publisher] DRY-RUN: "${frontmatter.title}" (${content.length} chars)`);
    if (frontmatter.relatedRaceSlugs && frontmatter.relatedRaceSlugs.length > 0) {
      console.log(
        `[blog-publisher] DRY-RUN: ${frontmatter.relatedRaceSlugs.length} relatedRaceSlugs en frontmatter (no verificados contra el catálogo real en modo dry-run — se validan al publicar de verdad).`,
      );
    }
    return { ok: true, slug: frontmatter.slug, published: !!frontmatter.publish };
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return { ok: false, error: "NEXT_PUBLIC_CONVEX_URL no está definido" };
  }
  const client = new ConvexHttpClient(convexUrl);
  return await publishPost(client, frontmatter, content, options.baseUrl);
}
