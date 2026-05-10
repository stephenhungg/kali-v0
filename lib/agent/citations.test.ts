import { describe, expect, test } from "bun:test";
import {
  buildCitationMap,
  dropCitationMarkers,
  extractCitedNumbers,
  parseCitationMarkers,
  resolveCitedNumbers,
} from "./citations";

describe("parseCitationMarkers", () => {
  test("returns empty for text with no markers", () => {
    expect(parseCitationMarkers("no citations here")).toEqual([]);
  });

  test("finds every marker with span + raw", () => {
    const text = "Top donors [1] include [2] and [3].";
    const markers = parseCitationMarkers(text);
    expect(markers).toHaveLength(3);
    expect(markers[0]).toEqual({ start: 11, end: 14, n: 1, raw: "[1]" });
    expect(markers[1].n).toBe(2);
    expect(markers[2].n).toBe(3);
  });

  test("handles multi-digit indices", () => {
    const markers = parseCitationMarkers("[10] [42] [123]");
    expect(markers.map((m) => m.n)).toEqual([10, 42, 123]);
  });

  test("ignores non-numeric brackets", () => {
    expect(parseCitationMarkers("[abc] [1.5] [-1] but [1] counts")).toHaveLength(1);
  });

  test("is idempotent (regex state reset between calls)", () => {
    const text = "[1] [2]";
    const a = parseCitationMarkers(text);
    const b = parseCitationMarkers(text);
    expect(a).toEqual(b);
  });
});

describe("extractCitedNumbers", () => {
  test("dedupes + sorts ascending", () => {
    const nums = extractCitedNumbers("[3] [1] [2] [1] [3]");
    expect(nums).toEqual([1, 2, 3]);
  });

  test("empty when no markers", () => {
    expect(extractCitedNumbers("no citations")).toEqual([]);
  });
});

describe("buildCitationMap", () => {
  test("1-indexes the citation list", () => {
    const map = buildCitationMap(["ppl_a", "ppl_b", "doc_c"]);
    expect(map[1]).toBe("ppl_a");
    expect(map[2]).toBe("ppl_b");
    expect(map[3]).toBe("doc_c");
    expect(map[0]).toBeUndefined();
  });

  test("empty list yields empty map", () => {
    expect(buildCitationMap([])).toEqual({});
  });
});

describe("resolveCitedNumbers", () => {
  test("returns only markers that have a corresponding citation", () => {
    const text = "Reference [1] and [3] (but not [99]).";
    const out = resolveCitedNumbers(text, ["ppl_a", "ppl_b", "doc_c"]);
    expect(out).toEqual([
      { n: 1, kali_entity_id: "ppl_a" },
      { n: 3, kali_entity_id: "doc_c" },
    ]);
  });

  test("empty when nothing cites or list empty", () => {
    expect(resolveCitedNumbers("no citations", ["x"])).toEqual([]);
    expect(resolveCitedNumbers("[1]", [])).toEqual([]);
  });
});

describe("dropCitationMarkers", () => {
  test("strips every marker", () => {
    expect(dropCitationMarkers("Donor[1] gave [2] last year.")).toBe(
      "Donor gave  last year.",
    );
  });

  test("no-ops on text without markers", () => {
    expect(dropCitationMarkers("clean text")).toBe("clean text");
  });
});
