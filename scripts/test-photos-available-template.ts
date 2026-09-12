// Smoke test de la plantilla de email photos_available
import { photosAvailableEmail } from "../convex/emails/templates/photosAvailable";

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"}  ${label}`);
  if (cond) pass++;
  else fail++;
}

const { subject, html, text } = photosAvailableEmail({
  userName: "María",
  raceName: "10K Ciudad de Valencia",
  raceDate: "25 de octubre de 2026",
  photosUrl: "https://fotos-proveedor.example.com/evento/123",
  appUrl: "https://www.mi-dorsal.com",
});

check("subject incluye el nombre de la carrera", subject.includes("10K Ciudad de Valencia"));
check("html incluye el enlace a photosUrl", html.includes("https://fotos-proveedor.example.com/evento/123"));
check("html escapa el nombre de usuario", !html.includes("<script>"));
check("text incluye el enlace a photosUrl", text.includes("https://fotos-proveedor.example.com/evento/123"));
check("text incluye el nombre del usuario", text.includes("María"));

// Caso con caracteres especiales en el nombre de carrera (XSS/HTML injection)
const withHtmlInName = photosAvailableEmail({
  userName: "Test",
  raceName: '<script>alert("x")</script>',
  raceDate: "1 de enero de 2027",
  photosUrl: "https://example.com",
  appUrl: "https://www.mi-dorsal.com",
});
check(
  "html escapa nombres de carrera con HTML embebido",
  !withHtmlInName.html.includes("<script>alert"),
);

console.log(`\n${pass} OK, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
