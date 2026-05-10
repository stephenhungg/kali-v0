/**
 * Citation rendering helpers.
 *
 * The system prompt instructs Claude to mark citations inline with
 * `[N]` style markers (e.g. "lapsed donors who attended the gala [1][2]").
 * Each `[N]` is a 1-based index into the `citations` array surfaced on
 * the `done` event of an agent run.
 *
 * The chat UI takes the answer text + citation list and renders the
 * markers as clickable chips that open the source record.
 *
 * This module:
 *   - parseCitationMarkers(text)        — find every [N] marker with span
 *   - extractCitedNumbers(text)         — unique sorted [N] numbers
 *   - buildCitationMap(citations)       — index → kali_entity_id lookup
 *   - dropCitationMarkers(text)         — strip [N]s for non-rendering UIs
 */

const MARKER_RE = /\[(\d+)\]/g;

export interface CitationMarker {
  /** Character position (0-based) where the marker starts. */
  start: number;
  /** Character position (exclusive) where the marker ends. */
  end: number;
  /** The 1-based index inside the brackets. */
  n: number;
  /** The literal substring that matched (e.g. "[1]"). */
  raw: string;
}

/**
 * Parse every `[N]` marker in `text`. Returns markers in the order they
 * appear. Stable + idempotent: parsing the same text twice yields equal
 * arrays.
 */
export function parseCitationMarkers(text: string): CitationMarker[] {
  const out: CitationMarker[] = [];
  // Reset regex state — `g` flag has stateful lastIndex.
  MARKER_RE.lastIndex = 0;
  for (const m of text.matchAll(MARKER_RE)) {
    if (m.index === undefined) continue;
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      n: parseInt(m[1], 10),
      raw: m[0],
    });
  }
  return out;
}

/**
 * Unique sorted set of citation numbers referenced in the answer text.
 * Useful for the UI to render a "Sources" section that lists only the
 * numbers actually cited (vs every record the agent touched).
 */
export function extractCitedNumbers(text: string): number[] {
  const set = new Set<number>();
  for (const m of parseCitationMarkers(text)) set.add(m.n);
  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Build a 1-based index → kali_entity_id lookup. Reflects the order
 * surfaced on the `done` event.
 */
export function buildCitationMap(
  citations: string[],
): Record<number, string> {
  const map: Record<number, string> = {};
  for (let i = 0; i < citations.length; i++) map[i + 1] = citations[i];
  return map;
}

/**
 * Filter out citation indices that don't have a corresponding entry in
 * the citation map (the model hallucinated a number). Returns the
 * subset that's actually resolvable.
 */
export function resolveCitedNumbers(
  text: string,
  citations: string[],
): Array<{ n: number; kali_entity_id: string }> {
  const map = buildCitationMap(citations);
  const out: Array<{ n: number; kali_entity_id: string }> = [];
  for (const n of extractCitedNumbers(text)) {
    const id = map[n];
    if (id) out.push({ n, kali_entity_id: id });
  }
  return out;
}

/**
 * Strip every `[N]` marker from the answer (no surrounding whitespace
 * cleanup). Useful for UIs that don't render citation chips and want
 * the bare prose.
 */
export function dropCitationMarkers(text: string): string {
  return text.replace(MARKER_RE, "");
}
