import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, {});
  // Una de Tashkent
  const t = r.find((x: any) => x.name === "Tashkent New Year Marathon 2026");
  if (!t) return;
  console.log("Doc completo:");
  console.log(JSON.stringify(t, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
