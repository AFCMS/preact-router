# @afcms/preact-router

A minimal [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
router for [Preact](https://preactjs.com).

This package intentionally focuses on one job: match the current browser
location to a Preact component. It also includes a small lazy-loading helper,
but does not provide prerendering, suspense transition management, or a History
API fallback.

## Contents

- [Install](#install)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Navigation](#navigation)
- [Scoped Routing](#scoped-routing)
- [Nested Routing](#nested-routing)
- [Route Patterns](#route-patterns)
- [Lazy Routes](#lazy-routes)
- [TypeScript](#typescript)
- [API](#api)
- [Comparison With preact-iso](#comparison-with-preact-iso)
- [License](#license)

## Install

```sh
pnpm add @afcms/preact-router preact
```

If you are consuming it from JSR:

```ts
import { LocationProvider, Route, Router } from "jsr:@afcms/preact-router";
```

## Requirements

- Preact 10 or newer.
- A browser/runtime with the
  [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API).

The router listens to `window.navigation` and intercepts eligible navigations.

## Quick Start

```tsx
import { LocationProvider, Route, Router } from "@afcms/preact-router";

function Home() {
  return <h1>Home</h1>;
}

function Profile({ params }: { params: { id?: string } }) {
  return <h1>Profile {params.id}</h1>;
}

function NotFound() {
  return <h1>Not found</h1>;
}

export function App() {
  return (
    <LocationProvider>
      <Router>
        <Route path="/" component={Home} />
        <Route path="/profiles/:id" component={Profile} />
        <Route default component={NotFound} />
      </Router>
    </LocationProvider>
  );
}
```

Routes must be declared with `<Route component={...} />`.

## Navigation

Use normal links:

```tsx
function Nav() {
  return (
    <nav>
      <a href="/">Home</a>
      <a href="/profiles/ada">Ada</a>
    </nav>
  );
}
```

Programmatic navigation is handled by the browser Navigation API:

```ts
navigation.navigate("/profiles/ada");
navigation.navigate("/settings", { history: "replace" });
await navigation.back().finished;
```

The router ignores navigations that should remain browser-controlled:

- non-interceptable Navigation API events
- hash-only navigations
- download navigations
- links or events targeting another browsing context, such as `_blank`
- destinations outside the optional `LocationProvider` scope

Intercepted navigations use `{ focusReset: "manual" }`.

## Scoped Routing

`LocationProvider` can limit interception to a pathname scope.

```tsx
<LocationProvider scope="/app">
  <Router>{/* routes */}</Router>
</LocationProvider>
```

String scopes use `pathname.startsWith(scope)`. RegExp scopes are tested against
the destination pathname:

```tsx
<LocationProvider scope={/^\/app(?:\/|$)/}>
  <Router>{/* routes */}</Router>
</LocationProvider>
```

## Nested Routing

Wildcard routes pass their unmatched path remainder to child routers through
`useRoute().rest`.

```tsx
import { LocationProvider, Route, Router } from "@afcms/preact-router";

function App() {
  return (
    <LocationProvider>
      <Router>
        <Route path="/" component={Home} />
        <Route path="/movies/:section/*" component={Movies} />
        <Route default component={NotFound} />
      </Router>
    </LocationProvider>
  );
}

function Movies() {
  return (
    <Router>
      <Route path="/trending" component={TrendingMovies} />
      <Route path="/search" component={MovieSearch} />
      <Route path="/:id" component={MovieDetails} />
      <Route default component={MovieNotFound} />
    </Router>
  );
}
```

For `/movies/library/trending`, the outer route captures
`params.section === "library"` and passes `/trending` to the inner router.
Nested route params are merged with parent params.

## Route Patterns

Paths are split on `/`. Empty segments and trailing slashes are ignored during
matching.

| Pattern segment | Meaning                                       |
| --------------- | --------------------------------------------- |
| `users`         | Exact literal segment                         |
| `:id`           | Required single segment                       |
| `:id?`          | Optional single segment                       |
| `:path*`        | Optional rest param                           |
| `:path+`        | Required rest param                           |
| `*`             | Required wildcard rest path exposed as `rest` |

Examples:

```ts
exec("/profiles/ada", "/profiles/:id");
// { id: "ada", params: { id: "ada" } }

exec("/files/a/b/c", "/files/:path+");
// { path: "a/b/c", params: { path: "a/b/c" } }

exec("/docs/a/b", "/docs/*");
// { rest: "/a/b", params: {} }
```

Single-segment params are decoded with `decodeURIComponent`. Rest params
preserve slash separators.

## Lazy Routes

Use `lazy()` for route components that should load on demand:

```tsx
import { ErrorBoundary, lazy, LocationProvider, Route, Router } from "@afcms/preact-router";

const Profile = lazy(() => import("./routes/profile"));
const Settings = lazy(() => import("./routes/settings").then((module) => module.Settings));

export function App() {
  return (
    <LocationProvider>
      <ErrorBoundary fallback={<p>Loading...</p>}>
        <Router>
          <Route path="/profiles/:id" component={Profile} />
          <Route path="/settings" component={Settings} />
        </Router>
      </ErrorBoundary>
    </LocationProvider>
  );
}
```

The loader may resolve to a default-export module or directly to a component.
The returned component exposes `preload()`:

```tsx
<a href="/profiles/ada" onMouseEnter={() => Profile.preload()}>
  Ada
</a>
```

## TypeScript

`RoutePropsForPath` infers route params from a literal path:

```tsx
import type { RoutePropsForPath } from "@afcms/preact-router";

type ProfileProps = RoutePropsForPath<"/profiles/:id">;

function Profile({ id, params }: ProfileProps) {
  id satisfies string;
  params.id satisfies string;
  return <h1>{id}</h1>;
}
```

Optional params become optional:

```ts
type SearchProps = RoutePropsForPath<"/search/:query?">;
// { query?: string; params: { query?: string } }
```

The runtime router passes these route values as props:

- `path`
- `query`
- `params`
- `rest`
- named params, such as `id`
- any extra props supplied to `<Route>`

## API

### `LocationProvider`

```tsx
<LocationProvider scope="/app">
  <Router>{/* routes */}</Router>
</LocationProvider>
```

Provides current location context and registers a Navigation API `navigate`
listener.

Props:

- `scope?: string | RegExp` - Optional pathname scope for intercepted
  navigations.
- `children?: ComponentChildren`

Static properties:

- `LocationProvider.ctx` - The underlying Preact context for class components.

### `Router`

```tsx
<Router onRouteChange={(url) => console.log(url)}>
  <Route path="/" component={Home} />
</Router>
```

Renders the first matching `Route` child. Throws if rendered outside
`LocationProvider`.

Props:

- `onRouteChange?: (url: string) => void` - Called after the path changes.
- `children?: ComponentChildren`

Static properties:

- `Router.Provider` - Alias for `LocationProvider`.

### `Route`

```tsx
<Route path="/profiles/:id" component={Profile} />
<Route default component={NotFound} />
```

Declares a route for direct use under `Router`.

Props:

- `path: string` - Route pattern to match.
- `default: true` - Marks a fallback route. A fallback cannot also have `path`.
- `component: AnyComponent` - Component rendered when the route matches.
- any extra props - Forwarded to the rendered component.

### `useLocation()`

```ts
const { url, path, query } = useLocation();
```

Returns:

- `url: string` - Current path plus search string, relative to the current
  origin.
- `path: string` - Normalized pathname with trailing slashes removed except
  for `/`.
- `query: Record<string, string>` - Parsed query string parameters.

### `useRoute()`

```ts
const { params, rest } = useRoute();
```

Returns:

- `path: string` - Path segment matched by the current router.
- `query: Record<string, string>` - Query string inherited from the location.
- `params: Record<string, string | undefined>` - Captured route params.
- `rest: string` - Remaining path for nested routers.
- named params and extra route props.

### `lazy(load)`

```ts
const Profile = lazy(() => import("./routes/profile"));
```

Creates a component that loads the real component the first time it renders.
Before the component has loaded, it throws a cached promise for `ErrorBoundary`
or another suspense-compatible boundary to catch.

The loader may resolve to:

- a component
- an object with a `default` component export

Static properties:

- `preload(): Promise<Component>` - Starts loading before render and resolves
  to the loaded component.

### `ErrorBoundary`

```tsx
<ErrorBoundary fallback={<p>Loading...</p>} onError={console.error}>
  <Router>{/* routes */}</Router>
</ErrorBoundary>
```

Catches regular render errors and promises thrown by `lazy()` components.

Props:

- `children?: ComponentChildren`
- `fallback?: ComponentChildren` - Rendered while a lazy promise is pending or
  after an error.
- `onError?: (error: unknown) => void` - Called for regular errors and rejected
  lazy promises.

### `exec(url, route, matches?)`

```ts
const match = exec("/users/42", "/users/:id");
```

Matches a URL path against a route pattern. Returns an enriched match object or
`undefined`.

When `matches` is provided, it is mutated and returned on success:

```ts
const props = { params: { org: "acme" }, query: {} };
exec("/users/42", "/users/:id", props);
// props.params.id === "42"
```

## Comparison With preact-iso

This project borrows the small route-pattern language from `preact-iso`, but it
is intentionally narrower:

- It only uses the browser Navigation API.
- It only supports `<Route component={...} />` route declarations.
- It includes `lazy` and `ErrorBoundary`, but not `hydrate`, `prerender`, or
  seamless suspense transition handling.
- It keeps routing and matching small enough to be readable TypeScript.

For a broader isomorphic toolkit, use
[`preact-iso`](https://preactjs.com/guide/v10/preact-iso).

## License

[MIT](./LICENSE)
