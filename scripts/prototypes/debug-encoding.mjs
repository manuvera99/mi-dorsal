// Debug rápido: ver en qué encoding llegan realmente los bytes.
const url = "https://carreraspopulares.com/calendario_carreras/lista/jtNyeA/carreras_con_circuito_homologado?page=1";
const res = await fetch(url, {
  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
});
const buf = new Uint8Array(await res.arrayBuffer());

// Buscar el primer "MITJA" en los bytes y mostrar 16 bytes alrededor
const needle = new TextEncoder().encode("MITJA");
let idx = -1;
for (let i = 0; i < buf.length - needle.length; i++) {
  let match = true;
  for (let j = 0; j < needle.length; j++) {
    if (buf[i + j] !== needle[j]) { match = false; break; }
  }
  if (match) { idx = i; break; }
}
console.log("Primer 'MITJA' en byte offset:", idx);
if (idx >= 0) {
  const around = Array.from(buf.slice(idx, idx + 30));
  console.log("  bytes (hex):", around.map((b) => b.toString(16).padStart(2, "0")).join(" "));
  console.log("  como latin1 :", new TextDecoder("latin1").decode(buf.slice(idx, idx + 30)));
  console.log("  como utf-8  :", new TextDecoder("utf-8").decode(buf.slice(idx, idx + 30)));
}

console.log("\nContent-Type header:", res.headers.get("content-type"));
