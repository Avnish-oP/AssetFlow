"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, TableRow } from "@/components/shared/DataTable";
import { DatePicker } from "@/components/shared/DatePicker";
import { EmptyState } from "@/components/shared/EmptyState";
import { buttonClass, FormField, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { PageHeader, Panel, SectionHeader } from "@/components/shared/Layout";import { StatusPill } from "@/components/shared/StatusPill";
import {
  apiFetch,
  type AuditCycle,
  type AuditCycleDetail,
  type DiscrepancyReport,
  type User,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";
import { Select } from "@/components/shared/Select";
import { MultiSelect } from "@/components/shared/MultiSelect";

type Department = { id: number; name: string };

export default function AuditsPage() {
  const { user } = useAuth();
  const allowed = can(user?.role, "audits");
  const [cycles, setCycles] = useState<AuditCycle[]>([]);
  const [selected, setSelected] = useState<AuditCycleDetail | null>(null);
  const [report, setReport] = useState<DiscrepancyReport | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadCycles = useCallback(async () => {
    const data = await apiFetch<AuditCycle[]>("/audits");
    setCycles(data);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    loadCycles().catch(() => {
      setCycles([]);
      setError("Could not load audit cycles.");
    });
    apiFetch<User[]>("/employees").then(setEmployees).catch(() => setEmployees([]));
    apiFetch<Department[]>("/departments").then(setDepartments).catch(() => setDepartments([]));
  }, [allowed, loadCycles]);

  if (!allowed) {
    return (
      <div className="grid gap-4">
        <PageHeader title="Audit cycles" />        <EmptyState title="Insufficient permissions" description="Audits are limited to admin and asset managers." />
      </div>
    );
  }

  async function openCycle(id: number) {
    setReport(null);
    const detail = await apiFetch<AuditCycleDetail>(`/audits/${id}`);
    setSelected(detail);
  }

  async function createCycle(form: FormData) {
    setError(null);
    const auditorIds = form.getAll("auditor_ids").map((value) => Number(value)).filter(Boolean);
    const cycle = await apiFetch<AuditCycle>("/audits", {
      method: "POST",
      body: JSON.stringify({
        name: String(form.get("name")),
        scope_department_id: form.get("scope_department_id") ? Number(form.get("scope_department_id")) : null,
        scope_location: String(form.get("scope_location") || "") || null,
        start_date: String(form.get("start_date")),
        end_date: String(form.get("end_date")),
        auditor_ids: auditorIds,
      }),
    });
    setShowForm(false);
    await loadCycles();
    await openCycle(cycle.id);
  }

  async function verifyItem(itemId: number, verification_status: string) {
    if (!selected) return;
    setError(null);
    try {
      await apiFetch(`/audits/${selected.id}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ verification_status }),
      });
      await openCycle(selected.id);
      await loadCycles();
    } catch (err) {
      const detail = (err as { detail?: unknown })?.detail;
      setError(typeof detail === "string" ? detail : "Verification failed");
    }
  }

  async function closeCycle() {
    if (!selected) return;
    setError(null);
    try {
      await apiFetch(`/audits/${selected.id}/close`, { method: "POST" });
      const discrepancy = await apiFetch<DiscrepancyReport>(`/audits/${selected.id}/report`);
      setReport(discrepancy);
      await openCycle(selected.id);
      await loadCycles();
    } catch (err) {
      const detail = (err as { detail?: unknown })?.detail;
      setError(typeof detail === "string" ? detail : "Could not close cycle");
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Audit cycles"
        description="Verify assets, flag missing or damaged items, and close cycles with discrepancy reports."
        actions={
          <button className={buttonClass} type="button" onClick={() => setShowForm(true)}>
            Create cycle
          </button>
        }
      />
      {error ? <p className="text-sm text-red">{error}</p> : null}

      {showForm ? (
        <Panel>
          <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await createCycle(new FormData(event.currentTarget));
            } catch (err) {
              const detail = (err as { detail?: unknown })?.detail;
              setError(typeof detail === "string" ? detail : "Could not create cycle");
            }
          }}
          >
          <FormField label="Cycle name">
            <input className={inputClass} name="name" required placeholder="Q3 Physical Audit" />
          </FormField>
          <FormField label="Scope department">
            <Select
              name="scope_department_id"
              defaultValue=""
              options={[
                { value: "", label: "All departments" },
                ...departments.map((department) => ({
                  value: String(department.id),
                  label: department.name,
                })),
              ]}
            />
          </FormField>
          <FormField label="Scope location">
            <input className={inputClass} name="scope_location" placeholder="Engineering" />
          </FormField>
          <FormField label="Auditors">
            <MultiSelect
              name="auditor_ids"
              placeholder="Select auditors"
              options={employees.map((employee) => ({
                value: String(employee.id),
                label: employee.name,
              }))}
            />
          </FormField>
          <FormField label="Start date">
            <DatePicker name="start_date" required placeholder="Start date" />
          </FormField>
          <FormField label="End date">
            <DatePicker name="end_date" required placeholder="End date" />
          </FormField>
          <div className="flex gap-2 md:col-span-2">
            <button className={buttonClass} type="submit">
              Create
            </button>
            <button className={secondaryButtonClass} type="button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
          </form>
        </Panel>
      ) : null}

      {cycles.length === 0 && !showForm ? (
        <EmptyState
          title="No audit cycles yet"
          description="Create a cycle to populate assets in scope and start verification."
          action="Create cycle"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cycles.map((cycle) => {
            const progress = cycle.total_items ? Math.round(((cycle.total_items - cycle.pending_count) / cycle.total_items) * 100) : 0;
            return (
              <button
                key={cycle.id}
                type="button"
                className="card-surface card-surface-hover p-4 text-left"
                onClick={() => openCycle(cycle.id).catch(() => setError("Could not load cycle"))}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-base font-medium">{cycle.name}</h2>
                  <StatusPill value={cycle.status} />
                </div>
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-raised">
                  <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-secondary">
                  <span>{cycle.verified_count} verified</span>
                  <span>{cycle.missing_count} missing</span>
                  <span>{cycle.damaged_count} damaged</span>
                  <span>{cycle.pending_count} pending</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <section className="grid gap-4">
          <SectionHeader
            title={selected.name}
            description={
              <>
                {selected.start_date} → {selected.end_date}
                {selected.scope_location ? ` · ${selected.scope_location}` : ""}
              </>
            }
            actions={
              selected.status === "open" ? (
                <button className={secondaryButtonClass} type="button" onClick={() => closeCycle()}>
                  Close cycle
                </button>
              ) : (
                <button
                  className={secondaryButtonClass}
                  type="button"
                  onClick={() =>
                    apiFetch<DiscrepancyReport>(`/audits/${selected.id}/report`)
                      .then(setReport)
                      .catch(() => setError("Could not load report"))
                  }
                >
                  View report
                </button>
              )
            }
          />

          <DataTable headers={["Asset", "Location", "Status", "Actions"]}>
            {selected.items.map((item) => (
              <TableRow
                key={item.id}
                className={item.verification_status === "missing" ? "bg-red-bg/40" : ""}
              >
                <td className="px-4 py-3">
                  <div>{item.asset_tag ?? item.asset_id}</div>
                  <div className="text-xs text-secondary">{item.asset_name}</div>
                </td>
                <td className="px-4 py-3 text-secondary">{item.expected_location ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusPill value={item.verification_status} />
                </td>
                <td className="px-4 py-3">
                  {selected.status === "open" && item.verification_status === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <button className="text-xs text-brand hover:underline" type="button" onClick={() => verifyItem(item.id, "verified")}>
                        Verify
                      </button>
                      <button className="text-xs text-red hover:underline" type="button" onClick={() => verifyItem(item.id, "missing")}>
                        Mark missing
                      </button>
                      <button className="text-xs text-amber hover:underline" type="button" onClick={() => verifyItem(item.id, "damaged")}>
                        Mark damaged
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </TableRow>
            ))}
          </DataTable>
        </section>
      ) : null}

      {report ? (
        <Panel>
          <h2 className="mb-2 text-base font-medium">Discrepancy report — {report.cycle_name}</h2>
          <p className="mb-4 text-sm text-secondary">
            {report.missing_count} missing · {report.damaged_count} damaged · {report.verified_count} verified
          </p>
          <DataTable headers={["Asset", "Status", "Location", "Notes"]}>
            {report.items.map((item) => (
              <TableRow key={item.item_id} className={item.verification_status === "missing" ? "bg-red-bg/40" : ""}>
                <td className="px-4 py-3">
                  {item.asset_tag} {item.asset_name}
                </td>
                <td className="px-4 py-3">
                  <StatusPill value={item.verification_status} />
                </td>
                <td className="px-4 py-3 text-secondary">{item.expected_location ?? "—"}</td>
                <td className="px-4 py-3 text-secondary">{item.notes ?? "—"}</td>
              </TableRow>
            ))}
          </DataTable>
        </Panel>
      ) : null}
    </div>
  );
}
