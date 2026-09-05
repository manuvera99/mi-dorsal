// =============================================================================
// mi-dorsal — MarkdownRenderer (renderer ligero para el blog)
// =============================================================================
// Renderiza markdown a HTML con un subset seguro: headings, párrafos, listas,
// blockquotes, negrita/cursiva, links, imágenes. NO permite HTML inline ni
// scripts (protección XSS).
//
// Lo usamos en el blog porque el contenido es markdown puro. Para contenido
// más complejo (MDX con componentes React), usar next-mdx-remote.
// =============================================================================

import { cn } from "@/lib/utils";

type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; text: string; lang?: string }
  | { type: "hr" };

// Matcher regex compilados una sola vez (top-level)
const RE_HR = /^---\s*$/;
const RE_H2 = /^##\s+(.+)$/;
const RE_H3 = /^###\s+(.+)$/;
const RE_QUOTE = /^>\s+(.+)$/;
const RE_CODE = /^```(\w*)\s*$/;
const RE_UL = /^[-*]\s+(.+)$/;
const RE_OL = /^\d+\.\s+(.+)$/;
const RE_IMG = /^!\[([^\]]*)\]\(([^)]+)\)$/;

/**
 * Parser markdown minimalista. Devuelve un array de bloques que el renderer
 * pinta. NO usa dangerouslySetInnerHTML — los textos se renderizan con
 * React (auto-escape).
 */
function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  let paraBuf: string[] = [];
  let listBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let inCode = false;
  let codeBuf: string[] = [];
  let codeLang = "";

  const flushPara = () => {
    if (paraBuf.length > 0) {
      blocks.push({ type: "p", text: paraBuf.join(" ") });
      paraBuf = [];
    }
  };
  const flushList = () => {
    if (listBuf.length > 0 && listType) {
      blocks.push({ type: listType, items: listBuf });
      listBuf = [];
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    const codeStart = line.match(RE_CODE);
    if (codeStart) {
      flushPara();
      flushList();
      if (inCode) {
        blocks.push({ type: "code", text: codeBuf.join("\n"), lang: codeLang });
        codeBuf = [];
        codeLang = "";
        inCode = false;
      } else {
        inCode = true;
        codeLang = codeStart[1] || "";
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }

    // HR
    if (RE_HR.test(line)) {
      flushPara();
      flushList();
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // H2
    const h2 = line.match(RE_H2);
    if (h2) {
      flushPara();
      flushList();
      blocks.push({ type: "h2", text: h2[1].trim() });
      i++;
      continue;
    }
    // H3
    const h3 = line.match(RE_H3);
    if (h3) {
      flushPara();
      flushList();
      blocks.push({ type: "h3", text: h3[1].trim() });
      i++;
      continue;
    }

    // Quote
    const q = line.match(RE_QUOTE);
    if (q) {
      flushPara();
      flushList();
      blocks.push({ type: "quote", text: q[1].trim() });
      i++;
      continue;
    }

    // UL
    const ul = line.match(RE_UL);
    if (ul) {
      flushPara();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listBuf.push(ul[1].trim());
      i++;
      continue;
    }
    // OL
    const ol = line.match(RE_OL);
    if (ol) {
      flushPara();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listBuf.push(ol[1].trim());
      i++;
      continue;
    }

    // Línea vacía = fin de párrafo/lista
    if (line.trim() === "") {
      flushPara();
      flushList();
      i++;
      continue;
    }

    // Párrafo (acumular hasta línea vacía)
    paraBuf.push(line);
    i++;
  }
  flushPara();
  flushList();
  return blocks;
}

/**
 * Render inline: **bold**, *italic*, [text](url), `code`. Devuelve ReactNode.
 * Implementación simple — para casos más raros (links anidados, escape) se
 * puede mejorar.
 */
import { Fragment, type ReactNode } from "react";

function renderInline(text: string, keyPrefix: string): ReactNode {
  // Tokenizar con regex: **, *, `, [..](..)
  // Estrategia: split por tokens, mantener pila.
  const nodes: ReactNode[] = [];
  let remaining = text;
  let idx = 0;
  const max = 200; // safety contra loops infinitos
  let safety = 0;

  while (remaining.length > 0 && safety < max) {
    safety++;
    // Buscar el primer token especial
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const italicMatch = remaining.match(/(^|[^*])\*([^*]+)\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const imgMatch = remaining.match(/!\[([^\]]*)\]\(([^)]+)\)/);

    const candidates: Array<{ pos: number; kind: string; m: RegExpMatchArray }> = [];
    if (boldMatch) candidates.push({ pos: boldMatch.index ?? -1, kind: "bold", m: boldMatch });
    if (italicMatch && italicMatch.index !== undefined) {
      // Ajuste: italicMatch.index apunta al char anterior, sumamos 1 si no es inicio
      const start = italicMatch[1] ? italicMatch.index + 1 : italicMatch.index;
      candidates.push({ pos: start, kind: "italic", m: italicMatch });
    }
    if (codeMatch) candidates.push({ pos: codeMatch.index ?? -1, kind: "code", m: codeMatch });
    if (linkMatch) candidates.push({ pos: linkMatch.index ?? -1, kind: "link", m: linkMatch });
    if (imgMatch) candidates.push({ pos: imgMatch.index ?? -1, kind: "img", m: imgMatch });

    if (candidates.length === 0) {
      nodes.push(remaining);
      break;
    }

    candidates.sort((a, b) => a.pos - b.pos);
    const first = candidates[0];
    if (first.pos > 0) {
      nodes.push(remaining.slice(0, first.pos));
    }
    const before = remaining.slice(0, first.pos);
    if (first.kind === "bold") {
      nodes.push(<strong key={`${keyPrefix}-b-${idx++}`}>{first.m[1]}</strong>);
      remaining = remaining.slice(first.pos + first.m[0].length);
    } else if (first.kind === "italic") {
      nodes.push(<em key={`${keyPrefix}-i-${idx++}`}>{first.m[2]}</em>);
      remaining = remaining.slice(first.pos + first.m[0].length);
    } else if (first.kind === "code") {
      nodes.push(
        <code key={`${keyPrefix}-c-${idx++}`} className="px-1.5 py-0.5 rounded bg-gray-100 text-sm font-mono text-pink-700">
          {first.m[1]}
        </code>,
      );
      remaining = remaining.slice(first.pos + first.m[0].length);
    } else if (first.kind === "link") {
      const url = first.m[2];
      const external = /^https?:\/\//.test(url);
      nodes.push(
        <a
          key={`${keyPrefix}-l-${idx++}`}
          href={url}
          className="text-runner-primary underline hover:no-underline"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {first.m[1]}
        </a>,
      );
      remaining = remaining.slice(first.pos + first.m[0].length);
    } else if (first.kind === "img") {
      nodes.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${keyPrefix}-im-${idx++}`}
          src={first.m[2]}
          alt={first.m[1]}
          className="rounded-lg my-4 max-w-full h-auto"
          loading="lazy"
        />,
      );
      remaining = remaining.slice(first.pos + first.m[0].length);
    }
  }

  return nodes.map((n, i) => <Fragment key={`${keyPrefix}-${i}`}>{n}</Fragment>);
}

export function MarkdownRenderer({ content }: { content: string }) {
  const blocks = parseMarkdown(content);

  return (
    <div className="prose-content">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2
                key={i}
                className="text-2xl font-bold mt-10 mb-4 text-gray-900 scroll-mt-24"
                id={slugifyHeading(b.text)}
              >
                {renderInline(b.text, `h2-${i}`)}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={i}
                className="text-xl font-semibold mt-7 mb-3 text-gray-900 scroll-mt-24"
                id={slugifyHeading(b.text)}
              >
                {renderInline(b.text, `h3-${i}`)}
              </h3>
            );
          case "p":
            return (
              <p key={i} className="text-[17px] leading-[1.7] mb-5 text-gray-800">
                {renderInline(b.text, `p-${i}`)}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc pl-6 mb-5 space-y-1.5 text-[17px] text-gray-800">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `ul-${i}-${j}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal pl-6 mb-5 space-y-1.5 text-[17px] text-gray-800">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `ol-${i}-${j}`)}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="border-l-4 border-runner-primary pl-5 py-1 my-6 text-gray-700 italic"
              >
                {renderInline(b.text, `q-${i}`)}
              </blockquote>
            );
          case "code":
            return (
              <pre
                key={i}
                className="bg-gray-950 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm my-5 font-mono"
              >
                <code>{b.text}</code>
              </pre>
            );
          case "hr":
            return <hr key={i} className="my-8 border-gray-200" />;
        }
      })}
    </div>
  );
}

function slugifyHeading(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
