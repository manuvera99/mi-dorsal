// Diagnóstico: carga https://mi-dorsal.vercel.app/ con playwright y captura errores JS
import { chromium } from "playwright";

const url = process.argv[2] || "https://mi-dorsal.vercel.app/";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleMsgs = [];
const pageErrors = [];
const failedRequests = [];

page.on("console", (msg) => {
  consoleMsgs.push({ type: msg.type(), text: msg.text() });
});
page.on("pageerror", (err) => {
  pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
});
page.on("requestfailed", (req) => {
  failedRequests.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText });
});
page.on("response", (resp) => {
  if (resp.status() >= 400) {
    failedRequests.push({ url: resp.url(), method: resp.request().method(), status: resp.status() });
  }
});

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  console.log("=== PAGE LOADED ===");
  console.log("Title:", await page.title());
  console.log("URL final:", page.url());
  const body = await page.locator("body").textContent();
  console.log("Body length:", body?.length || 0);
  console.log("Body has 'mi-dorsal':", body?.includes("mi-dorsal"));
  console.log("Body has 'Planifica':", body?.includes("Planifica"));
} catch (e) {
  console.log("=== NAV ERROR ===");
  console.log(e.message);
}

console.log("\n=== PAGE ERRORS ===");
for (const e of pageErrors) {
  console.log("- " + e.name + ": " + e.message);
  if (e.stack) console.log(e.stack.split("\n").slice(0, 5).join("\n"));
}

console.log("\n=== CONSOLE (red + warnings) ===");
for (const m of consoleMsgs) {
  if (m.type === "error" || m.type === "warning") {
    console.log("[" + m.type + "] " + m.text.substring(0, 500));
  }
}

console.log("\n=== FAILED REQUESTS ===");
for (const f of failedRequests) {
  console.log("- " + (f.status || f.failure) + " " + f.method + " " + f.url);
}

await browser.close();
