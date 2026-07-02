import {
  createContext,
  h,
  type AnyComponent,
  type ComponentChildren,
  type Context,
  type VNode,
} from "preact";
import { useContext, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";

import { type RouteMatchForPath } from "./exec";
import {
  createLocation,
  handleNav,
  resolveRoute,
  type LocationHook,
  type RouteHook,
  type RouterScope,
} from "./utils";

export {
  exec,
  type ExecMatch,
  type ExecMatchInput,
  type ExecResult,
  type RouteMatchForPath,
} from "./exec";
export {
  default as lazy,
  ErrorBoundary,
  type ErrorBoundaryProps,
  type LazyComponent,
  type LazyLoader,
  type LazyModule,
} from "./lazy";
export type { LocationHook, RouteHook, RouterScope } from "./utils";

/** Infers the route props produced by a literal route pattern. */
export type RoutePropsForPath<Path extends string> = RouteMatchForPath<Path>;

/** Props accepted by {@link LocationProvider}. */
export interface LocationProviderProps {
  /** Optional pathname scope. Destinations outside this scope use browser navigation. */
  readonly scope?: RouterScope;
  /** Application content that should receive location context. */
  readonly children?: ComponentChildren;
}

/** Props accepted by {@link Router}. */
export interface RouterProps {
  /** Called after a committed path change. */
  readonly onRouteChange?: (url: string) => void;
  /** Route definitions, usually {@link Route} elements. */
  readonly children?: ComponentChildren;
}

/** Props accepted by {@link Route}. */
export type RouteProps = (
  | { readonly path: string; readonly default?: false }
  | { readonly path?: never; readonly default: true }
) & {
  /** Component rendered when this route matches. */
  readonly component: AnyComponent<any>;
  /** Extra props forwarded to the rendered route component. */
  readonly [property: string]: unknown;
};

type LocationProviderComponent = ((props: LocationProviderProps) => VNode<any>) & {
  /** The underlying location context for class components. */
  readonly ctx: Context<LocationHook>;
};
type RouterComponent = ((props: RouterProps) => VNode<any> | null) & {
  /** Alias for {@link LocationProvider}. */
  readonly Provider: LocationProviderComponent;
};

const EMPTY_LOCATION: LocationHook = { path: "", query: {}, url: "" };
const EMPTY_ROUTE: RouteHook = { params: {}, path: "", query: {}, rest: "" };

const LocationContext: Context<LocationHook> = createContext<LocationHook>(EMPTY_LOCATION);
const RouteContext: Context<RouteHook> = createContext<RouteHook>(EMPTY_ROUTE);

/**
 * Provides location state from the browser Navigation API.
 *
 * Wrap your application in `LocationProvider` before rendering a {@link Router}.
 * Navigations are intercepted only when the browser says they can be intercepted,
 * the navigation is same-window, it is not a hash-only or download navigation,
 * and the destination is inside the optional `scope`.
 */
/* v8 ignore next -- hook component exercised by browser integration tests, not pure unit tests */
export const LocationProvider: LocationProviderComponent = Object.assign(
  function LocationProvider({ children, scope }: LocationProviderProps): VNode<any> {
    const [url, setUrl] = useState(() => window.location.pathname + window.location.search);
    const value = useMemo(() => createLocation(url, window.location.origin), [url]);

    useLayoutEffect(() => {
      const updateUrl = (event: NavigateEvent) => {
        setUrl((currentUrl) => handleNav(currentUrl, event, scope));
      };

      window.navigation.addEventListener("navigate", updateUrl);

      return () => {
        window.navigation.removeEventListener("navigate", updateUrl);
      };
    }, [scope]);

    return h(LocationContext.Provider, { value }, children);
  },
  {
    ctx: LocationContext,
  },
);

/**
 * Renders the first matching {@link Route} child for the current location.
 *
 * Only `<Route component={...} path="..." />` children participate in matching;
 * arbitrary components with `path` props are ignored. Nested routers consume
 * the `rest` value produced by parent wildcard routes.
 */
/* v8 ignore next -- hook component exercised by browser integration tests, not pure unit tests */
export const Router: RouterComponent = Object.assign(
  function Router({ children, onRouteChange }: RouterProps): VNode<any> | null {
    const location = useLocation();

    if (!location.url) {
      throw new Error("@afcms/preact-router's <Router> must be used within a <LocationProvider>.");
    }

    const route = resolveRoute(children, location, Route, useContext(RouteContext));
    const previousPath = useRef(location.path);

    useLayoutEffect(() => {
      if (previousPath.current === location.path) return;

      previousPath.current = location.path;
      onRouteChange?.(location.url);
    }, [location.path, location.url, onRouteChange]);

    return route ? h(RouteContext.Provider, { value: route.context }, route.vnode) : null;
  },
  {
    Provider: LocationProvider,
  },
);

/**
 * Declares a route for use as a direct child of {@link Router}.
 *
 * Use `path` for matchable routes, or `default` for the fallback route. Extra
 * props are forwarded to the matched component together with `path`, `query`,
 * `params`, `rest`, and any named params captured from the route pattern.
 */
export function Route(props: RouteProps): VNode<any> {
  return h(props.component, props);
}

/**
 * Returns the current location context.
 *
 * Must be called below a {@link LocationProvider}.
 */
/* v8 ignore next -- trivial hook wrapper */
export function useLocation(): LocationHook {
  return useContext(LocationContext);
}

/**
 * Returns the current route match context.
 *
 * Must be called below a {@link Router}. Nested routers inherit params from
 * parent wildcard routes.
 */
/* v8 ignore next -- trivial hook wrapper */
export function useRoute(): RouteHook {
  return useContext(RouteContext);
}
