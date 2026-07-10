import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { isSameWindow } from "../src/utils";

class TestAnchorElement {
  constructor(readonly target = "") {}
}

const originalHTMLAnchorElement = globalThis.HTMLAnchorElement;

function eventWithSourceElement(sourceElement: unknown): NavigateEvent {
  return { sourceElement } as NavigateEvent;
}

describe("isSameWindow", () => {
  beforeAll(() => {
    globalThis.HTMLAnchorElement = TestAnchorElement as typeof HTMLAnchorElement;
  });

  afterAll(() => {
    globalThis.HTMLAnchorElement = originalHTMLAnchorElement;
  });

  test("returns true when there is no source element", () => {
    expect(isSameWindow(eventWithSourceElement(null))).toBe(true);
  });

  test("returns true when an anchor has no target", () => {
    expect(isSameWindow(eventWithSourceElement(new TestAnchorElement()))).toBe(true);
  });

  test("returns true when an anchor targets the same window", () => {
    expect(isSameWindow(eventWithSourceElement(new TestAnchorElement("_self")))).toBe(true);
    expect(isSameWindow(eventWithSourceElement(new TestAnchorElement("_SELF")))).toBe(true);
  });

  test("returns false when an anchor targets another browsing context", () => {
    expect(isSameWindow(eventWithSourceElement(new TestAnchorElement("_blank")))).toBe(false);
  });

  test("ignores non-anchor source elements with target-like properties", () => {
    expect(isSameWindow(eventWithSourceElement({ target: "_blank" }))).toBe(true);
  });
});
