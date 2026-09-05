// =============================================================================
// mi-dorsal — BlogListClient (Client Component del índice)
// =============================================================================

"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PostCard } from "@/components/blog/PostCard";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { CATEGORY_LABELS, CATEGORY_DESCRIPTIONS } from "@/lib/blog-categories";
import { Loader2, BookOpen } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER = [
  "historias",
  "guias",
  "curiosidades",
  "tendencias",
] as const;

type CategoryFilter = (typeof CATEGORY_ORDER)[number] | "todas";

export function BlogListClient() {
  const [filter, setFilter] = useState<CategoryFilter>("todas");
  const filterArg = filter === "todas" ? undefined : filter;

  const data = useQuery(api.blog.list, { category: filterArg, limit: 50 });
  const counts = useQuery(api.blog.getCategoriesWithCounts, {});

  const isLoading = data === undefined;

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-runner-warm to-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-12 md:py-16 text-center">
          <span className="inline-block text-xs font-bold tracking-widest uppercase text-runner-primary mb-3">
            Historias de dorsal
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4">
            El blog del corredor popular
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Reportajes, guías y datos del running español. Sin postureo, sin
            patrocinios, sin prisa. Lo que cuentan los que se levantan el domingo
            a las 7 para cruzar una línea de meta.
          </p>
        </div>
      </section>

      {/* Filtros por categoría */}
      <section className="border-b border-gray-200 bg-white sticky top-16 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            <FilterPill
              active={filter === "todas"}
              onClick={() => setFilter("todas")}
              label="Todas"
              count={Object.values((counts ?? {}) as Record<string, number>).reduce((a: number, b: number) => a + b, 0)}
            />
            {CATEGORY_ORDER.map((cat) => (
              <FilterPill
                key={cat}
                active={filter === cat}
                onClick={() => setFilter(cat)}
                label={CATEGORY_LABELS[cat]}
                count={counts?.[cat] ?? 0}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Grid de posts */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <>
            {filter !== "todas" && (
              <p className="text-sm text-gray-600 mb-6">
                {CATEGORY_DESCRIPTIONS[filter]}
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.items.map((p) => (
                <PostCard key={p._id} {...p} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Newsletter CTA */}
      <section className="bg-gray-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16 text-center">
          <BookOpen className="h-8 w-8 mx-auto mb-4 text-runner-primary" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Una vez al mes, lo mejor del blog
          </h2>
          <p className="text-gray-300 mb-6 max-w-xl mx-auto">
            Sin spam. Solo el post destacado, una historia real y algún dato
            curioso del running popular. Lo demás, te lo comes en la línea de
            meta.
          </p>
          <div className="max-w-md mx-auto">
            <NewsletterForm source="blog" variant="default" />
          </div>
        </div>
      </section>
    </>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-runner-primary text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200",
      )}
    >
      {label}
      {count > 0 && (
        <span
          className={cn(
            "text-xs px-1.5 py-0.5 rounded-full",
            active ? "bg-white/20" : "bg-white text-gray-700",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({ filter }: { filter: CategoryFilter }) {
  return (
    <div className="text-center py-20">
      <p className="text-gray-500 mb-2">
        Todavía no hay {filter === "todas" ? "historias" : CATEGORY_LABELS[filter].toLowerCase()}{" "}
        publicadas.
      </p>
      <p className="text-sm text-gray-400">
        Estamos escribiéndolas. Si quieres que prioricemos alguna, escríbenos a{" "}
        <a href="mailto:hola@mi-dorsal.es" className="underline">
          hola@mi-dorsal.es
        </a>
        .
      </p>
    </div>
  );
}
