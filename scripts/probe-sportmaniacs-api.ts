// =============================================================================
// scripts/probe-sportmaniacs-api.ts
// =============================================================================
// Explora la API REST pública de Sportmaniacs (¡recién descubierta!)
// =============================================================================

const BASE = "https://api-aws.sportmaniacs.com/api";

async function probe(path: string) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();
  console.log(`  ${res.status} ${url}`);
  console.log(`    CT: ${ct.split(";")[0]}, size: ${text.length}`);
  if (res.status === 200) {
    try {
      const data = JSON.parse(text);
      console.log(`    Keys: ${Object.keys(data).join(", ")}`);
      if (data.data && Array.isArray(data.data)) {
        console.log(`    data[] length: ${data.data.length}`);
        if (data.data.length > 0) {
          console.log(`    First item keys: ${Object.keys(data.data[0]).join(", ")}`);
          console.log(`    First item: ${JSON.stringify(data.data[0], null, 2).slice(0, 500)}...`);
        }
      }
    } catch {
      console.log(`    No JSON: ${text.slice(0, 200)}`);
    }
  }
}

async function main() {
  console.log("Sportmaniacs API — Endpoints principales");

  await probe("/races?limit=1");
  await probe("/races?limit=5");
  await probe("/races?page=1&limit=5");
  await probe("/races?from=2026-09-01&to=2026-12-31&limit=5");
  await probe("/races/search?q=murcia&limit=3");
  await probe("/races/types");
  await probe("/races/categories");
  await probe("/races/provinces");
  await probe("/races/cities");
  await probe("/races/disciplines");
  await probe("/races?province=murcia&limit=2");
  await probe("/races?from=2026-09-01&limit=2");
  await probe("/races?type=trail&limit=2");
  await probe("/races?order=date&dir=asc&limit=2");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
