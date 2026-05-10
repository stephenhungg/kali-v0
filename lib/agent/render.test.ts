import { describe, expect, test } from "bun:test";
import {
  tokenizeAnswer,
  tokensToMarkdown,
  tokensToPlainText,
  type AnswerToken,
} from "./render";

function reconstruct(tokens: AnswerToken[]): string {
  return tokens.map((t) => (t.kind === "text" ? t.value : t.raw)).join("");
}

describe("tokenizeAnswer", () => {
  test("returns empty for empty answer", () => {
    expect(tokenizeAnswer("", [])).toEqual([]);
  });

  test("text-only answer becomes a single text token", () => {
    const out = tokenizeAnswer("Hello world.", ["ppl_a"]);
    expect(out).toEqual([{ kind: "text", value: "Hello world." }]);
  });

  test("interleaves text and chip tokens", () => {
    const out = tokenizeAnswer(
      "Top donors [1] and [2] this quarter.",
      ["ppl_a", "ppl_b"],
    );
    expect(out).toEqual([
      { kind: "text", value: "Top donors " },
      { kind: "chip", n: 1, kali_entity_id: "ppl_a", raw: "[1]" },
      { kind: "text", value: " and " },
      { kind: "chip", n: 2, kali_entity_id: "ppl_b", raw: "[2]" },
      { kind: "text", value: " this quarter." },
    ]);
  });

  test("unresolved marker stays as plain text (no clickable chip)", () => {
    const out = tokenizeAnswer("Reference [99] that doesn't exist.", ["ppl_a"]);
    // [99] is unresolved → keep as text token
    expect(out).toEqual([
      { kind: "text", value: "Reference " },
      { kind: "text", value: "[99]" },
      { kind: "text", value: " that doesn't exist." },
    ]);
  });

  test("adjacent markers get distinct chips", () => {
    const out = tokenizeAnswer("[1][2][3]", ["a", "b", "c"]);
    expect(out.filter((t) => t.kind === "chip").length).toBe(3);
    expect(out.filter((t) => t.kind === "text").length).toBe(0);
  });

  test("chip-then-text-then-chip", () => {
    const out = tokenizeAnswer("[1] x [2]", ["a", "b"]);
    expect(out).toEqual([
      { kind: "chip", n: 1, kali_entity_id: "a", raw: "[1]" },
      { kind: "text", value: " x " },
      { kind: "chip", n: 2, kali_entity_id: "b", raw: "[2]" },
    ]);
  });

  test("LOSSLESS: concatenating tokens reproduces the answer", () => {
    const cases: Array<[string, string[]]> = [
      ["plain text", []],
      ["[1] start", ["a"]],
      ["end [1]", ["a"]],
      ["[1] mid [2]", ["a", "b"]],
      ["[99] hallucinated [1]", ["a"]],
      ["", []],
    ];
    for (const [answer, citations] of cases) {
      expect(reconstruct(tokenizeAnswer(answer, citations))).toBe(answer);
    }
  });

  test("multi-digit indices resolve correctly", () => {
    const citations = Array.from({ length: 12 }, (_, i) => `e_${i}`);
    const out = tokenizeAnswer("Top [10] and [12]", citations);
    const chips = out.filter((t): t is Extract<AnswerToken, { kind: "chip" }> => t.kind === "chip");
    expect(chips[0].kali_entity_id).toBe("e_9");
    expect(chips[1].kali_entity_id).toBe("e_11");
  });
});

describe("tokensToMarkdown", () => {
  test("renders chips as [N](kali:<id>) Markdown links", () => {
    const tokens = tokenizeAnswer("Found [1] donor.", ["ppl_a"]);
    expect(tokensToMarkdown(tokens)).toBe("Found [1](kali:ppl_a) donor.");
  });

  test("text-only round-trips", () => {
    expect(tokensToMarkdown(tokenizeAnswer("plain", []))).toBe("plain");
  });
});

describe("tokensToPlainText", () => {
  test("drops chips entirely", () => {
    const tokens = tokenizeAnswer("Top [1] and [2] donors.", ["a", "b"]);
    expect(tokensToPlainText(tokens)).toBe("Top  and  donors.");
  });

  test("trims surrounding whitespace", () => {
    expect(tokensToPlainText(tokenizeAnswer(" hello ", []))).toBe("hello");
  });
});
