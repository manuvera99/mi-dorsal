// =============================================================================
// mi-dorsal — /admin/blog/[id] (editar post)
// =============================================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { CATEGORY_LABELS } from "@/lib/blog-categories";
import { ArrowLeft, Save, Loader2, Eye, Trash2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

const CATEGORY_KEYS = ["historias", "guias", "curiosidades", "tendencias"] as const;

export default function EditBlogPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as Id<"blogPosts">;
  const useMock = isMockMode();
  const post = useQuery(api.blog.adminGet, { id: postId });
  const update = useMutation(api.blog.update);
  const publish = useMutation(api.blog.publish);
  const unpublish = useMutation(api.blog.unpublish);
  const del = useMutation(api.blog.adminDelete);

  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (post && !form) {
      setForm({
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        tags: (post.tags ?? []).join(", "),
        seoTitle: post.seoTitle ?? "",
        seoDescription: post.seoDescription ?? "",
        isFeatured: !!post.isFeatured,
        coverImageUrl: post.coverImageUrl ?? "",
        coverImageAlt: post.coverImageAlt ?? "",
      });
    }
  }, [post, form]);

  if (useMock) {
    return (
      <div className="p-8">
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
          Modo mock — edición de posts no disponible.
        </div>
      </div>
    );
  }

  if (post === undefined || form === null) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (post === null) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Post no encontrado.</p>
        <Link href="/admin/blog" className="text-runner-primary hover:underline text-sm">
          Volver al blog
        </Link>
      </div>
    );
  }

  const set = (k: keyof typeof form, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const tags = form.tags
        .split(",")
        .map((t: string) => t.trim().toLowerCase())
        .filter(Boolean);
      await update({
        id: post._id,
        title: form.title,
        excerpt: form.excerpt,
        content: form.content,
        category: form.category,
        tags: tags.length > 0 ? tags : undefined,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
        isFeatured: form.isFeatured,
        coverImageUrl: form.coverImageUrl || undefined,
        coverImageAlt: form.coverImageAlt || undefined,
      });
      router.push("/admin/blog");
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`¿Eliminar el post "${post.title}"? Esta acción no se puede deshacer.`)) {
      await del({ id: post._id });
      router.push("/admin/blog");
    }
  };

  const togglePublish = async () => {
    if (post.isPublished) {
      await unpublish({ id: post._id });
    } else {
      await publish({ id: post._id });
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href="/admin/blog"
        className="text-sm text-gray-500 hover:underline flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Volver al blog
      </Link>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold">Editar post</h1>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-1 rounded ${
              post.isPublished
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {post.isPublished ? "Publicado" : "Borrador"}
          </span>
          <span className="text-xs text-gray-400 font-mono">/blog/{post.slug}</span>
        </div>
      </div>
      <p className="text-gray-600 mb-6 text-sm">
        Última edición: {new Date(post.updatedAt).toLocaleString("es-ES")}
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="bg-white border rounded-lg p-6 space-y-5">
        <Field label="Título *">
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className="input"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Categoría *">
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="input"
            >
              {CATEGORY_KEYS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tags (separados por coma)">
            <input
              type="text"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <Field label="Excerpt * (resumen de ~200 chars)">
          <textarea
            required
            value={form.excerpt}
            onChange={(e) => set("excerpt", e.target.value)}
            className="input min-h-[80px]"
            maxLength={300}
          />
        </Field>

        <Field label="Contenido (markdown)">
          <textarea
            required
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            className="input min-h-[400px] font-mono text-sm"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Cover image URL">
            <input
              type="url"
              value={form.coverImageUrl}
              onChange={(e) => set("coverImageUrl", e.target.value)}
              className="input"
              placeholder="https://..."
            />
          </Field>
          <Field label="Cover image alt (accesibilidad)">
            <input
              type="text"
              value={form.coverImageAlt}
              onChange={(e) => set("coverImageAlt", e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <details className="border rounded-md p-3 bg-gray-50">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer">SEO</summary>
          <div className="mt-3 space-y-3">
            <Field label="SEO Title">
              <input
                type="text"
                value={form.seoTitle}
                onChange={(e) => set("seoTitle", e.target.value)}
                className="input"
                maxLength={70}
              />
            </Field>
            <Field label="SEO Description">
              <textarea
                value={form.seoDescription}
                onChange={(e) => set("seoDescription", e.target.value)}
                className="input min-h-[60px]"
                maxLength={160}
              />
            </Field>
          </div>
        </details>

        <label className="flex items-center gap-2 text-sm pt-2 border-t">
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(e) => set("isFeatured", e.target.checked)}
            className="h-4 w-4"
          />
          Destacar en la home
        </label>

        <div className="flex items-center gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-runner-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cambios
          </button>
          <button
            type="button"
            onClick={togglePublish}
            className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-50"
          >
            <Eye className="h-4 w-4" />
            {post.isPublished ? "Despublicar" : "Publicar"}
          </button>
          <Link
            href={`/blog/${post.slug}`}
            target="_blank"
            className="text-sm text-gray-500 hover:underline"
          >
            Ver post →
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="ml-auto inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
