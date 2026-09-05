// =============================================================================
// mi-dorsal — /blog/[slug] (post individual)
// =============================================================================
// Server Component: resuelve el slug, valida que esté publicado, genera
// metadata dinámica (title, description, OG, Schema.org Article) y
// delega el render del cuerpo a BlogPostClient (que usa MarkdownRenderer
// cliente para el contenido + el incrementViews mutation).
// =============================================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { BlogPostBody } from "./client";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com";

async function fetchPost(slug: string) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  try {
    return await convex.query(api.blog.getBySlug, { slug });
  } catch (err) {
    console.error(`[blog/[slug]] Error loading ${slug}:`, err);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) return { title: "Post no encontrado" };

  const title = post.seoTitle ?? post.title;
  const description = post.seoDescription ?? post.excerpt;
  const url = `${BASE_URL}/blog/${post.slug}`;
  const ogImage = post.coverImageUrl ?? `${BASE_URL}/og-image.png`;

  return {
    title: `${title} · Historias de dorsal`,
    description,
    alternates: { canonical: url },
    keywords: post.seoKeywords,
    authors: post.authorName ? [{ name: post.authorName }] : undefined,
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: "mi-dorsal",
      locale: "es_ES",
      publishedTime: post.publishedAt
        ? new Date(post.publishedAt).toISOString()
        : undefined,
      authors: post.authorName ? [post.authorName] : undefined,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: post.coverImageAlt ?? post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  return <BlogPostBody post={post} />;
}
