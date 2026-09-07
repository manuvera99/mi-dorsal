"use client";

/**
 * Sistema de toast minimalista para mi-dorsal.
 *
 * Stack máximo 3 toasts, auto-dismiss configurable, mobile-first
 * (en móvil ocupa el ancho con padding, en desktop se pega abajo a la
 * derecha). Sin librería externa — solo Tailwind + context.
 *
 * Uso:
 *   const toast = useToast();
 *   toast.show({ title: "Dorsal guardado", variant: "success", action: { label: "Ver", href: "/calendario" } });
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "info" | "warning" | "default";

export interface ToastAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms antes de auto-cerrar. Default 5000. Pon 0 para que no se cierre solo. */
  durationMs?: number;
  action?: ToastAction;
}

interface Toast extends Required<Omit<ToastInput, "description" | "action">> {
  id: string;
  description?: string;
  action?: ToastAction;
}

interface ToastContextValue {
  show: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const MAX_STACK = 3;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastContextValue["show"]>((toast) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const newToast: Toast = {
      id,
      title: toast.title,
      description: toast.description,
      variant: toast.variant ?? "default",
      durationMs: toast.durationMs ?? 5000,
      action: toast.action,
    };
    setToasts((prev) => {
      const next = [...prev, newToast];
      // Mantener solo los últimos MAX_STACK
      return next.length > MAX_STACK ? next.slice(-MAX_STACK) : next;
    });
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="fixed bottom-0 inset-x-0 md:inset-x-auto md:right-4 md:bottom-4 z-[200] flex flex-col gap-2 p-3 md:p-0 md:w-full md:max-w-sm pointer-events-none"
      role="region"
      aria-label="Notificaciones"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  // Auto-dismiss
  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const t = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(t);
  }, [toast.id, toast.durationMs, onDismiss]);

  const Icon =
    toast.variant === "success"
      ? Check
      : toast.variant === "info"
        ? Info
        : toast.variant === "warning"
          ? AlertTriangle
          : null;

  return (
    <div
      role={toast.variant === "warning" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto bg-white rounded-xl shadow-lg border border-stone-200 p-3.5 flex items-start gap-3 animate-fade-in",
        toast.variant === "success" && "border-l-4 border-l-runner-accent",
        toast.variant === "warning" && "border-l-4 border-l-yellow-500",
        toast.variant === "info" && "border-l-4 border-l-blue-500",
      )}
    >
      {Icon && (
        <Icon
          aria-hidden="true"
          className={cn(
            "h-5 w-5 mt-0.5 flex-shrink-0",
            toast.variant === "success"
              ? "text-runner-accent"
              : toast.variant === "warning"
                ? "text-yellow-600"
                : toast.variant === "info"
                  ? "text-blue-600"
                  : "text-stone-500",
          )}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-900 leading-snug">
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
            {toast.description}
          </p>
        )}
        {toast.action &&
          (toast.action.href ? (
            <Link
              href={toast.action.href}
              onClick={() => onDismiss(toast.id)}
              className="text-xs font-semibold text-runner-primary hover:underline mt-1 inline-block"
            >
              {toast.action.label}
            </Link>
          ) : (
            <button
              onClick={() => {
                toast.action?.onClick?.();
                onDismiss(toast.id);
              }}
              className="text-xs font-semibold text-runner-primary hover:underline mt-1"
            >
              {toast.action.label}
            </button>
          ))}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex-shrink-0 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
