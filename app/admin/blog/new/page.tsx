// =============================================================================
// mi-dorsal — /admin/blog/new (crear post)
// =============================================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { CATEGORY_LABELS } from "@/convex/blog";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, FileText } from "lucide-react";


const CATEGORY_KEYS = ["historias", "guias", "curiosidades", "tendencias"] as const;

export default function NewBlogPostPage() {
  const router = useRouter();
  const useMock = isMockMode();
  const create = useMutation(api.blog.create);
  const publish = useMutation(api.blog.publish);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    category: "historias" as (typeof CATEGORY_KEYS)[number],
    tags: "",
    seoTitle: "",
    seoDescription: "",
    publishImmediately: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (useMock) {
    return (
      <div className="p-8">
        <Link href="/admin/blog" className="text-sm text-gray-500 hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" /> Volver
        </Link>
        <h1 className="text-3xl font-bold mb-2">Nuevo post</h1>
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
          Modo mock — creación de posts no disponible. Conecta con Convex para usar el formulario.
        </div>
      </div>
    );
  }

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const id = await create({
        title: form.title,
        slug: form.slug || undefined,
        excerpt: form.excerpt,
        content: form.content,
        category: form.category,
        tags: tags.length > 0 ? tags : undefined,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
      });
      if (form.publishImmediately) {
        await publish({ id });
      }
      router.push(`/admin/blog/${id}`);
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
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
      <h1 className="text-3xl font-bold mb-2">Nuevo post</h1>
      <p className="text-gray-600 mb-6 text-sm">
        Crea un post en el blog. Si marcas "Publicar inmediatamente" se
        publica al guardar; si no, queda como borrador.
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
            placeholder="Lo que aprendí en mi 5ª Behobia"
          />
        </Field>

        <Field label="Slug (opcional, se genera del título)">
          <input
            type="text"
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
            className="input font-mono"
            placeholder="lo-que-aprendi-en-mi-5a-behobia"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Categoría *">
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value as any)}
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
              placeholder="behobia, behobia-san-sebastian, 10k"
            />
          </Field>
        </div>

        <Field label="Excerpt * (resumen de ~200 chars, se muestra en listados y OG)">
          <textarea
            required
            value={form.excerpt}
            onChange={(e) => set("excerpt", e.target.value)}
            className="input min-h-[80px]"
            maxLength={300}
            placeholder="Crónica de mi quinta Behobia: lo que se siente al cruzar la meta después de 5 intentos, lo que aprendí sobre el avituallamiento y por qué la línea de salida siempre asusta igual."
          />
        </Field>

        <Field label="Contenido (markdown: ## H2, ### H3, **negrita**, *cursiva*, [link](url), > quote)">
          <textarea
            required
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            className="input min-h-[400px] font-mono text-sm"
            placeholder={"## El día D\n\nLlego a Behobia a las 7:15. El bus desde el parking ya está lleno. La línea de salida está a 20 minutos andando.\n\n### El avituallamiento del km 5\n\nLo que más me gusta: el avituallamiento del km 5 está al lado de un bar. Sí, un bar abierto a las 9 de la mañana. Sirven café solo. Si vas con dorsal, te invitan.\n\n> La Behobia no se corre, se sobrevive.\n\n## Lo que cambiaría\n\n..."}
          />
        </Field>

        <details className="border rounded-md p-3 bg-gray-50">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer">
            SEO (opcional — si no, se usa título + excerpt)
          </summary>
          <div className="mt-3 space-y-3">
            <Field label="SEO Title">
              <input
                type="text"
                value={form.seoTitle}
                onChange={(e) => set("seoTitle", e.target.value)}
                className="input"
                placeholder="Mi Behobia 2026: crónica y consejos de un popular"
                maxLength={70}
              />
            </Field>
            <Field label="SEO Description">
              <textarea
                value={form.seoDescription}
                onChange={(e) => set("seoDescription", e.target.value)}
                className="input min-h-[60px]"
                placeholder="Lo que aprendí en mi quinta Behobia: avituallamiento, dorsal, línea de meta, lo que repetiría y lo que no."
                maxLength={160}
              />
            </Field>
          </div>
        </details>

        <label className="flex items-center gap-2 text-sm pt-2 border-t">
          <input
            type="checkbox"
            checked={form.publishImmediately}
            onChange={(e) => set("publishImmediately", e.target.checked)}
            className="h-4 w-4"
          />
          Publicar inmediatamente (si no, queda como borrador)
        </label>

        <div className="flex items-center gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-runner-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar borrador
          </button>
          <Link href="/admin/blog" className="text-sm text-gray-500 hover:underline">
            Cancelar
          </Link>
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
