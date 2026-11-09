"use client";

import NextLink from "next/link";
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  type ComponentProps,
  type MouseEvent,
} from "react";

/**
 * react-router-dom compatibility shim.
 *
 * 28 files imported react-router. Rewriting each by hand would have meant 28 chances to change
 * behaviour silently, so instead they each get a one-line import swap to this module and keep
 * their existing call shapes. The shim is a migration aid, not a permanent layer — retire it
 * file-by-file as pages move to real Server Components.
 *
 * Known gaps, all deliberate: no `<Routes>`/`<Route>` (App Router owns routing now), and history
 * state is approximated (see below).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/** react-router types state as `any`; matching that keeps `location.state?.foo` compiling. */
type LocationState = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface NavigateOptions {
  replace?: boolean;
  state?: LocationState;
}

/**
 * Next has no equivalent of react-router's per-history-entry `state`, but dropping it would break
 * real behaviour: AuthModal passes the signup email to /email-verification that way. (Its
 * localStorage fallback looks like a safety net but doesn't fire — AuthModal writes the email to
 * *session*Storage while the page reads *local*Storage, so state is the only path that works.)
 *
 * So state is stashed under the destination path and handed back only while that path is active.
 * One slot, not a per-entry stack — enough for how this app uses it, and it self-clears on the
 * next navigation rather than leaking into an unrelated page.
 */
const STATE_KEY = "vx-router-state";

function stashState(to: string, state: LocationState): void {
  try {
    const path = to.split("?")[0].split("#")[0];
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ path, state }));
  } catch {
    /* private mode / storage disabled — state is best-effort */
  }
}

function readState(pathname: string): LocationState {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { path: string; state: LocationState };
    return parsed.path === pathname ? parsed.state : null;
  } catch {
    return null;
  }
}

/** `navigate('/x')`, `navigate('/x', { replace: true })`, `navigate(-1)`. */
export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        window.history.go(to);
        return;
      }
      if (options?.state !== undefined) stashState(to, options.state);
      if (options?.replace) router.replace(to);
      else router.push(to);
    },
    [router],
  );
}

/** `{ pathname, search, hash, state }` — the subset this codebase reads. */
export function useLocation() {
  const pathname = usePathname() ?? "/";
  const searchParams = useNextSearchParams();
  const search = searchParams?.toString() ?? "";
  return useMemo(
    () => ({
      pathname,
      search: search ? `?${search}` : "",
      hash: "",
      state: readState(pathname) as LocationState,
      key: `${pathname}?${search}`,
    }),
    [pathname, search],
  );
}

/**
 * react-router's tuple form. The returned params are a **mutable copy** on purpose — callers
 * mutate it (`params.delete(...)`) before handing it back to the setter, which Next's own
 * read-only `ReadonlyURLSearchParams` forbids.
 */
export function useSearchParams(): [
  URLSearchParams,
  (
    next: URLSearchParams | Record<string, string>,
    options?: { replace?: boolean },
  ) => void,
] {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const current = useNextSearchParams();
  const serialized = current?.toString() ?? "";

  const params = useMemo(() => new URLSearchParams(serialized), [serialized]);

  const setSearchParams = useCallback(
    (
      next: URLSearchParams | Record<string, string>,
      options?: { replace?: boolean },
    ) => {
      const qs =
        next instanceof URLSearchParams
          ? next.toString()
          : new URLSearchParams(next).toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (options?.replace) router.replace(url);
      else router.push(url);
    },
    [pathname, router],
  );

  return [params, setSearchParams];
}

type LinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & {
  to: string;
  state?: LocationState;
};

/** `<Link to="...">` → `next/link`, carrying `state` through the same stash. */
export function Link({ to, state, onClick, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (state !== undefined) stashState(to, state);
    onClick?.(event);
  };
  return <NextLink href={to} onClick={handleClick} {...rest} />;
}

/** `<Navigate to="..." replace />` — redirects on mount, renders nothing. */
export function Navigate({
  to,
  replace,
  state,
}: {
  to: string;
  replace?: boolean;
  state?: LocationState;
}) {
  const router = useRouter();
  useEffect(() => {
    if (state !== undefined) stashState(to, state);
    if (replace) router.replace(to);
    else router.push(to);
  }, [to, replace, state, router]);
  return null;
}

/**
 * react-router's `useParams` always returned an object, while Next's can be null. Callers here
 * destructure the result directly (`const { slug } = useParams<{ slug: string }>()`), so an empty
 * object is the faithful stand-in.
 */
export function useParams<T extends Record<string, string | string[]>>(): T {
  return (useNextParams() ?? {}) as T;
}
