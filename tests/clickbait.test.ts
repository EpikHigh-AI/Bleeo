import { describe, expect, it } from "vitest";

import headlines from "./fixtures/headlines.json";
import { classifyCandidates, isAggregateCandidateText, isCandidateText, scoreSensationalism } from "../src/shared/heuristics";

describe("research-informed headline regressions", () => {
  it.each(headlines)("$label: $text", ({ text, label }) => {
    expect(isCandidateText(text)).toBe(true);
    expect(isAggregateCandidateText(text)).toBe(true);
    expect(classifyCandidates([{ id: "headline", text }], "medium", "bbc.com")[0]?.label).toBe(label);
  });

  it.each(headlines.filter(({ label }) => label === "safe"))("keeps ordinary wording visible at high sensitivity: $text", ({ text }) => {
    expect(classifyCandidates([{ id: "headline", text }], "high", "bbc.com")[0]?.label).toBe("safe");
  });

  it("keeps a single hook sensitivity-dependent but combines independent evidence", () => {
    const plain = [{ id: "plain", text: "You won't believe what this artist painted" }];
    const emphasized = [{ id: "loud", text: "You won't believe this shocking discovery" }];
    expect(classifyCandidates(plain, "low")[0]?.label).toBe("safe");
    expect(classifyCandidates(plain, "medium")[0]?.label).toBe("sensational");
    expect(classifyCandidates(emphasized, "low")[0]?.label).toBe("sensational");
  });

  it("does not add overlapping hook matches repeatedly", () => {
    expect(scoreSensationalism("You won't believe what happened next").score).toBe(0.72);
    expect(scoreSensationalism("You won't believe what happened next").reasonCode).toBe("clickbait-disbelief");
  });

  it("applies the same hook on social hosts without requiring uppercase", () => {
    const candidates = [{ id: "social", text: "You’ll never guess what is inside this old suitcase" }];
    expect(classifyCandidates(candidates, "medium", "youtube.com")[0]?.label).toBe("sensational");
  });

  it.each(["Read more", "Latest updates", "Privacy settings", "Menu", "You won", "This is why"])("ignores short navigation text: %s", (text) => {
    expect(isCandidateText(text)).toBe(false);
    expect(isAggregateCandidateText(text)).toBe(false);
  });

  it("retains scan size limits even with a hook", () => {
    expect(isCandidateText(`You won't believe ${"word ".repeat(50)}`)).toBe(false);
    expect(isAggregateCandidateText(`You won't believe ${"word ".repeat(100)}`)).toBe(false);
  });
});
