import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const all = await client.query(api.races.systemListAll, {});
  console.log("Total carreras en BBDD:", all.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
