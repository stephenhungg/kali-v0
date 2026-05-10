/**
 * Render-side helper for the chat UI.
 *
 * Takes a final answer string + the citation list from the `done` event,
 * and returns an ordered token array that's trivial to render:
 *
 *   tokenize("Found 3 lapsed donors. [1][2][3]", ["ppl_a", "ppl_b", "ppl_c"])
 *   // → [
 *   //     { kind: "text", value: "Found 3 lapsed donors. " },
 *   //     { kind: "chip", n: 1, kali_entity_id: "ppl_a", raw: "[1]" },
 *   //     { kind: "chip", n: 2, kali_entity_id: "ppl_b", raw: "[2]" },
 *   //     { kind: "chip", n: 3, kali_entity_id: "ppl_c", raw: "[3]" },
 *   //   ]
 *
 * Markers without a corresponding citation entry are returned as plain
 * `text` tokens (the model hallucinated a number; the UI shouldn't make
 * a clickable chip that goes nowhere).
 *
 * This module is pure / framework-free so the frontend can use it from
 * any rendering layer (React, Solid, plain DOM).
 */

import { buildCitationMap, parseCitationMarkers } from "./citations";

export type AnswerToken =
  | { kind: "text"; value: string }
  | {
      kind: "chip";
      /** 1-based index that appeared inside the [N] marker. */
      n: number;
      /** Resolved kali_entity_id from the citation list. */
      kali_entity_id: string;
      /** The literal substring the chip replaces (e.g. "[1]"). */
      raw: string;
    };

/**
 * Tokenize an answer for citation-chip rendering. The token sequence is
 * **lossless** — concatenating each token's text representation
 * reproduces the original answer string exactly:
 *
 *   tokens.map(t => t.kind === "text" ? t.value : t.raw).join("") === answer
 */
export function tokenizeAnswer(
  answer: string,
  citations: readonly string[],
): AnswerToken[] {
  const map = buildCitationMap([...citations]);
  const markers = parseCitationMarkers(answer);
  if (markers.length === 0) {
    return answer.length === 0 ? [] : [{ kind: "text", value: answer }];
  }

  const out: AnswerToken[] = [];
  let cursor = 0;
  for (const m of markers) {
    if (m.start > cursor) {
      out.push({ kind: "text", value: answer.slice(cursor, m.start) });
    }
    const id = map[m.n];
    if (id) {
      out.push({
        kind: "chip",
        n: m.n,
        kali_entity_id: id,
        raw: m.raw,
      });
    } else {
      // Unresolved marker — leave the literal `[N]` in the prose.
      out.push({ kind: "text", value: m.raw });
    }
    cursor = m.end;
  }
  if (cursor < answer.length) {
    out.push({ kind: "text", value: answer.slice(cursor) });
  }
  return out;
}

/**
 * Sketch of a Markdown serializer for the answer + citations. Renders
 * each chip as `[N](kali:<id>)` so a custom Markdown renderer can pick
 * it up.
 */
export function tokensToMarkdown(tokens: readonly AnswerToken[]): string {
  return tokens
    .map((t) =>
      t.kind === "text" ? t.value : `[${t.n}](kali:${t.kali_entity_id})`,
    )
    .join("");
}

/** Plain-text strip — drop chips entirely. Useful for accessibility / clipboard copy. */
export function tokensToPlainText(tokens: readonly AnswerToken[]): string {
  return tokens.map((t) => (t.kind === "text" ? t.value : "")).join("").trim();
}
