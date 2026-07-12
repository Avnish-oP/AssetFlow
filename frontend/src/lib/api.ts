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
  category_id?: number | null;
  serial_number?: string | null;
  location?: string | null;
  is_bookable: boolean;
  photo_url?: string | null;
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

export type NotificationItem = {
  id: number;
  user_id: number;
  user_name?: string | null;
  user_email?: string | null;
  type: string;
  message: string;
  related_entity_type?: string | null;
  related_entity_id?: number | null;
  is_read: boolean;
  created_at: string;
};

export type ReportAssetStat = {
  asset_id: number;
  tag: string;
  name: string;
  status: string;
  condition: string;
  location?: string | null;
  usage_count: number;
  allocation_count: number;
  booking_count: number;
  maintenance_count: number;
  age_days?: number | null;
};

export type ReportSummary = {
  generated_at: string;
  totals: {
    total_assets: number;
    available_assets: number;
    allocated_assets: number;
    maintenance_assets: number;
    bookable_assets: number;
    active_allocations: number;
    overdue_allocations: number;
    active_bookings: number;
    overdue_bookings: number;
    pending_transfers: number;
    utilization_rate: number;
  };
  most_used: ReportAssetStat[];
  idle_assets: ReportAssetStat[];
  maintenance_frequency: ReportAssetStat[];
  retirement_candidates: ReportAssetStat[];
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

export type DashboardSummary = {
  available: number;
  allocated: number;
  maintenance: number;
  bookings_today: number;
  pending_transfers: number;
  due_this_week: number;
  returned_this_week: number;
  overdue_allocations: number;
  unread_notifications: number;
};

export type UtilizationReport = {
  series: { date: string; allocations: number; bookings: number }[];
};

export type AssetUsageReport = {
  most_used: { asset_id: number; tag: string; name: string; status: string; allocation_count: number; booking_count: number }[];
  idle: { asset_id: number; tag: string; name: string; status: string; allocation_count: number; booking_count: number }[];
};

export type MaintenanceFrequencyReport = {
  items: { asset_id: number; tag: string; name: string; request_count: number }[];
};

export type RetirementReport = {
  items: {
    asset_id: number;
    tag: string;
    name: string;
    condition: string;
    status: string;
    acquisition_date?: string | null;
    reason: string;
  }[];
};

export type BookingHeatmapReport = {
  cells: { weekday: number; hour: number; count: number }[];
};

export type DepartmentAllocationReport = {
  items: {
    department_id?: number | null;
    department_name: string;
    active_allocations: number;
    overdue_allocations: number;
  }[];
};

export type AppNotification = {
  id: number;
  user_id: number;
  type: string;
  message: string;
  related_entity_type?: string | null;
  related_entity_id?: number | null;
  is_read: boolean;
  created_at: string;
};

export type ActivityLog = {
  id: number;
  actor_id?: number | null;
  actor_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};
