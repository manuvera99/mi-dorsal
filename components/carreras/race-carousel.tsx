"use client";

/**
 * RaceCarousel — sección con carrusel horizontal de RaceCards.
 *
 * Usado para "Cerca de ti", "Las más votadas" y "Próximamente".
 * Scroll horizontal en móvil + botones de flecha en desktop.
 * Sticky-friendly: no rompe si el array está vacío (devuelve null).
 */

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RaceCard } from "@/components/race-card";
import { cn } from "@/lib/utils";

interface RaceCarouselProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  races: any[];
  emptyMessage?: string;
  /** Mostrar/ocultar el CTA "Ver todo" a la derecha */
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Color de acento del header (e.g. "primary", "amber") */
  accent?: "primary" | "amber" | "purple";
  /** Distancia del usuario para mostrar en las cards */
  distanceFromUser?: (race: any) => number | null;
}

const ACCENT_CLASSES: Record<NonNullable<RaceCarouselProps["accent"]>, string> = {
  primary: "text-runner-primary",
  amber: "text-amber-600",
  purple: "text-purple-600",
};

export function RaceCarousel({
  title,
  subtitle,
  icon,
  races,
  emptyMessage,
  viewAllHref,
  viewAllLabel = "Ver todas",
  accent = "primary",
  distanceFromUser,
}: RaceCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function update() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [races.length]);

  function scrollBy(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("[data-card]")?.clientWidth ?? 300;
    el.scrollBy({
      left: direction === "left" ? -(cardWidth + 16) : cardWidth + 16,
      behavior: "smooth",
    });
  }

  if (races.length === 0 && !emptyMessage) return null;

  return (
    <section className="py-6 md:py-8" aria-labelledby={`carousel-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {icon && (
              <span className={cn("flex-shrink-0", ACCENT_CLASSES[accent])} aria-hidden="true">
                {icon}
              </span>
            )}
            <h2
              id={`carousel-${title.replace(/\s+/g, "-").toLowerCase()}`}
              className={cn("text-xl md:text-2xl font-bold", ACCENT_CLASSES[accent])}
            >
              {title}
            </h2>
          </div>
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {viewAllHref && (
            <a
              href={viewAllHref}
              className="hidden sm:inline-flex text-sm font-semibold text-runner-primary hover:underline whitespace-nowrap"
            >
              {viewAllLabel} →
            </a>
          )}
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollBy("left")}
              disabled={!canScrollLeft}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:border-runner-primary hover:text-runner-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Scroll izquierda"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy("right")}
              disabled={!canScrollRight}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:border-runner-primary hover:text-runner-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Scroll derecha"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {races.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-runner-warm p-6 text-center">
          <p className="text-sm text-gray-600">{emptyMessage}</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth -mx-4 px-4 md:-mx-0 md:px-0 snap-x snap-mandatory"
        >
          {races.map((race) => (
            <div
              key={race._id}
              data-card
              className="flex-shrink-0 w-[280px] sm:w-[300px] snap-start"
            >
              <RaceCard
                race={race}
                distanceFromUser={
                  distanceFromUser ? distanceFromUser(race) : null
                }
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
