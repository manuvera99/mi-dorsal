// =============================================================================
// mi-dorsal — /admin/blog (gestión de posts del blog)
// =============================================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { CATEGORY_LABELS } from "@/convex/blog";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  Star,
  StarOff,
  Calendar,
} from "lucide-react";

const CATEGORY_KEYS = ["historias", "guias", "curiosidades", "tendencias"] as const;

export default function AdminBlogPage() {
  if (isMockMode()) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-2">Blog</h1>
        <p className="text-gray-600 mb-6 text-sm">
          Gestión de "Historias de dorsal" (borradores, publicación, destacados).
        </p>
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          Modo mock — gestión del blog no disponible. Conecta con Convex para usar el panel.
        </div>
      </div>
    );
  }

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
  const [category, setCategory] = useState<"all" | (typeof CATEGORY_KEYS)[number]>("all");

  const posts = useQuery(api.blog.adminList, {
    search: search || undefined,
    status: status === "all" ? undefined : status,
    category: category === "all" ? undefined : category,
  });
  const publish = useMutation(api.blog.publish);
  const unpublish = useMutation(api.blog.unpublish);
  const toggleFeatured = useMutation(api.blog.toggleFeatured);
  const del = useMutation(api.blog.adminDelete);

  const handlePublish = async (id: any, currentlyPublished: boolean) => {
    if (currentlyPublished) {
      await unpublish({ id });
    } else {
      await publish({ id });
    }
  };

  const handleDelete = async (id: any, title: string) => {
    if (confirm(`¿Eliminar el post "${title}"? Esta acción no se puede deshacer.`)) {
      await del({ id });
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Blog</h1>
          <p className="text-gray-600 text-sm">Historias de dorsal — gestión editorial</p>
        </div>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nuevo post
        </Link>
      </div>

      <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por título, slug o excerpt…"
            className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          <option value="all">Todos los estados</option>
          <option value="published">Publicados</option>
          <option value="draft">Borradores</option>
        </select>
        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value as any)}
        >
          <option value="all">Todas las categorías</option>
          {CATEGORY_KEYS.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <div className="text-sm text-gray-500 ml-auto">
          {posts === undefined ? "…" : `${posts.length} posts`}
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        {posts === undefined ? (
          <div className="p-12 text-center text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No hay posts con esos filtros.{" "}
            <Link href="/admin/blog/new" className="text-runner-primary hover:underline">
              Crear el primero
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Publicado</th>
                <th className="px-4 py-3">Newsletter</th>
                <th className="px-4 py-3">Vistas</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {posts.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-gray-400">/blog/{p.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {CATEGORY_LABELS[p.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {p.publishedAt ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.publishedAt).toLocaleDateString("es-ES")}
                      </span>
                    ) : (
                      <span className="text-gray-400">Borrador</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {p.newsletterSentAt ? (
                      <span className="text-green-700">
                        ✓ {new Date(p.newsletterSentAt).toLocaleDateString("es-ES")}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                    {p.views ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleFeatured({ id: p._id, value: !p.isFeatured })}
                        className="p-1.5 text-gray-500 hover:text-amber-500"
                        title={p.isFeatured ? "Quitar destacado" : "Destacar"}
                      >
                        {p.isFeatured ? <Star className="h-4 w-4 fill-amber-400 text-amber-500" /> : <StarOff className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handlePublish(p._id, !!p.isPublished)}
                        className="p-1.5 text-gray-500 hover:text-runner-primary"
                        title={p.isPublished ? "Despublicar" : "Publicar"}
                      >
                        {p.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <Link
                        href={`/admin/blog/${p._id}`}
                        className="p-1.5 text-gray-500 hover:text-runner-primary"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(p._id, p.title)}
                        className="p-1.5 text-gray-500 hover:text-red-600"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
