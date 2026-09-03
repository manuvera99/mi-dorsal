// Test todas las páginas públicas para ver cuál peta
import { chromium } from "playwright";

const urls = [
  "https://mi-dorsal.vercel.app/",
  "https://mi-dorsal.vercel.app/carreras",
  "https://mi-dorsal.vercel.app/ranking",
  "https://mi-dorsal.vercel.app/admin",
  "https://mi-dorsal.vercel.app/admin/races",
  "https://mi-dorsal.vercel.app/admin/users",
];

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const errors = [];

page.on("pageerror", (err) => {
  errors.push({ name: err.name, msg: err.message });
});
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push({ type: "console", text: msg.text() });
});

for (const url of urls) {
  errors.length = 0;
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1500);
    const text = await page.locator("body").textContent();
    console.log(`[${resp.status()}] ${url} - body length: ${text?.length || 0}`);
    if (text?.includes("Application error") || text?.includes("client-side exception")) {
      console.log("  ❌ TEXTO DE ERROR DETECTADO");
    }
    if (errors.length > 0) {
      console.log("  Errors:");
      for (const e of errors) {
        console.log("    - " + (e.name || e.type) + ": " + (e.msg || e.text).substring(0, 300));
      }
    }
  } catch (e) {
    console.log(`[ERR] ${url}: ${e.message}`);
  }
}

await browser.close();
