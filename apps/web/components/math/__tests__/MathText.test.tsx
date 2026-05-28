import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  MathText,
  detectMath,
  splitMathRuns,
} from "@/components/math/MathText";

describe("MathText parser", () => {
  describe("detectMath", () => {
    it("returns false for plain text", () => {
      expect(detectMath("Hello world.")).toBe(false);
    });
    it("returns false for a dollar sign that isn't math", () => {
      // No closing $: must NOT detect math.
      expect(detectMath("Costs $5.")).toBe(false);
    });
    it("returns true for inline $...$", () => {
      expect(detectMath("Solve $x^2 = 4$.")).toBe(true);
    });
    it("returns true for block $$...$$", () => {
      expect(detectMath("Identity: $$e^{i\\pi}+1=0$$")).toBe(true);
    });
    it("returns true for \\( ... \\)", () => {
      expect(detectMath("Inline \\(x+1\\) here.")).toBe(true);
    });
    it("returns true for \\[ ... \\]", () => {
      expect(detectMath("Block \\[ x = 1 \\]")).toBe(true);
    });
  });

  describe("splitMathRuns", () => {
    it("yields a single text run when there's no math", () => {
      const runs = splitMathRuns("Hello world");
      expect(runs).toEqual([{ kind: "text", value: "Hello world" }]);
    });

    it("splits plain text + inline math + plain text", () => {
      const runs = splitMathRuns("Find $x$ when y=2");
      expect(runs).toEqual([
        { kind: "text", value: "Find " },
        { kind: "inline-math", value: "x" },
        { kind: "text", value: " when y=2" },
      ]);
    });

    it("splits block math", () => {
      const runs = splitMathRuns("Pre $$a^2+b^2=c^2$$ post");
      expect(runs).toEqual([
        { kind: "text", value: "Pre " },
        { kind: "block-math", value: "a^2+b^2=c^2" },
        { kind: "text", value: " post" },
      ]);
    });

    it("splits both inline and block math in one input", () => {
      const runs = splitMathRuns("Show $x>0$ then $$y=2x$$ end");
      expect(runs).toEqual([
        { kind: "text", value: "Show " },
        { kind: "inline-math", value: "x>0" },
        { kind: "text", value: " then " },
        { kind: "block-math", value: "y=2x" },
        { kind: "text", value: " end" },
      ]);
    });

    it("supports \\( ... \\) and \\[ ... \\] delimiters", () => {
      const runs = splitMathRuns("A \\(x\\) and B \\[y\\] done");
      expect(runs).toEqual([
        { kind: "text", value: "A " },
        { kind: "inline-math", value: "x" },
        { kind: "text", value: " and B " },
        { kind: "block-math", value: "y" },
        { kind: "text", value: " done" },
      ]);
    });
  });

  describe("rendering", () => {
    it("renders plain text in a span without mounting KaTeX", () => {
      const { container } = render(<MathText markdown="Just text." />);
      // No `.katex` class means KaTeX never mounted.
      expect(container.querySelector(".katex")).toBeNull();
      expect(container.textContent).toContain("Just text.");
    });

    it("mounts KaTeX when the input contains math", () => {
      const { container } = render(<MathText markdown="Solve $x^2$." />);
      expect(container.querySelector(".katex")).not.toBeNull();
    });

    it("renders bold via **markdown**", () => {
      const { container } = render(<MathText markdown="Hello **world**!" />);
      expect(container.querySelector("strong")?.textContent).toBe("world");
    });

    it("renders italic via *markdown*", () => {
      const { container } = render(<MathText markdown="Hello *world*!" />);
      expect(container.querySelector("em")?.textContent).toBe("world");
    });

    it("renders \\n as a line break", () => {
      // JSX attribute strings DON'T interpret escape sequences — use the
      // curly-braces form to get a JS string with a real newline.
      const { container } = render(<MathText markdown={"line1\nline2"} />);
      expect(container.querySelectorAll("br").length).toBe(1);
    });
  });
});
