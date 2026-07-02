import {
  Component,
  h,
  type ComponentChildren,
  type ComponentProps,
  type ComponentType,
  type FunctionComponent,
} from "preact";

/** A component module accepted by {@link lazy}. */
export type LazyModule<C extends ComponentType<any>> = { readonly default: C } | C;

/** Async loader accepted by {@link lazy}. */
export type LazyLoader<C extends ComponentType<any>> = () => Promise<LazyModule<C>>;

/** Component returned by {@link lazy}. */
export type LazyComponent<C extends ComponentType<any>> = FunctionComponent<ComponentProps<C>> & {
  /** Starts loading the component before it is rendered. */
  readonly preload: () => Promise<C>;
};

/** Props accepted by {@link ErrorBoundary}. */
export interface ErrorBoundaryProps {
  /** Application content that may throw errors or lazy-loading promises. */
  readonly children?: ComponentChildren;
  /** Optional content rendered while suspended or after an error. */
  readonly fallback?: ComponentChildren;
  /** Called when a non-promise error is caught or a lazy-loading promise rejects. */
  readonly onError?: (error: unknown) => void;
}

interface ErrorBoundaryState {
  readonly error?: unknown;
  readonly failed: boolean;
  readonly suspended: boolean;
}

const READY_STATE: ErrorBoundaryState = { failed: false, suspended: false };

/**
 * Creates a lazily-loaded Preact component.
 *
 * The loader may resolve to a component directly or to an ES module-like object
 * with a default component export. Rendering the returned component before it
 * has loaded throws a cached promise, which can be caught by {@link ErrorBoundary}
 * or another suspense-compatible boundary.
 */
export default function lazy<C extends ComponentType<any>>(load: LazyLoader<C>): LazyComponent<C> {
  let component: C | undefined;
  let error: unknown;
  let promise: Promise<C> | undefined;

  const preload = () => {
    promise ??= load().then(
      (module) => {
        component = resolveLazyModule(module);
        return component;
      },
      (reason: unknown) => {
        error = reason;
        throw reason;
      },
    );

    return promise;
  };

  const LazyComponent: FunctionComponent<ComponentProps<C>> = (props) => {
    if (component) return h(component, props);
    if (error !== undefined) throw error;

    throw preload();
  };

  return Object.assign(LazyComponent, { preload });
}

/**
 * Catches errors and lazy-loading promises thrown below it.
 *
 * Promise throws put the boundary into its fallback state until the promise
 * resolves. Rejections and regular errors call `onError` and keep rendering
 * the optional fallback.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = READY_STATE;
  #promise: PromiseLike<unknown> | undefined;

  componentDidCatch(error: unknown): void {
    if (isPromiseLike(error)) {
      this.#suspend(error);
      return;
    }

    this.props.onError?.(error);
    this.setState({ error, failed: true, suspended: false });
  }

  render(): ComponentChildren {
    return this.state.failed || this.state.suspended
      ? (this.props.fallback ?? null)
      : this.props.children;
  }

  #suspend(promise: PromiseLike<unknown>): void {
    this.#promise = promise;
    this.setState({ error: undefined, failed: false, suspended: true });

    promise.then(
      () => {
        if (this.#promise !== promise) return;

        this.#promise = undefined;
        this.setState(READY_STATE);
      },
      (reason: unknown) => {
        if (this.#promise !== promise) return;

        this.#promise = undefined;
        this.props.onError?.(reason);
        this.setState({ error: reason, failed: true, suspended: false });
      },
    );
  }
}

function resolveLazyModule<C extends ComponentType<any>>(module: LazyModule<C>): C {
  return hasDefaultExport(module) ? module.default : module;
}

function hasDefaultExport<C extends ComponentType<any>>(
  module: LazyModule<C>,
): module is { readonly default: C } {
  return typeof module === "object" && module !== null && "default" in module;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return false;
  }

  return typeof (value as { readonly then?: unknown }).then === "function";
}
