import {
  h,
  isValidElement,
  toChildArray,
  type AnyComponent,
  type ComponentChildren,
  type VNode,
} from "preact";

import { exec, type ExecMatchInput } from "./exec";

const WINDOW_SELF_REGEX = /^(_self)?$/i;

/** Limits which destination pathnames the location provider intercepts. */
export type RouterScope = string | RegExp;

/** Location state exposed by the router location context. */
export interface LocationHook {
  /** The current path plus search string, relative to the current origin. */
  readonly url: string;
  /** The normalized pathname without trailing slashes, except for `/`. */
  readonly path: string;
  /** Query string parameters parsed into a plain object. */
  readonly query: Record<string, string>;
}

/** Route match state exposed by the router route context. */
export interface RouteHook {
  /** The path segment matched by the current router. */
  readonly path: string;
  /** Query string parameters inherited from the current location. */
  readonly query: Record<string, string>;
  /** Parameters captured from route patterns such as `/users/:id`. */
  readonly params: Record<string, string | undefined>;
  /** The unmatched path remainder produced by wildcard routes. */
  readonly rest: string;
  /** Matched route props and captured params are also exposed by name. */
  readonly [property: string]: unknown;
}

type RouteVNodeProps = ExecMatchInput & {
  readonly component: AnyComponent<any>;
  readonly default?: boolean;
  readonly path?: string;
  [property: string]: unknown;
};

type ResolvedRoute = { context: RouteHook; vnode: VNode<any> };
const EMPTY_ROUTE: RouteHook = { params: {}, path: "", query: {}, rest: "" };

export function isSameWindow(e: NavigateEvent): boolean {
  const sourceElement = e.sourceElement;
  if (!sourceElement) return true;

  return (
    !(sourceElement instanceof HTMLAnchorElement) ||
    !sourceElement.target ||
    WINDOW_SELF_REGEX.test(sourceElement.target)
  );
}

export function createLocation(url: string, origin = "http://localhost"): LocationHook {
  const parsedUrl = new URL(url || "/", origin);

  return {
    path: parsedUrl.pathname.replace(/\/+$/g, "") || "/",
    query: Object.fromEntries(parsedUrl.searchParams),
    url,
  };
}

export function resolveRoute(
  children: ComponentChildren,
  location: LocationHook,
  routeComponent: AnyComponent<any>,
  parent: RouteHook = EMPTY_ROUTE,
): ResolvedRoute | undefined {
  const path = parent.rest || location.path;
  let fallback: ResolvedRoute | undefined;

  for (const child of toChildArray(children)) {
    if (!isRouteVNode(child, routeComponent)) continue;

    const context = {
      ...child.props,
      params: { ...parent.params },
      path,
      query: location.query,
      rest: "",
    } satisfies RouteHook;

    if (typeof child.props.path === "string") {
      const match = exec(path, child.props.path, context);
      if (match) return renderMatch(child.props.component, match);
    }

    if (child.props.default === true && !fallback) {
      fallback = renderMatch(child.props.component, context);
    }
  }

  return fallback;
}

export function isInScope(url: URL, scope?: RouterScope): boolean {
  if (!scope) return true;

  return typeof scope === "string" ? url.pathname.startsWith(scope) : scope.test(url.pathname);
}

export function handleNav(state: string, event: NavigateEvent, scope?: RouterScope): string {
  const url = new URL(event.destination.url);

  if (
    !event.canIntercept ||
    event.hashChange ||
    event.downloadRequest !== null ||
    !isSameWindow(event) ||
    !isInScope(url, scope)
  ) {
    return state;
  }

  event.intercept({ focusReset: "manual" });
  return url.href.replace(url.origin, "");
}

function isRouteVNode(
  child: unknown,
  routeComponent: AnyComponent<any>,
): child is VNode<RouteVNodeProps> {
  return isValidElement(child) && child.type === routeComponent;
}

function renderMatch(component: AnyComponent<any>, context: RouteHook): ResolvedRoute {
  return { context, vnode: h(component, context) };
}
