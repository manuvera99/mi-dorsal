// Quick test: call Convex query via HTTP API directly.
// Usage: node scripts/_test-convex-args.cjs <argsFile>
const https = require("https");
const fs = require("fs");

const DEPLOY_URL = "precious-goshawk-41.convex.cloud";
const argsFile = process.argv[2];
if (!argsFile) {
  console.error("Usage: node scripts/_test-convex-args.cjs <argsFile>");
  process.exit(1);
}
const argsJson = fs.readFileSync(argsFile, "utf8").trim();

const body = JSON.stringify({
  path: "races:list",
  args: JSON.parse(argsJson),
  format: "json",
});

const req = https.request(
  {
    hostname: DEPLOY_URL,
    path: "/api/query",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  },
  (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      if (res.statusCode !== 200) {
        console.error("HTTP", res.statusCode, data);
        return;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.status === "success") {
          const arr = parsed.value;
          console.log("Args:", argsJson);
          console.log("Total races returned:", arr.length);
          // Group by year
          const byYear = {};
          for (const r of arr) {
            const y = (r.startDate || "no-date").slice(0, 4);
            byYear[y] = (byYear[y] || 0) + 1;
          }
          console.log("By year:", byYear);
          // Sample
          if (arr.length > 0) {
            console.log("First:", arr[0].name, "->", arr[0].startDate);
            console.log("Last:", arr[arr.length - 1].name, "->", arr[arr.length - 1].startDate);
          }
        } else {
          console.error("Convex error:", JSON.stringify(parsed, null, 2));
        }
      } catch (e) {
        console.error("Parse error:", e.message);
        console.error("Raw:", data);
      }
    });
  }
);
req.on("error", (e) => console.error("Request error:", e.message));
req.write(body);
req.end();
