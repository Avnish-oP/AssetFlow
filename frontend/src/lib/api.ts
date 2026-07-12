export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ApiError = {
  status: number;
  detail: unknown;
};

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("assetflow_access_token") : null;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw { status: response.status, detail: body?.detail ?? body } satisfies ApiError;
  }
  return body as T;
}

export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  department_id?: number | null;
  status: string;
};

export type Asset = {
  id: number;
  tag: string;
  name: string;
  status: string;
  condition: string;
  location?: string | null;
  is_bookable: boolean;
};

export type Allocation = {
  id: number;
  asset_id: number;
  holder_user_id?: number | null;
  holder_department_id?: number | null;
  status: string;
  allocated_at: string;
  expected_return_date?: string | null;
};

export type Booking = {
  id: number;
  resource_id: number;
  booked_by: number;
  status: string;
  start: string;
  end: string;
};

