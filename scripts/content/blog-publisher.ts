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
  error?: string;
};

/**
 * Parsea el frontmatter YAML de un markdown. Soporta solo el subset que
 * necesitamos (no usa librería externa para evitar dependencias).
 */
export function parseFrontmatter(md: string): { frontmatter: PostFrontmatter; content: string } {
  const match = md.match(/^---\s*\n([\s\S]+?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    throw new Error(
      "No se encontró frontmatter. Empieza el archivo con:\n---\ntitle: ...\n---\n\nContenido…",
    );
  }
  const [, fmRaw, content] = match;

  // Parser YAML minimalista: solo soporta clave: valor, clave: [a, b], clave: true
  const frontmatter: any = {};
  const lines = fmRaw.split("\n");
  for (const line of lines) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value: any = m[2].trim();

    // Quitar comillas
    if (typeof value === "string" && /^["'].*["']$/.test(value)) {
      value = value.slice(1, -1);
    }

    // Boolean
    if (value === "true") value = true;
    else if (value === "false") value = false;
    // Array
    else if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((v: string) => v.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }

    frontmatter[key] = value;
  }

  return { frontmatter: frontmatter as PostFrontmatter, content: content.trim() };
}

/**
 * Sube un post a Convex. Si `publish` está en true, lo publica
 * inmediatamente.
 */
export async function publishPost(
  client: ConvexHttpClient,
  fm: PostFrontmatter,
  content: string,
  baseUrl: string = "https://www.mi-dorsal.com",
): Promise<PublishResult> {
  try {
    // 1. Crear el post (queda como draft por defecto)
    const postId = await client.mutation(api.blog.create, {
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
    });

    // 2. Si marked featured, destacarlo
    if (fm.featured) {
      await client.mutation(api.blog.toggleFeatured, { id: postId, value: true });
    }

    // 3. Si marked publish, publicarlo
    if (fm.publish) {
      await client.mutation(api.blog.publish, { id: postId });
    }

    // 4. Recoger el slug final
    const post = await client.query(api.blog.adminGet, { id: postId });

    return {
      ok: true,
      postId,
      slug: post?.slug,
      url: `${baseUrl}/blog/${post?.slug}`,
      published: !!fm.publish,
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
    return { ok: true, slug: frontmatter.slug, published: !!frontmatter.publish };
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return { ok: false, error: "NEXT_PUBLIC_CONVEX_URL no está definido" };
  }
  const client = new ConvexHttpClient(convexUrl);
  return await publishPost(client, frontmatter, content, options.baseUrl);
}
