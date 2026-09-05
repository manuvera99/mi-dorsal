// Publica el post via API HTTP de Convex con auth
const deploymentUrl = "https://precious-goshawk-41.convex.cloud";
const postId = "kn74tmsrvx4dzyck1xa8d7ek258dvv0q";
const fs = await import("fs");
const { accessToken } = JSON.parse(
  fs.readFileSync("C:/Users/Usuario/.convex/config.json", "utf-8"),
);

const body = {
  path: "blog:publish",
  args: { id: postId },
  format: "json",
};

try {
  const res = await fetch(`${deploymentUrl}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
  if (!res.ok) process.exit(1);
} catch (e) {
  console.error("❌", e?.message ?? e);
  process.exit(1);
}
