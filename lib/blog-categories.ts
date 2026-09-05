// =============================================================================
// mi-dorsal — Categorías del blog (constantes de presentación)
// =============================================================================
// Vive fuera de convex/ a propósito: los componentes cliente (admin/blog,
// /blog, PostCard) necesitan estas etiquetas sin arrastrar convex/blog.ts,
// que importa convex/_generated/server.js — ese archivo exporta
// `env = process.env` a nivel de módulo, y `process` no existe en el
// navegador. Importar CATEGORY_LABELS desde @/convex/blog en un componente
// "use client" mete todo ese módulo en el bundle del cliente y rompe con
// "ReferenceError: process is not defined".
// =============================================================================

export const CATEGORY_LABELS: Record<string, string> = {
  historias: "Historias de dorsal",
  guias: "Guías de carrera",
  curiosidades: "Curiosidades",
  tendencias: "Tendencias con contexto",
};

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  historias:
    "Reportajes personales, Behobia, San Silvestre, lo que se siente al cruzar una meta.",
  guias:
    "Ruta, perfil, avituallamiento, qué llevar. Datos reales del catálogo de mi-dorsal.",
  curiosidades: "Récords raros, historia del running popular español, datos que no esperabas.",
  tendencias:
    "Material, entrenamiento, calendario. Lo que se mueve, con contexto de mi-dorsal.",
};
