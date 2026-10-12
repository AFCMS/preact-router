import { h } from "preact";
import { describe, expect, test, vi } from "vitest";

import { Route } from "../src";
import { createLocation, handleNav, isInScope, resolveRoute, type RouterScope } from "../src/utils";

const APP_PATH_SCOPE = /^\/app(?:\/|$)/;

function Home(_props: { readonly title?: string }) {
  return null;
}

function Fallback(_props: { readonly label?: string }) {
  return null;
}

function Params() {
  return null;
}

function DirectApp(_props: { readonly path: string }) {
  return null;
}

function createNavigateEvent(
  url: string,
  overrides: Partial<NavigateEvent> = {},
): NavigateEvent & {
  readonly intercept: ReturnType<typeof vi.fn>;
} {
  return {
    canIntercept: true,
    destination: { url } as NavigationDestination,
    downloadRequest: null,
    hashChange: false,
    intercept: vi.fn(),
    sourceElement: null,
    ...overrides,
  } as unknown as NavigateEvent & {
    readonly intercept: ReturnType<typeof vi.fn>;
  };
}

describe("createLocation", () => {
  test("normalizes path and extracts query params", () => {
    expect(createLocation("/profiles/?a=b&c=d", "https://example.com")).toEqual({
      path: "/profiles",
      query: { a: "b", c: "d" },
      url: "/profiles/?a=b&c=d",
    });
  });

  test("keeps root paths stable", () => {
    expect(createLocation("/", "https://example.com")).toEqual({
      path: "/",
      query: {},
      url: "/",
    });
  });

  test("uses a local origin by default", () => {
    expect(createLocation("/profiles?tab=activity")).toEqual({
      path: "/profiles",
      query: { tab: "activity" },
      url: "/profiles?tab=activity",
    });
  });

  test("treats empty urls as root paths", () => {
    expect(createLocation("", "https://example.com")).toEqual({
      path: "/",
      query: {},
      url: "",
    });
  });
});

describe("isInScope", () => {
  test("accepts all paths without a scope", () => {
    expect(isInScope(new URL("https://example.com/app/users"))).toBe(true);
  });

  test("matches string scopes against the pathname", () => {
    expect(isInScope(new URL("https://example.com/app/users"), "/app")).toBe(true);
    expect(isInScope(new URL("https://example.com/site/users"), "/app")).toBe(false);
  });

  test("matches regex scopes against the pathname", () => {
    const scope: RouterScope = APP_PATH_SCOPE;

    expect(isInScope(new URL("https://example.com/app/users"), scope)).toBe(true);
    expect(isInScope(new URL("https://example.com/application"), scope)).toBe(false);
  });
});

describe("handleNav", () => {
  test("intercepts eligible same-window navigations", () => {
    const event = createNavigateEvent("https://example.com/app/users?tab=1#bio");

    expect(handleNav("/", event, "/app")).toBe("/app/users?tab=1#bio");
    expect(event.intercept).toHaveBeenCalledWith({ focusReset: "manual" });
  });

  test("ignores hash changes", () => {
    const event = createNavigateEvent("https://example.com/#section", { hashChange: true });

    expect(handleNav("/", event)).toBe("/");
    expect(event.intercept).not.toHaveBeenCalled();
  });

  test("ignores non-interceptable navigations", () => {
    const event = createNavigateEvent("https://example.com/download", { canIntercept: false });

    expect(handleNav("/", event)).toBe("/");
    expect(event.intercept).not.toHaveBeenCalled();
  });

  test("ignores download navigations", () => {
    const event = createNavigateEvent("https://example.com/download", {
      downloadRequest: "file.txt",
    });

    expect(handleNav("/", event)).toBe("/");
    expect(event.intercept).not.toHaveBeenCalled();
  });

  test("ignores navigations outside the configured scope", () => {
    const event = createNavigateEvent("https://example.com/site/users");

    expect(handleNav("/app", event, "/app")).toBe("/app");
    expect(event.intercept).not.toHaveBeenCalled();
  });
});

describe("resolveRoute", () => {
  test("ignores non-vnode and non-Route children", () => {
    const resolved = resolveRoute(
      ["plain text", null, h(DirectApp, { path: "/" }), h(Route, { component: Home, path: "/" })],
      createLocation("/", "https://example.com"),
      Route,
    );

    expect(resolved?.vnode.type).toBe(Home);
  });

  test("resolves matching routes with params", () => {
    const resolved = resolveRoute(
      h(Route, { component: Home, path: "/profiles/:id" }),
      createLocation("/profiles/bob", "https://example.com"),
      Route,
    );

    expect(resolved?.vnode.type).toBe(Home);
    expect(resolved?.context).toMatchObject({
      id: "bob",
      params: { id: "bob" },
      path: "/profiles/bob",
      query: {},
      rest: "",
    });
  });

  test("falls back to the first default route", () => {
    const resolved = resolveRoute(
      [
        h(Route, { component: Home, path: "/" }),
        h(Route, { component: Fallback, default: true, label: "first" }),
        h(Route, { component: Fallback, default: true, label: "second" }),
      ],
      createLocation("/missing?a=b", "https://example.com"),
      Route,
    );

    expect(resolved?.vnode.type).toBe(Fallback);
    expect(resolved?.context).toMatchObject({
      label: "first",
      params: {},
      path: "/missing",
      query: { a: "b" },
      rest: "",
    });
  });

  test("uses rest paths and inherited params for nested routes", () => {
    const location = createLocation("/foo/bar/bob", "https://example.com");
    const parent = resolveRoute(h(Route, { component: Home, path: "/foo/:id/*" }), location, Route);
    const child = resolveRoute(
      h(Route, { component: Params, path: "/bob" }),
      location,
      Route,
      parent?.context,
    );

    expect(parent?.context).toMatchObject({
      params: { id: "bar" },
      rest: "/bob",
    });
    expect(child?.vnode.type).toBe(Params);
    expect(child?.context).toMatchObject({
      params: { id: "bar" },
      path: "/bob",
      rest: "",
    });
  });

  test("does not preserve params from failed partial matches", () => {
    const resolved = resolveRoute(
      [
        h(Route, { component: Params, path: "/category/:id" }),
        h(Route, { component: Params, path: "/category/:categoryId/products/new" }),
        h(Route, { component: Params, path: "/category/:categoryId/products/:id/edit" }),
      ],
      createLocation("/category/123/products/new", "https://example.com"),
      Route,
    );

    expect(resolved?.context.params).toEqual({ categoryId: "123" });
    expect(resolved?.context.params).not.toHaveProperty("id");
  });

  test("returns undefined when no route matches", () => {
    expect(
      resolveRoute(
        h(Route, { component: Home, path: "/profiles" }),
        createLocation("/settings", "https://example.com"),
        Route,
      ),
    ).toBeUndefined();
  });
});

describe("Route", () => {
  test("creates a vnode for its component", () => {
    const vnode = Route({ component: Home, path: "/", title: "Welcome" });

    expect(vnode.type).toBe(Home);
    expect(vnode.props).toMatchObject({
      path: "/",
      title: "Welcome",
    });
  });
});
