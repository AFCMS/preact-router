import { describe, expect, test } from "vitest";

import { exec } from "../src/exec";

describe("exec", () => {
  test("matches identical static paths", () => {
    expect(exec("/", "/")).toEqual({ params: {} });
    expect(exec("/users", "/users")).toEqual({ params: {} });
    expect(exec("/users/", "/users")).toEqual({ params: {} });
  });

  test("rejects static path mismatches", () => {
    expect(exec("/users", "/settings")).toBeUndefined();
    expect(exec("/users/42", "/users")).toBeUndefined();
    expect(exec("/users", "/users/42")).toBeUndefined();
  });

  test("extracts and decodes required params", () => {
    expect(exec("/users/alice%20smith", "/users/:id")).toEqual({
      id: "alice smith",
      params: { id: "alice smith" },
    });
  });

  test("rejects missing required params", () => {
    expect(exec("/users", "/users/:id")).toBeUndefined();
  });

  test("extracts optional params when present", () => {
    expect(exec("/users/42", "/users/:id?")).toEqual({
      id: "42",
      params: { id: "42" },
    });
  });

  test("sets optional params to undefined when absent", () => {
    const match = exec("/users", "/users/:id?");

    expect(match).toEqual({
      id: undefined,
      params: { id: undefined },
    });
    expect(match).toHaveProperty("id");
    expect(match?.params).toHaveProperty("id");
  });

  test("extracts required rest params", () => {
    expect(exec("/files/a/b/c", "/files/:path+")).toEqual({
      params: { path: "a/b/c" },
      path: "a/b/c",
    });
  });

  test("rejects missing required rest params", () => {
    expect(exec("/files", "/files/:path+")).toBeUndefined();
  });

  test("extracts optional rest params", () => {
    expect(exec("/files/a/b/c", "/files/:path*")).toEqual({
      params: { path: "a/b/c" },
      path: "a/b/c",
    });
  });

  test("sets optional rest params to undefined when absent", () => {
    const match = exec("/files", "/files/:path*");

    expect(match).toEqual({
      params: { path: undefined },
      path: undefined,
    });
    expect(match).toHaveProperty("path");
    expect(match?.params).toHaveProperty("path");
  });

  test("extracts catch-all wildcard rest paths", () => {
    expect(exec("/docs/a%20b/c%2Fd", "/docs/*")).toEqual({
      params: {},
      rest: "/a b/c/d",
    });
  });

  test("rejects catch-all wildcard routes without a rest path", () => {
    expect(exec("/docs", "/docs/*")).toBeUndefined();
  });

  test("enriches and returns the provided matches object", () => {
    const matches = {
      id: "existing",
      params: { org: "acme" },
      path: "/users/:id",
      query: { page: "1" },
    };

    const result = exec("/users/42", "/users/:id", matches);

    expect(result).toBe(matches);
    expect(result).toEqual({
      id: "existing",
      params: { id: "42", org: "acme" },
      path: "/users/:id",
      query: { page: "1" },
    });
  });

  test("adds params to provided matches when missing", () => {
    const matches = { route: "/users/:id" };

    const result = exec("/users/42", "/users/:id", matches);

    expect(result).toBe(matches);
    expect(result).toEqual({
      id: "42",
      params: { id: "42" },
      route: "/users/:id",
    });
  });
});
