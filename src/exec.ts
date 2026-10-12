type EmptyRouteMatch = { params: {} };
type ParamModifier = "" | "?" | "*" | "+";

type OptionalParam<Name extends string> = Name extends ""
  ? EmptyRouteMatch
  : { [Key in Name]?: string } & { params: { [Key in Name]?: string } };

type RequiredParam<Name extends string> = Name extends ""
  ? EmptyRouteMatch
  : { [Key in Name]: string } & { params: { [Key in Name]: string } };

type SegmentMatch<Segment extends string> = Segment extends "*"
  ? { params: {}; rest: string }
  : Segment extends `:${infer Name}?`
    ? OptionalParam<Name>
    : Segment extends `:${infer Name}*`
      ? OptionalParam<Name>
      : Segment extends `:${infer Name}+`
        ? RequiredParam<Name>
        : Segment extends `:${infer Name}`
          ? RequiredParam<Name>
          : EmptyRouteMatch;

type MergeMatches<Left extends EmptyRouteMatch, Right extends EmptyRouteMatch> = Omit<
  Left,
  "params"
> &
  Omit<Right, "params"> & {
    params: Left["params"] & Right["params"];
  };

/** Infers the match object produced by a literal route pattern. */
export type RouteMatchForPath<Path extends string> = string extends Path
  ? ExecMatch
  : Path extends ""
    ? EmptyRouteMatch
    : Path extends `/${infer Rest}`
      ? RouteMatchForPath<Rest>
      : Path extends `${infer Segment}/${infer Rest}`
        ? MergeMatches<SegmentMatch<Segment>, RouteMatchForPath<Rest>>
        : SegmentMatch<Path>;

/** Mutable base object that can be enriched by {@link exec}. */
export interface ExecMatchInput {
  /** Existing route params to preserve and extend. */
  params?: Record<string, string | undefined>;
  /** Additional props to preserve on successful matches. */
  [property: string]: unknown;
}

/** Runtime match object returned by {@link exec}. */
export interface ExecMatch {
  /** Captured params keyed by route parameter name. */
  params: Record<string, string | undefined>;
  /** Remaining path captured by a `*` wildcard route segment. */
  rest?: string;
  /** Captured params and caller-supplied props are also exposed by name. */
  [property: string]: unknown;
}

type ExistingParams<Matches> = Matches extends { params?: infer Params }
  ? Params extends Record<string, string | undefined>
    ? Params
    : {}
  : {};

/** Match result for a route pattern and optional caller-supplied match object. */
export type ExecResult<Route extends string, Matches extends ExecMatchInput = {}> = Omit<
  Matches,
  "params"
> &
  Omit<RouteMatchForPath<Route>, "params"> & {
    params: ExistingParams<Matches> & RouteMatchForPath<Route>["params"];
  };

type ParsedRouteSegment =
  | { kind: "literal"; value: string }
  | { kind: "param"; modifier: ParamModifier; name: string }
  | { kind: "wildcard" };

export function exec<const Route extends string>(
  url: string,
  route: Route,
): ExecResult<Route> | undefined;
export function exec<const Route extends string, const Matches extends ExecMatchInput>(
  url: string,
  route: Route,
  matches: Matches,
): ExecResult<Route, Matches> | undefined;
/**
 * Matches a URL path against a route pattern.
 *
 * Supported pattern segments:
 *
 * - literal segments, such as `/users`
 * - `:name` for required params
 * - `:name?` for optional params
 * - `:name*` for optional rest params
 * - `:name+` for required rest params
 * - `*` for a wildcard rest path exposed as `rest`
 *
 * Captured values are decoded for single-segment params. Rest params preserve
 * slash separators. When a `matches` object is provided, it is enriched in
 * place and returned on success.
 *
 * @param url - URL path to test, for example `/users/123`.
 * @param route - Route pattern, for example `/users/:id`.
 * @param matches - Optional object to enrich with captured params.
 * @returns The enriched match object, or `undefined` when the route does not match.
 */
export function exec(
  url: string,
  route: string,
  matches: ExecMatchInput = {},
): ExecMatch | undefined {
  const urlSegments = splitPath(url);
  const routeSegments = splitPath(route);

  ensureParams(matches);

  for (let index = 0; index < Math.max(urlSegments.length, routeSegments.length); index += 1) {
    const routeSegment = routeSegments[index];
    const urlSegment = urlSegments[index];

    if (routeSegment === undefined) return undefined;

    const parsedSegment = parseRouteSegment(routeSegment);

    if (parsedSegment.kind === "literal") {
      if (parsedSegment.value !== urlSegment) return undefined;
      continue;
    }

    if (parsedSegment.kind === "wildcard") {
      if (urlSegment === undefined) return undefined;

      matches.rest = `/${urlSegments.slice(index).map(decodeURIComponent).join("/")}`;
      return matches;
    }

    const isRestParam = parsedSegment.modifier === "*" || parsedSegment.modifier === "+";
    const isOptionalParam = parsedSegment.modifier === "?" || parsedSegment.modifier === "*";

    if (urlSegment === undefined && !isOptionalParam) return undefined;

    const value = isRestParam
      ? urlSegments.slice(index).join("/") || undefined
      : urlSegment === undefined
        ? undefined
        : decodeURIComponent(urlSegment);

    setParam(matches, parsedSegment.name, value);

    if (isRestParam) return matches;
  }

  return matches;
}

function splitPath(path: string): string[] {
  return path.split("/").filter(isPresentPathSegment);
}

function isPresentPathSegment(segment: string): boolean {
  return segment.length > 0;
}

function ensureParams(matches: ExecMatchInput): asserts matches is ExecMatch {
  matches.params ??= {};
}

function parseRouteSegment(segment: string): ParsedRouteSegment {
  if (segment === "*") return { kind: "wildcard" };

  if (!segment.startsWith(":")) return { kind: "literal", value: segment };

  const rawName = segment.slice(1);
  const lastCharacter = rawName.at(-1);

  if (isParamModifier(lastCharacter)) {
    return { kind: "param", modifier: lastCharacter, name: rawName.slice(0, -1) };
  }

  return { kind: "param", modifier: "", name: rawName };
}

function isParamModifier(value: string | undefined): value is Exclude<ParamModifier, ""> {
  return value === "?" || value === "*" || value === "+";
}

function setParam(match: ExecMatch, name: string, value: string | undefined): void {
  match.params[name] = value;

  if (!(name in match)) {
    match[name] = value;
  }
}
