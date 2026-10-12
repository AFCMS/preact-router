import { h, isValidElement, type ComponentChildren } from "preact";
import { describe, expect, test, vi } from "vitest";

import { ErrorBoundary, lazy } from "../src";

function Profile({ name }: { readonly name: string }) {
  return h("span", null, name);
}

function Details({ id }: { readonly id: string }) {
  return h("span", null, id);
}

function Empty() {
  return null;
}

function renderLazy(component: (props: { readonly name: string }) => ComponentChildren) {
  try {
    return { thrown: undefined, value: component({ name: "Ada" }) };
  } catch (thrown) {
    return { thrown, value: undefined };
  }
}

function syncBoundaryState(boundary: ErrorBoundary) {
  vi.spyOn(boundary, "setState").mockImplementation((update) => {
    const nextState =
      typeof update === "function" ? update(boundary.state, boundary.props) : update;

    if (nextState) {
      boundary.state = { ...boundary.state, ...nextState };
    }
  });
}

describe("lazy", () => {
  test("throws a cached promise until a default export has loaded", async () => {
    const load = vi.fn(() => Promise.resolve({ default: Profile }));
    const LazyProfile = lazy(load);

    const pending = renderLazy(LazyProfile);
    expect(pending.value).toBeUndefined();
    expect(pending.thrown).toBeInstanceOf(Promise);

    await pending.thrown;

    const rendered = renderLazy(LazyProfile);
    expect(isValidElement(rendered.value)).toBe(true);

    if (!isValidElement(rendered.value)) return;

    expect(rendered.value.type).toBe(Profile);
    expect(rendered.value.props).toMatchObject({ name: "Ada" });
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("preloads direct component loaders once", async () => {
    const load = vi.fn(() => Promise.resolve(Details));
    const LazyDetails = lazy(load);

    await expect(LazyDetails.preload()).resolves.toBe(Details);
    await expect(LazyDetails.preload()).resolves.toBe(Details);

    expect(h(LazyDetails, { id: "42" }).type).toBe(LazyDetails);
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("throws the loader rejection after preload fails", async () => {
    const error = new Error("Could not load route");
    const LazyEmpty = lazy<typeof Empty>(() => Promise.reject(error));

    await expect(LazyEmpty.preload()).rejects.toBe(error);
    expect(() => LazyEmpty({})).toThrow(error);
  });
});

describe("ErrorBoundary", () => {
  test("renders children while ready and fallback after errors", () => {
    const error = new Error("Broken route");
    const onError = vi.fn();
    const boundary = new ErrorBoundary({
      children: "ready",
      fallback: "fallback",
      onError,
    });
    syncBoundaryState(boundary);

    expect(boundary.render()).toBe("ready");

    boundary.componentDidCatch(error);

    expect(onError).toHaveBeenCalledWith(error);
    expect(boundary.render()).toBe("fallback");
  });

  test("handles non-error thrown values", () => {
    const onError = vi.fn();
    const boundary = new ErrorBoundary({
      children: "ready",
      fallback: "fallback",
      onError,
    });
    syncBoundaryState(boundary);

    boundary.componentDidCatch("broken");
    boundary.componentDidCatch(null);

    expect(onError).toHaveBeenCalledWith("broken");
    expect(onError).toHaveBeenCalledWith(null);
    expect(boundary.render()).toBe("fallback");
  });

  test("renders null after errors when no fallback is provided", () => {
    const boundary = new ErrorBoundary({ children: "ready" });
    syncBoundaryState(boundary);

    boundary.componentDidCatch(new Error("Broken route"));

    expect(boundary.render()).toBeNull();
  });

  test("renders fallback while suspended and restores children after resolution", async () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    const boundary = new ErrorBoundary({
      children: "ready",
      fallback: "loading",
    });
    syncBoundaryState(boundary);

    boundary.componentDidCatch(promise);

    expect(boundary.render()).toBe("loading");

    resolve();
    await promise;

    expect(boundary.render()).toBe("ready");
  });

  test("ignores stale suspension resolutions", async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const first = new Promise<void>((done) => {
      resolveFirst = done;
    });
    const second = new Promise<void>((done) => {
      resolveSecond = done;
    });
    const boundary = new ErrorBoundary({
      children: "ready",
      fallback: "loading",
    });
    syncBoundaryState(boundary);

    boundary.componentDidCatch(first);
    boundary.componentDidCatch(second);

    resolveFirst();
    await first;

    expect(boundary.render()).toBe("loading");

    resolveSecond();
    await second;

    expect(boundary.render()).toBe("ready");
  });

  test("ignores stale suspension rejections", async () => {
    let rejectFirst!: (error: Error) => void;
    let resolveSecond!: () => void;
    const error = new Error("Late failure");
    const first = new Promise<void>((_, reject) => {
      rejectFirst = reject;
    });
    const second = new Promise<void>((done) => {
      resolveSecond = done;
    });
    const onError = vi.fn();
    const boundary = new ErrorBoundary({
      children: "ready",
      fallback: "loading",
      onError,
    });
    syncBoundaryState(boundary);

    boundary.componentDidCatch(first);
    boundary.componentDidCatch(second);

    rejectFirst(error);
    await first.catch(() => {});

    expect(onError).not.toHaveBeenCalled();
    expect(boundary.render()).toBe("loading");

    resolveSecond();
    await second;

    expect(boundary.render()).toBe("ready");
  });

  test("reports rejected suspensions", async () => {
    const error = new Error("No module");
    const onError = vi.fn();
    const promise = Promise.reject(error);
    const boundary = new ErrorBoundary({
      children: "ready",
      fallback: "fallback",
      onError,
    });
    syncBoundaryState(boundary);

    boundary.componentDidCatch(promise);
    await promise.catch(() => {});

    expect(onError).toHaveBeenCalledWith(error);
    expect(boundary.render()).toBe("fallback");
  });
});
