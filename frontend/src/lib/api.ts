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
  returned_at?: string | null;
  return_condition_notes?: string | null;
};

export type Booking = {
  id: number;
  resource_id: number;
  booked_by: number;
  status: string;
  start: string;
  end: string;
};

export type TransferRequest = {
  id: number;
  asset_id: number;
  from_holder_id?: number | null;
  to_holder_id: number;
  reason: string;
  status: string;
  requested_by: number;
  approved_by?: number | null;
};

export type MaintenanceRequest = {
  id: number;
  asset_id: number;
  raised_by: number;
  issue_description: string;
  priority: string;
  photo_url?: string | null;
  status: string;
  approved_by?: number | null;
  technician_name?: string | null;
  resolved_at?: string | null;
  created_at: string;
  asset_tag?: string | null;
  asset_name?: string | null;
};

export type KanbanBoard = {
  columns: { status: string; count: number; items: MaintenanceRequest[] }[];
};

export type AuditCycle = {
  id: number;
  name: string;
  scope_department_id?: number | null;
  scope_location?: string | null;
  start_date: string;
  end_date: string;
  status: string;
  created_by: number;
  auditor_ids: number[];
  total_items: number;
  verified_count: number;
  missing_count: number;
  damaged_count: number;
  pending_count: number;
};

export type AuditItem = {
  id: number;
  cycle_id: number;
  asset_id: number;
  expected_location?: string | null;
  verification_status: string;
  notes?: string | null;
  verified_by?: number | null;
  verified_at?: string | null;
  asset_tag?: string | null;
  asset_name?: string | null;
  asset_condition?: string | null;
};

export type AuditCycleDetail = AuditCycle & {
  items: AuditItem[];
};

export type DiscrepancyReport = {
  cycle_id: number;
  cycle_name: string;
  missing_count: number;
  damaged_count: number;
  verified_count: number;
  pending_count: number;
  items: {
    item_id: number;
    asset_id: number;
    asset_tag?: string | null;
    asset_name?: string | null;
    verification_status: string;
    notes?: string | null;
    expected_location?: string | null;
  }[];
};
