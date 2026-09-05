// =============================================================================
// mi-dorsal — BlogPostBody (Client Component del post)
// =============================================================================
// Renderiza el contenido del post (MarkdownRenderer), related races,
// Schema.org Article como JSON-LD, y dispara incrementViews al mount.
// =============================================================================

"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MarkdownRenderer } from "@/components/blog/MarkdownRenderer";
import { PostCard } from "@/components/blog/PostCard";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { CATEGORY_LABELS } from "@/convex/blog";
import { Clock, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Doc } from "@/convex/_generated/dataModel";

type Post = Doc<"blogPosts">;

function formatDate(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function BlogPostBody({ post }: { post: Post }) {
  const increment = useMutation(api.blog.incrementViews);
  const related = useQuery(api.blog.getRelated, { postId: post._id, limit: 3 });

  // Incrementa vistas al mount (idempotente, una vez por carga)
  useEffect(() => {
    increment({ id: post._id }).catch(() => {
      // Silenciar: no es crítico si falla
    });
  }, [post._id, increment]);

  // Schema.org Article
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    datePublished: post.publishedAt
      ? new Date(post.publishedAt).toISOString()
      : undefined,
    dateModified: new Date(post.updatedAt).toISOString(),
    author: post.authorName
      ? {
          "@type": "Person",
          name: post.authorName,
        }
      : {
          "@type": "Organization",
          name: "mi-dorsal",
        },
    publisher: {
      "@type": "Organization",
      name: "mi-dorsal",
      logo: {
        "@type": "ImageObject",
        url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com"}/icon.svg`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com"}/blog/${post.slug}`,
    },
    keywords: post.tags?.join(", "),
    articleSection: CATEGORY_LABELS[post.category],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <article className="max-w-3xl mx-auto px-4 py-10">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-runner-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al blog
        </Link>

        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href={`/blog/categoria/${post.category}`}
              className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded bg-runner-primary/10 text-runner-primary hover:bg-runner-primary/20 transition-colors"
            >
              {CATEGORY_LABELS[post.category]}
            </Link>
            {post.publishedAt && (
              <span className="text-sm text-gray-500 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(post.publishedAt)}
              </span>
            )}
            {post.readingTimeMinutes && (
              <span className="text-sm text-gray-500 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {post.readingTimeMinutes} min
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">{post.excerpt}</p>
          {post.authorName && (
            <p className="mt-4 text-sm text-gray-500">por {post.authorName}</p>
          )}
        </header>

        {post.coverImageUrl && (
          <div className="aspect-[16/9] relative rounded-xl overflow-hidden bg-gray-100 mb-10">
            <Image
              src={post.coverImageUrl}
              alt={post.coverImageAlt ?? post.title}
              fill
              sizes="(min-width: 768px) 768px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        )}

        <div className="max-w-none">
          <MarkdownRenderer content={post.content} />
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="mt-10 pt-6 border-t border-gray-200">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Tags</p>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <span
                  key={t}
                  className="inline-block text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Carreras relacionadas (internal linking) */}
        {post.relatedRaceIds && post.relatedRaceIds.length > 0 && (
          <RelatedRaces raceIds={post.relatedRaceIds} />
        )}
      </article>

      {/* Posts relacionados */}
      {related && related.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-10 border-t border-gray-200">
          <h2 className="text-2xl font-bold mb-6">Sigue leyendo</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {related.map((p) => (
              <PostCard
                key={p._id}
                slug={p.slug}
                title={p.title}
                excerpt={p.excerpt}
                category={p.category}
                coverImageUrl={p.coverImageUrl ?? undefined}
                coverImageAlt={p.coverImageAlt ?? undefined}
                authorName={p.authorName}
                publishedAt={p.publishedAt}
                readingTimeMinutes={p.readingTimeMinutes}
                isFeatured={p.isFeatured}
              />
            ))}
          </div>
        </section>
      )}

      {/* Newsletter inline CTA */}
      <section className="bg-gray-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-3">¿Te ha gustado?</h2>
          <p className="text-gray-300 mb-6">
            Apúntate y recibe una historia como esta cada mes, sin spam.
          </p>
          <div className="max-w-md mx-auto">
            <NewsletterForm source="blog" variant="default" />
          </div>
        </div>
      </section>
    </>
  );
}

function RelatedRaces({ raceIds }: { raceIds: Post["relatedRaceIds"] }) {
  const races = useQuery(api.races.getByIds, { ids: raceIds! });
  if (!races || races.length === 0) return null;

  return (
    <section className="mt-10 pt-6 border-t border-gray-200">
      <h2 className="text-lg font-bold mb-3">Carreras mencionadas</h2>
      <ul className="space-y-2">
        {races.map((r: any) => (
          <li key={r._id} className="flex items-baseline gap-2">
            <span className="text-runner-primary">→</span>
            <Link
              href={`/carreras/${r.slug}`}
              className="text-gray-700 hover:text-runner-primary hover:underline"
            >
              {r.name}
            </Link>
            {r.locality && (
              <span className="text-sm text-gray-400">· {r.locality}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
