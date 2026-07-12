/** Frontend UX role matrix. Backend `require_role` remains the security source of truth. */

export type AppRole = "admin" | "asset_manager" | "dept_head" | "employee";

export type Capability =
  | "org_setup"
  | "org_promote"
  | "assets_write"
  | "allocations_manage"
  | "transfer_request"
  | "transfer_approve"
  | "allocation_return"
  | "bookings"
  | "maintenance_raise"
  | "maintenance_advance"
  | "audits"
  | "reports"
  | "notifications"
  | "dashboard_kpis";

const MATRIX: Record<Capability, AppRole[]> = {
  org_setup: ["admin", "asset_manager"],
  org_promote: ["admin"],
  assets_write: ["admin", "asset_manager"],
  allocations_manage: ["admin", "asset_manager", "dept_head"],
  transfer_request: ["admin", "asset_manager", "dept_head", "employee"],
  transfer_approve: ["admin", "asset_manager", "dept_head"],
  allocation_return: ["admin", "asset_manager", "dept_head", "employee"],
  bookings: ["admin", "asset_manager", "dept_head", "employee"],
  maintenance_raise: ["admin", "asset_manager", "dept_head", "employee"],
  maintenance_advance: ["admin", "asset_manager"],
  audits: ["admin", "asset_manager"],
  reports: ["admin", "asset_manager", "dept_head"],
  notifications: ["admin", "asset_manager", "dept_head", "employee"],
  dashboard_kpis: ["admin", "asset_manager", "dept_head"],
};

/** Nav href → minimum capability to see the link */
const NAV_CAPABILITY: Record<string, Capability | null> = {
  "/dashboard": null,
  "/org-setup": "org_setup",
  "/assets": null,
  "/allocations": "transfer_request",
  "/bookings": "bookings",
  "/maintenance": "maintenance_raise",
  "/audits": "audits",
  "/reports": "reports",
  "/notifications": "notifications",
};

export function can(role: string | undefined | null, capability: Capability): boolean {
  if (!role) return false;
  return MATRIX[capability].includes(role as AppRole);
}

export function canSeeNav(role: string | undefined | null, href: string): boolean {
  const capability = NAV_CAPABILITY[href];
  if (capability == null) return Boolean(role);
  return can(role, capability);
}
