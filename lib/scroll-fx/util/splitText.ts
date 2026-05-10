// Vanilla word/char splitter — no GSAP premium SplitText required.
// Wraps each unit in an inline-block <span> so transforms work cleanly.
// Returns the spans for direct manipulation by gsap.

export type SplitMode = "words" | "chars";

export interface SplitResult {
  units: HTMLSpanElement[];
  cleanup: () => void;
}

export function splitText(el: HTMLElement, mode: SplitMode = "words"): SplitResult {
  const original = el.innerHTML;
  const text = el.textContent ?? "";
  const units: HTMLSpanElement[] = [];

  if (mode === "words") {
    const words = text.split(/(\s+)/);
    el.innerHTML = "";
    for (const piece of words) {
      if (/^\s+$/.test(piece)) {
        el.appendChild(document.createTextNode(piece));
        continue;
      }
      if (piece.length === 0) continue;
      const span = document.createElement("span");
      span.textContent = piece;
      span.style.display = "inline-block";
      span.style.willChange = "transform, opacity";
      el.appendChild(span);
      units.push(span);
    }
  } else {
    el.innerHTML = "";
    for (const ch of text) {
      if (ch === " ") {
        el.appendChild(document.createTextNode(" "));
        continue;
      }
      const span = document.createElement("span");
      span.textContent = ch;
      span.style.display = "inline-block";
      span.style.willChange = "transform, opacity";
      el.appendChild(span);
      units.push(span);
    }
  }

  return {
    units,
    cleanup: () => {
      el.innerHTML = original;
    },
  };
}
