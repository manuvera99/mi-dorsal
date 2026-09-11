"use client";

// =============================================================================
// mi-dorsal — /editor-sticker/{myRaceId}
// =============================================================================
// Editor visual del sticker personalizado (feature premium). Gate premium
// client-side (mismo patrón que app/admin/layout.tsx: useQuery cruda +
// useEffect + router.push, sin redirect() de servidor). Layout responsive:
// 3 columnas fijas en desktop, bottom sheets en móvil (ver spec).
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { isMockMode } from "@/lib/mock/provider";
import { useToast } from "@/components/ui/toast";
import { formatTime, formatPace, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Mail, RotateCcw } from "lucide-react";

import { StickerCanvas, CANVAS_WIDTH } from "@/lib/sticker-editor/StickerCanvas";
import { TemplatePanel } from "@/lib/sticker-editor/TemplatePanel";
import { PropertiesPanel } from "@/lib/sticker-editor/PropertiesPanel";
import { STICKER_TEMPLATES, applyTemplate, type StickerTemplateId, type StickerElementLayout } from "@/lib/sticker-editor/templates";
import { getAvailableFields, type StickerData, type StickerFieldId } from "@/lib/sticker-editor/fields";
import { decodePolyline, polylineToSvgPath } from "@/lib/sticker-editor/polyline";
import { exportStickerToBlob, downloadBlob, blobToBase64 } from "@/lib/sticker-editor/export";

export function EditorStickerClient({ myRaceId }: { myRaceId: string }) {
  const useMock = isMockMode();
  const router = useRouter();
  const toast = useToast();

  // OJO: usamos la query cruda (no un hook useHasPremium) porque tal hook
  // podría colapsar el estado "cargando" (undefined) a `hasAccess: false`
  // para evitar parpadeos en UI que solo MUESTRAN el badge premium — aquí
  // necesitamos distinguir "aún cargando" de "confirmado free" para no
  // redirigir de golpe a un usuario premium cuya query todavía no resolvió
  // (mismo motivo por el que app/admin/layout.tsx comprueba
  // `myProfile !== undefined` antes de decidir el redirect).
  const premiumStatus = useMock ? undefined : useQuery(api.subscriptions.getMyPremiumStatus, {});
  const isLoaded = useMock || premiumStatus !== undefined;
  const hasAccess = premiumStatus?.hasAccess ?? false;

  const editorData = useMock
    ? null
    : useQuery(
        api.stickerEditor.getEditorData,
        isLoaded && hasAccess ? { myRaceId: myRaceId as Id<"myRaces"> } : "skip",
      );
  const saveCustomTemplate = useMutation(api.stickerEditor.saveCustomTemplate);
  const generateUploadUrl = useMutation(api.stickerEditor.generateUploadUrl);
  const attachCustomSticker = useMutation(api.stickerEditor.attachCustomSticker);
  const emailCustomSticker = useAction(api.stickerEditor.emailCustomSticker);

  const [templateId, setTemplateId] = useState<StickerTemplateId>("classic");
  const [usingCustomTemplate, setUsingCustomTemplate] = useState(false);
  const [elements, setElements] = useState<StickerElementLayout[]>(STICKER_TEMPLATES.classic.elements);
  const [selectedFieldId, setSelectedFieldId] = useState<StickerFieldId | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  // Bottom sheet activo en móvil (spec: "Responsive real" — paneles ocultos
  // por defecto en <768px, se abren a demanda). null = ningún sheet abierto.
  const [mobileSheet, setMobileSheet] = useState<"templates" | "properties" | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Snapshot del estado con el que arrancó el editor (plantilla propia si
  // existía, o "classic" si no) — para poder volver ahí con el botón
  // "Reset". Se congela la PRIMERA vez que editorData resuelve; no se
  // vuelve a tocar aunque el usuario guarde una plantilla nueva a mitad
  // de sesión (reset siempre vuelve a como estaba AL ABRIR el editor,
  // no al último guardado).
  const initialStateRef = useRef<{
    templateId: StickerTemplateId;
    usingCustomTemplate: boolean;
    elements: StickerElementLayout[];
  } | null>(null);

  // Gate premium: mismo patrón que app/admin/layout.tsx (useEffect +
  // router.push tras confirmar que la query resolvió, nunca redirect()
  // de servidor).
  useEffect(() => {
    if (useMock) return;
    if (isLoaded && !hasAccess) {
      router.push("/premium");
    }
  }, [useMock, isLoaded, hasAccess, router]);

  // Precarga inicial: plantilla propia si existe, si no "classic". Solo
  // se ejecuta una vez (initialStateRef.current sirve de guarda) — sin
  // eso, cada vez que editorData?.customStickerTemplate cambia de
  // referencia (ej. tras guardar una plantilla nueva a mitad de sesión)
  // esto pisaría los cambios en curso del usuario con la plantilla recién
  // guardada.
  useEffect(() => {
    if (!editorData || initialStateRef.current) return;
    const initialElements = editorData.customStickerTemplate
      ? (editorData.customStickerTemplate.elements as StickerElementLayout[])
      : STICKER_TEMPLATES.classic.elements;
    if (editorData.customStickerTemplate) {
      setUsingCustomTemplate(true);
      setElements(initialElements);
    }
    initialStateRef.current = {
      templateId: "classic",
      usingCustomTemplate: !!editorData.customStickerTemplate,
      elements: initialElements,
    };
  }, [editorData]);

  function handleReset() {
    const initial = initialStateRef.current;
    if (!initial) return;
    setTemplateId(initial.templateId);
    setUsingCustomTemplate(initial.usingCustomTemplate);
    setElements(initial.elements);
    setSelectedFieldId(null);
  }

  function handleResetClick() {
    // Confirmación nativa: es una acción destructiva (descarta cualquier
    // cambio de posición/tamaño/campos añadidos hecho en esta sesión de
    // edición) y no hay deshacer — mejor preguntar antes que perder
    // trabajo del usuario por un click accidental.
    if (window.confirm("¿Deshacer todos los cambios y volver al estado inicial del editor?")) {
      handleReset();
      toast.show({ title: "Editor reiniciado", variant: "success" });
    }
  }

  const data: StickerData | null = useMemo(() => {
    if (!editorData) return null;
    const routeSvgPath = editorData.mapPolyline
      ? polylineToSvgPath(decodePolyline(editorData.mapPolyline), 300)
      : undefined;
    return {
      timeFormatted: editorData.myRace.actualTimeSeconds != null ? formatTime(editorData.myRace.actualTimeSeconds) : undefined,
      paceFormatted:
        editorData.myRace.actualTimeSeconds != null
          ? formatPace(editorData.myRace.actualTimeSeconds / Math.max(editorData.race.distanceKm, 0.001))
          : undefined,
      positionOverall: editorData.myRace.actualPosition,
      positionCategory: editorData.myRace.actualPositionCategory,
      isPersonalRecord:
        editorData.currentPR != null &&
        editorData.myRace.actualTimeSeconds != null &&
        editorData.myRace.actualTimeSeconds < editorData.currentPR.timeSeconds,
      dorsalNumber: editorData.myRace.dorsalNumber,
      raceName: editorData.race.name,
      raceDate: formatDate(editorData.race.startDate),
      runnerName: editorData.runnerName,
      distanceLabel: editorData.race.distanceLabel,
      routeSvgPath,
    };
  }, [editorData]);

  const availableFieldIds = useMemo(() => (data ? getAvailableFields(data) : []), [data]);
  const activeFieldIds = useMemo(() => elements.filter((e) => e.visible).map((e) => e.fieldId), [elements]);
  const selectedElement = elements.find((e) => e.fieldId === selectedFieldId) ?? null;

  function handleSelectTemplate(id: StickerTemplateId) {
    setTemplateId(id);
    setUsingCustomTemplate(false);
    setElements(applyTemplate(id, activeFieldIds).elements);
    setSelectedFieldId(null);
  }

  function handleSelectCustomTemplate() {
    if (!editorData?.customStickerTemplate) return;
    setUsingCustomTemplate(true);
    setElements(editorData.customStickerTemplate.elements as StickerElementLayout[]);
    setSelectedFieldId(null);
  }

  function handleMove(fieldId: StickerFieldId, x: number, y: number) {
    setElements((prev) => prev.map((el) => (el.fieldId === fieldId ? { ...el, x, y } : el)));
  }

  function handleResize(fieldId: StickerFieldId, scale: number) {
    setElements((prev) => prev.map((el) => (el.fieldId === fieldId ? { ...el, scale } : el)));
  }

  function handleToggleVisible(fieldId: StickerFieldId) {
    setElements((prev) =>
      prev.map((el) => (el.fieldId === fieldId ? { ...el, visible: !el.visible } : el)),
    );
  }

  function handleAddField(fieldId: StickerFieldId) {
    const existing = elements.find((el) => el.fieldId === fieldId);
    if (existing) {
      handleToggleVisible(fieldId);
    } else {
      // Escalona cada campo añadido para que no caiga siempre en el mismo
      // punto exacto (0.5, 0.65) que los anteriores — evita que se
      // amontonen visualmente antes de que el usuario los arrastre.
      const addedCount = elements.length;
      const row = Math.floor(addedCount / 2);
      const col = addedCount % 2;
      setElements((prev) => [
        ...prev,
        {
          fieldId,
          visible: true,
          x: col === 0 ? 0.35 : 0.65,
          y: Math.min(0.9, 0.65 + row * 0.08),
          scale: 1,
        },
      ]);
    }
    setSelectedFieldId(fieldId);
  }

  async function handleSaveTemplate() {
    setIsSavingTemplate(true);
    try {
      await saveCustomTemplate({
        baseTemplateId: templateId,
        elements,
      });
      toast.show({ title: "Plantilla guardada", variant: "success" });
    } catch (e: any) {
      toast.show({ title: "No se pudo guardar la plantilla", description: e?.message, variant: "warning" });
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleExport() {
    if (!canvasRef.current) return;
    setIsExporting(true);
    try {
      const blob = await exportStickerToBlob(canvasRef.current);
      downloadBlob(blob, `mi-dorsal-sticker-${myRaceId}.png`);

      try {
        const uploadUrl = await generateUploadUrl({});
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: blob,
        });
        if (!uploadRes.ok) {
          const text = await uploadRes.text().catch(() => "");
          throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText} ${text}`);
        }
        const { storageId } = await uploadRes.json();
        await attachCustomSticker({ myRaceId: myRaceId as Id<"myRaces">, storageId });
        toast.show({ title: "Sticker descargado y guardado", variant: "success" });
      } catch (uploadErr: any) {
        // La descarga local ya ocurrió — solo avisamos que no se pudo persistir.
        toast.show({
          title: "Descargado, pero no se pudo guardar en tu cuenta",
          description: uploadErr?.message,
          variant: "warning",
        });
      }
    } catch (e: any) {
      toast.show({ title: "No se pudo exportar el sticker", description: e?.message, variant: "warning" });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleEmailSticker() {
    if (!canvasRef.current || !editorData) return;
    setIsEmailing(true);
    try {
      const blob = await exportStickerToBlob(canvasRef.current);
      const pngBase64 = await blobToBase64(blob);
      await emailCustomSticker({
        myRaceId: myRaceId as Id<"myRaces">,
        raceName: editorData.race.name,
        pngBase64,
      });
      toast.show({ title: "Sticker enviado a tu email", variant: "success" });
    } catch (e: any) {
      toast.show({ title: "No se pudo enviar el sticker por email", description: e?.message, variant: "warning" });
    } finally {
      setIsEmailing(false);
    }
  }

  if (useMock) {
    return (
      <div className="p-8 text-center text-stone-500">
        Editor de sticker no disponible en modo mock.
      </div>
    );
  }

  const canRender = useMock || (isLoaded && hasAccess);
  if (!canRender) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (editorData === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (editorData === null || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-stone-600">No se encontró esta carrera o no tienes acceso.</p>
        <Link href="/mi-sticker" className="text-runner-primary hover:underline text-sm mt-2 inline-block">
          Volver a mis carreras
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-white">
        <Link href={`/resultado/${myRaceId}`} className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-runner-primary">
          <ArrowLeft className="h-4 w-4" />
          {editorData.race.name}
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetClick}
            title="Deshacer todos los cambios y volver al estado inicial"
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <button
            onClick={handleEmailSticker}
            disabled={isEmailing}
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            {isEmailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            <span className="hidden sm:inline">Enviarme por email</span>
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar PNG
          </button>
        </div>
      </header>

      {/* Layout: 3 columnas fijas en desktop (md+). En móvil, el lienzo
          ocupa toda la pantalla y los paneles viven en bottom sheets
          (spec: "Responsive real" — no basta apilar, hay que ocultar los
          paneles hasta que el usuario los abre explícitamente). */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 max-w-6xl mx-auto w-full">
        {/* Paneles: columna fija en desktop, ocultos en móvil (se muestran vía bottom sheet) */}
        <aside className="hidden md:block md:w-40 flex-shrink-0">
          <TemplatePanel
            activeTemplateId={templateId}
            isCustomTemplateActive={usingCustomTemplate}
            hasCustomTemplate={!!editorData.customStickerTemplate}
            onSelectTemplate={handleSelectTemplate}
            onSelectCustomTemplate={handleSelectCustomTemplate}
            onSaveCustomTemplate={handleSaveTemplate}
            isSaving={isSavingTemplate}
          />
        </aside>

        <div className="flex-1 flex items-center justify-center">
          <StickerCanvas
            elements={elements}
            data={data}
            selectedFieldId={selectedFieldId}
            onSelect={setSelectedFieldId}
            onMove={handleMove}
            onResize={handleResize}
            displayWidth={Math.min(320, CANVAS_WIDTH)}
            canvasRef={canvasRef}
          />
        </div>

        <aside className="hidden md:block md:w-48 flex-shrink-0">
          <PropertiesPanel
            selectedElement={selectedElement}
            availableFieldIds={availableFieldIds}
            activeFieldIds={activeFieldIds}
            onToggleVisible={handleToggleVisible}
            onScaleChange={handleResize}
            onAddField={handleAddField}
          />
        </aside>
      </div>

      {/* Barra inferior móvil: abre cada panel como bottom sheet.
          Oculta en desktop (md:hidden) porque ahí los paneles ya son
          columnas visibles siempre. */}
      <div className="md:hidden flex border-t border-stone-200 bg-white">
        <button
          onClick={() => setMobileSheet("templates")}
          className="flex-1 py-3 text-sm font-medium text-stone-700 border-r border-stone-200"
        >
          Plantillas
        </button>
        <button
          onClick={() => setMobileSheet("properties")}
          className="flex-1 py-3 text-sm font-medium text-stone-700"
        >
          {selectedElement ? "Propiedades" : "+ Añadir dato"}
        </button>
      </div>

      {mobileSheet && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileSheet(null)}
          />
          <div className="relative bg-white rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-center mb-2">
              <div className="w-10 h-1 rounded-full bg-stone-300" />
            </div>
            {mobileSheet === "templates" ? (
              <TemplatePanel
                activeTemplateId={templateId}
                isCustomTemplateActive={usingCustomTemplate}
                hasCustomTemplate={!!editorData.customStickerTemplate}
                onSelectTemplate={(id) => {
                  handleSelectTemplate(id);
                  setMobileSheet(null);
                }}
                onSelectCustomTemplate={() => {
                  handleSelectCustomTemplate();
                  setMobileSheet(null);
                }}
                onSaveCustomTemplate={handleSaveTemplate}
                isSaving={isSavingTemplate}
              />
            ) : (
              <PropertiesPanel
                selectedElement={selectedElement}
                availableFieldIds={availableFieldIds}
                activeFieldIds={activeFieldIds}
                onToggleVisible={handleToggleVisible}
                onScaleChange={handleResize}
                onAddField={(fieldId) => {
                  handleAddField(fieldId);
                  setMobileSheet(null);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
