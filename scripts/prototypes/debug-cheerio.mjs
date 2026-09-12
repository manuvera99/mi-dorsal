// Debug: ver qué hace cheerio con el título y los iconos
import * as cheerio from "cheerio";

const url = "https://carreraspopulares.com/calendario_carreras/lista/jtNyeA/carreras_con_circuito_homologado?page=1";
const res = await fetch(url, {
  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
});
const html = await res.text();

const $ = cheerio.load(html, { decodeEntities: true });
const $first = $("div.fichaEdicion").first();
console.log("h4:", $first.find("h4 a").text().trim());

// Ver los iconos
$first.find("img.feature-icon").each((i, el) => {
  const title = $(el).attr("title");
  console.log(`  icono ${i}: title='${title}'  (length=${title?.length})`);
});

// Ver si los servicios salen como entidades HTML
const pHtml = $first.find(".infoPruebaListaKK p").html();
console.log("\nHTML del p (primeros 600 chars):", pHtml?.substring(0, 600));

// Decodificar manualmente
const decoded = pHtml?.replace(/&#?\w+;/g, (m) => {
  const txt = new TextDecoder("utf-8").decode(new TextEncoder().encode(m));
  return txt;
});
console.log("\nTexto decodificado manual:", decoded?.substring(0, 600));
