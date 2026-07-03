import { describe, it, expect } from "vitest";

import { stripJsonCodeFence } from "./llmResponse.js";

describe("stripJsonCodeFence", () => {
  it("strips a lowercase ```json fence", () => {
    expect(stripJsonCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("strips an uppercase ```JSON fence", () => {
    expect(stripJsonCodeFence('```JSON\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("strips a bare ``` fence with no language tag", () => {
    expect(stripJsonCodeFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("leaves unfenced JSON unchanged", () => {
    expect(stripJsonCodeFence('{"a":1}')).toBe('{"a":1}');
  });

  it("only strips a leading/trailing fence, leaving a literal ``` inside a string value untouched", () => {
    const input = '```json\n{"reasoning":"see the ```example``` block"}\n```';
    expect(stripJsonCodeFence(input)).toBe('{"reasoning":"see the ```example``` block"}');
  });
});
