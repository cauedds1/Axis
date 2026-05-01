import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class LimitReachedError extends Error {
  limitReached = true;
  plan: string;
  reason: string;
  current?: number;
  limit?: number;
  upgradeUrl: string;

  constructor(data: { plan: string; reason: string; current?: number; limit?: number; upgradeUrl?: string }) {
    super(data.reason);
    this.plan = data.plan;
    this.reason = data.reason;
    this.current = data.current;
    this.limit = data.limit;
    this.upgradeUrl = data.upgradeUrl || '/pricing';
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let body: any;
    try {
      body = await res.json();
    } catch {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }

    if (res.status === 402 && body?.limitReached) {
      const err = new LimitReachedError({
        plan: body.plan,
        reason: body.reason || body.message || "Limite do plano atingido",
        current: body.current,
        limit: body.limit,
        upgradeUrl: body.upgradeUrl || '/pricing',
      });
      window.dispatchEvent(new CustomEvent('axis:limit-reached', { detail: err }));
      throw err;
    }

    const raw = body?.message ?? body?.error ?? body;
    let message: string;
    if (typeof raw === "string") {
      message = raw;
    } else if (Array.isArray(raw)) {
      message = raw.map((e: any) => e.message || JSON.stringify(e)).join("; ");
    } else {
      message = JSON.stringify(raw);
    }
    throw new Error(message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
