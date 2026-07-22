import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe("metricExplain", () => {
  beforeAll(() => {
    const code = fs.readFileSync(path.resolve(__dirname, "metricExplain.js"), "utf8");
    global.window = {};
    eval(code);
  });

  it("should explain topic metric", () => {
    const result = global.window.explainMetric("topic", { summary: "Math (12)" });
    expect(result).toBe("Top topics by attempts: Math (12).");
  });

  it("should explain type metric", () => {
    const result = global.window.explainMetric("type", { summary: "MCQ (5)" });
    expect(result).toBe("Question-type breakdown: MCQ (5).");
  });
});
