const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "") + "/api/v1";

/* ---------- sample-data mode ----------
   Off by default. When on, every request carries `X-Sample-Data: 1` and the API serves the demo
   dataset (a separate schema), so real partner data is never mixed with or changed by demo content. */
const SAMPLE_KEY = "fityes-sample-data";
let sampleOn = (() => {
  try {
    return localStorage.getItem(SAMPLE_KEY) === "1";
  } catch {
    return false;
  }
})();
const sampleListeners = new Set<() => void>();
export const sampleData = {
  get: () => sampleOn,
  set(on: boolean) {
    sampleOn = on;
    try {
      localStorage.setItem(SAMPLE_KEY, on ? "1" : "0");
    } catch {
      /* storage unavailable — mode still applies for this session */
    }
    sampleListeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    sampleListeners.add(listener);
    return () => {
      sampleListeners.delete(listener);
    };
  },
};

/* ---------- sign-in token ----------
   JWT from POST /auth/login, sent as `Authorization: Bearer …` on every request. Any 401 outside the
   login call itself (expired/revoked session) fires UNAUTHORIZED_EVENT so the app returns to /login. */
const TOKEN_KEY = "fityes-token";
export const UNAUTHORIZED_EVENT = "fityes:unauthorized";
let token: string | null = (() => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
})();
export const authToken = {
  get: () => token,
  set(value: string | null) {
    token = value;
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable — token still applies for this session */
    }
  },
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly params: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: Query): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return `${BASE}${path}${s ? `?${s}` : ""}`;
}

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      signal: opts.signal,
      headers: {
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(sampleOn ? { "X-Sample-Data": "1" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "network", "Can't reach the API. Is the backend running?");
  }

  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login") window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    let code = "http_error";
    let message = res.statusText || "Request failed";
    let params: Record<string, unknown> = {};
    try {
      const data = await res.json();
      if (typeof data?.message === "string") message = data.message;
      if (typeof data?.code === "string") code = data.code;
      if (data?.params && typeof data.params === "object") params = data.params;
      // FastAPI validation errors
      if (Array.isArray(data?.detail)) {
        code = "validation";
        message = data.detail.map((d: { loc: string[]; msg: string }) => `${d.loc.at(-1)}: ${d.msg}`).join(", ");
      } else if (typeof data?.detail === "string") message = data.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, message, params);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>("GET", path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
};
