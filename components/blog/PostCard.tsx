// =============================================================================
// mi-dorsal — PostCard (catálogo de Historias de dorsal)
// =============================================================================
// Card usado en /blog, /blog/categoria/[cat] y en secciones "Lecturas
// recomendadas" del resto de la web.
// =============================================================================

import Link from "next/link";
import Image from "next/image";
import { Clock, ArrowRight } from "lucide-react";
import { CATEGORY_LABELS } from "@/convex/blog";

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  historias: { bg: "bg-runner-primary/10", text: "text-runner-primary" },
  guias: { bg: "bg-runner-accent/10", text: "text-runner-accent" },
  curiosidades: { bg: "bg-amber-100", text: "text-amber-800" },
  tendencias: { bg: "bg-blue-100", text: "text-blue-800" },
};

type PostCardProps = {
  slug: string;
  title: string;
  excerpt: string;
  category: keyof typeof CATEGORY_LABELS;
  coverImageUrl?: string;
  coverImageAlt?: string;
  authorName?: string;
  publishedAt?: number;
  readingTimeMinutes?: number;
  isFeatured?: boolean;
  variant?: "default" | "compact";
};

function formatDate(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PostCard({
  slug,
  title,
  excerpt,
  category,
  coverImageUrl,
  coverImageAlt,
  authorName,
  publishedAt,
  readingTimeMinutes,
  isFeatured,
  variant = "default",
}: PostCardProps) {
  const catStyle = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.historias;
  const catLabel = CATEGORY_LABELS[category] ?? category;

  if (variant === "compact") {
    return (
      <Link
        href={`/blog/${slug}`}
        className="group flex gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {coverImageUrl && (
          <div className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-gray-100">
            <Image
              src={coverImageUrl}
              alt={coverImageAlt ?? ""}
              width={80}
              height={80}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${catStyle.bg} ${catStyle.text}`}>
            {catLabel}
          </span>
          <h3 className="mt-1 text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-runner-primary transition-colors">
            {title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            {publishedAt && <span>{formatDate(publishedAt)}</span>}
            {readingTimeMinutes && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {readingTimeMinutes} min
                </span>
              </>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/blog/${slug}`}
      className="group flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-runner-primary/30 transition-all"
    >
      {coverImageUrl ? (
        <div className="aspect-[16/9] relative bg-gray-100 overflow-hidden">
          <Image
            src={coverImageUrl}
            alt={coverImageAlt ?? title}
            fill
            sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {isFeatured && (
            <span className="absolute top-3 left-3 inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-amber-400 text-amber-950">
              Destacado
            </span>
          )}
        </div>
      ) : (
        <div className="aspect-[16/9] bg-gradient-to-br from-runner-primary/10 to-runner-accent/10 flex items-center justify-center">
          <span className={`inline-block text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded ${catStyle.bg} ${catStyle.text}`}>
            {catLabel}
          </span>
        </div>
      )}

      <div className="flex-1 p-5 flex flex-col">
        <span className={`inline-block self-start text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${catStyle.bg} ${catStyle.text} mb-3`}>
          {catLabel}
        </span>
        <h3 className="text-lg font-bold text-gray-900 line-clamp-2 group-hover:text-runner-primary transition-colors mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-1">{excerpt}</p>

        <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 truncate">
            {authorName && <span className="truncate">por {authorName}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {publishedAt && <span>{formatDate(publishedAt)}</span>}
            {readingTimeMinutes && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {readingTimeMinutes} min
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
