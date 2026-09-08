import { redirect } from "next/navigation";

// =============================================================================
// mi-dorsal — /cuenta
// =============================================================================
// Por ahora solo hay un sub-destino: /cuenta/suscripcion. En el futuro
// se podrán añadir /cuenta/facturas, /cuenta/notificaciones, etc. — cada
// uno como sub-ruta propia.
// =============================================================================

export default function CuentaPage() {
  // Por ahora redirigimos a la única sub-página disponible. Cuando se
  // añadan más (/cuenta/facturas, /cuenta/notificaciones), esto se
  // convierte en un índice con links a cada una.
  redirect("/cuenta/suscripcion");
}
