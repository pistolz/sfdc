import type { ReactNode } from "react";

/**
 * A small, dependency-free markdown renderer.
 *
 * It emits React elements rather than an HTML string, so model output is
 * escaped by React itself — there is no `dangerouslySetInnerHTML` anywhere in
 * this file and raw HTML inside the source is shown as literal text.
 *
 * Supported: ATX headings, paragraphs, bold/italic/strikethrough, inline code,
 * fenced code, links (http/https/mailto/relative only), unordered and ordered
 * lists with nesting, blockquotes, tables with alignment, and horizontal rules.
 */

const SAFE_HREF = /^(?:https?:\/\/|mailto:|#|\/)/i;

function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  return SAFE_HREF.test(href) ? href : null;
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\w]/.test(char);
}

/* -------------------------------------------------------------------------- */
/* Inline                                                                      */
/* -------------------------------------------------------------------------- */

function parseInline(src: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let buffer = "";
  let index = 0;
  let counter = 0;

  const flush = () => {
    if (buffer) {
      out.push(buffer);
      buffer = "";
    }
  };
  const push = (node: ReactNode) => {
    flush();
    out.push(node);
  };
  const key = () => `${keyBase}-${counter++}`;

  while (index < src.length) {
    const char = src[index];

    // Inline code — highest precedence, contents are never re-parsed.
    if (char === "`") {
      const close = src.indexOf("`", index + 1);
      if (close > index) {
        push(
          <code
            key={key()}
            className="rounded border border-border bg-surface-2 px-1 py-0.5 font-mono text-[0.85em] text-fg"
          >
            {src.slice(index + 1, close)}
          </code>,
        );
        index = close + 1;
        continue;
      }
    }

    if (src.startsWith("**", index)) {
      const close = src.indexOf("**", index + 2);
      if (close > index + 1) {
        push(
          <strong key={key()} className="font-semibold text-fg">
            {parseInline(src.slice(index + 2, close), key())}
          </strong>,
        );
        index = close + 2;
        continue;
      }
    }

    if (src.startsWith("~~", index)) {
      const close = src.indexOf("~~", index + 2);
      if (close > index + 1) {
        push(
          <s key={key()} className="text-muted">
            {parseInline(src.slice(index + 2, close), key())}
          </s>,
        );
        index = close + 2;
        continue;
      }
    }

    if (char === "*") {
      const close = src.indexOf("*", index + 1);
      if (close > index + 1 && !src.slice(index + 1, close).includes("\n")) {
        push(
          <em key={key()}>{parseInline(src.slice(index + 1, close), key())}</em>,
        );
        index = close + 1;
        continue;
      }
    }

    // Underscore emphasis only outside words, so snake_case survives intact.
    if (char === "_" && !isWordChar(src[index - 1])) {
      const close = src.indexOf("_", index + 1);
      if (
        close > index + 1 &&
        !isWordChar(src[close + 1]) &&
        !src.slice(index + 1, close).includes("\n")
      ) {
        push(
          <em key={key()}>{parseInline(src.slice(index + 1, close), key())}</em>,
        );
        index = close + 1;
        continue;
      }
    }

    if (char === "[") {
      const closeText = src.indexOf("]", index + 1);
      if (closeText > index && src[closeText + 1] === "(") {
        const closeHref = src.indexOf(")", closeText + 2);
        if (closeHref > closeText) {
          const label = src.slice(index + 1, closeText);
          const target = src.slice(closeText + 2, closeHref).split(/\s+/)[0];
          const href = safeHref(target);
          if (href) {
            push(
              <a
                key={key()}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="text-accent-text underline underline-offset-2 hover:opacity-80"
              >
                {parseInline(label, key())}
              </a>,
            );
          } else {
            // Unsupported scheme (javascript:, data:, …) degrades to plain text.
            push(<span key={key()}>{`${label} (${target})`}</span>);
          }
          index = closeHref + 1;
          continue;
        }
      }
    }

    buffer += char;
    index += 1;
  }

  flush();
  return out;
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                      */
/* -------------------------------------------------------------------------- */

const HEADING = /^(#{1,6})\s+(.*)$/;
const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
const UL_ITEM = /^(\s*)[-*+]\s+(.*)$/;
const OL_ITEM = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_DIVIDER = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

const HEADING_CLASSES = [
  "mt-8 mb-3 text-2xl font-semibold tracking-tight first:mt-0",
  "mt-8 mb-3 text-xl font-semibold tracking-tight first:mt-0",
  "mt-6 mb-2 text-lg font-semibold tracking-tight first:mt-0",
  "mt-5 mb-2 text-base font-semibold first:mt-0",
  "mt-4 mb-1.5 text-sm font-semibold first:mt-0",
  "mt-4 mb-1.5 text-sm font-semibold text-muted first:mt-0",
];

function splitCells(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function alignmentOf(cell: string): "left" | "center" | "right" {
  const value = cell.trim();
  if (value.startsWith(":") && value.endsWith(":")) return "center";
  if (value.endsWith(":")) return "right";
  return "left";
}

function parseBlocks(lines: string[], keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let counter = 0;
  const key = () => `${keyBase}-b${counter++}`;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Fenced code
    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const body: string[] = [];
      i += 1;
      while (i < lines.length) {
        const closing = FENCE.exec(lines[i]);
        if (closing && closing[1][0] === marker) {
          i += 1;
          break;
        }
        body.push(lines[i]);
        i += 1;
      }
      out.push(
        <div key={key()} className="scroll-x my-4 rounded-lg border border-border bg-surface-2">
          <pre className="p-4 font-mono text-[13px] leading-relaxed">
            <code>{body.join("\n")}</code>
          </pre>
        </div>,
      );
      continue;
    }

    if (HR.test(line)) {
      out.push(<hr key={key()} className="my-8 border-t border-border" />);
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${Math.min(level + 1, 6)}` as
        | "h2"
        | "h3"
        | "h4"
        | "h5"
        | "h6";
      out.push(
        <Tag key={key()} className={HEADING_CLASSES[level - 1]}>
          {parseInline(heading[2], key())}
        </Tag>,
      );
      i += 1;
      continue;
    }

    // Table: a header row immediately followed by a divider row.
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      lines[i + 1].includes("-") &&
      TABLE_DIVIDER.test(lines[i + 1])
    ) {
      const header = splitCells(line);
      const aligns = splitCells(lines[i + 1]).map(alignmentOf);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitCells(lines[i]));
        i += 1;
      }
      out.push(
        <div
          key={key()}
          className="scroll-x my-5 rounded-lg border border-border"
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-2">
                {header.map((cell, index) => (
                  <th
                    key={index}
                    scope="col"
                    style={{ textAlign: aligns[index] ?? "left" }}
                    className="border-b border-border px-3 py-2 font-semibold whitespace-nowrap"
                  >
                    {parseInline(cell, `${keyBase}-th${index}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border last:border-0">
                  {header.map((_, cellIndex) => (
                    <td
                      key={cellIndex}
                      style={{ textAlign: aligns[cellIndex] ?? "left" }}
                      className="px-3 py-2 align-top text-muted"
                    >
                      {parseInline(row[cellIndex] ?? "", `${keyBase}-td${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        body.push(QUOTE.exec(lines[i])?.[1] ?? "");
        i += 1;
      }
      out.push(
        <blockquote
          key={key()}
          className="my-4 border-l-2 border-accent-soft-border pl-4 text-muted italic"
        >
          {parseBlocks(body, key())}
        </blockquote>,
      );
      continue;
    }

    // Lists (nested items are re-parsed as blocks)
    const isUl = UL_ITEM.test(line);
    const isOl = OL_ITEM.test(line);
    if (isUl || isOl) {
      const pattern = isUl ? UL_ITEM : OL_ITEM;
      const baseIndent = (pattern.exec(line)?.[1] ?? "").length;
      const items: string[][] = [];

      while (i < lines.length) {
        const current = lines[i];
        const match = pattern.exec(current);
        const indent = (match?.[1] ?? "").length;

        if (match && indent <= baseIndent) {
          items.push([isUl ? match[2] : match[3]]);
          i += 1;
          continue;
        }
        // Continuation or nested content belongs to the previous item.
        if (items.length && current.trim() && current.startsWith(" ")) {
          items[items.length - 1].push(current.slice(baseIndent + 2));
          i += 1;
          continue;
        }
        if (items.length && !current.trim()) {
          const next = lines[i + 1];
          if (next && next.startsWith(" ".repeat(baseIndent + 2))) {
            items[items.length - 1].push("");
            i += 1;
            continue;
          }
        }
        break;
      }

      const listClass = isUl
        ? "my-4 list-disc space-y-1.5 pl-5 marker:text-faint"
        : "my-4 list-decimal space-y-1.5 pl-5 marker:text-faint";
      const children = items.map((item, index) => (
        <li key={index} className="pl-1 leading-relaxed">
          {item.length === 1
            ? parseInline(item[0], `${keyBase}-li${index}`)
            : parseBlocks(item, `${keyBase}-li${index}`)}
        </li>
      ));

      out.push(
        isUl ? (
          <ul key={key()} className={listClass}>
            {children}
          </ul>
        ) : (
          <ol key={key()} className={listClass}>
            {children}
          </ol>
        ),
      );
      continue;
    }

    // Paragraph
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING.test(lines[i]) &&
      !HR.test(lines[i]) &&
      !FENCE.test(lines[i]) &&
      !QUOTE.test(lines[i]) &&
      !UL_ITEM.test(lines[i]) &&
      !OL_ITEM.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    if (!paragraph.length) {
      // Defensive: never spin without consuming a line.
      paragraph.push(lines[i]);
      i += 1;
    }
    out.push(
      <p key={key()} className="my-3 leading-relaxed whitespace-pre-line">
        {parseInline(paragraph.join("\n"), key())}
      </p>,
    );
  }

  return out;
}

export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  return (
    <div className={className}>{parseBlocks(lines, "md")}</div>
  );
}
