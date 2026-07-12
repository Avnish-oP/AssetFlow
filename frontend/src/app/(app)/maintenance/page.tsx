"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { buttonClass, FormField, fileInputClass, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { Modal, PageHeader, Panel, Toolbar } from "@/components/shared/Layout";
import { StatusPill } from "@/components/shared/StatusPill";
import {
  apiFetch,
  apiUpload,
  type Asset,
  type KanbanBoard,
  type MaintenanceRequest,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";

const COLUMN_ORDER = ["pending", "approved", "technician_assigned", "in_progress", "resolved"] as const;
const COLUMN_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  technician_assigned: "Technician Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
};
const COLUMN_DOT: Record<string, string> = {
  pending: "bg-amber",
  approved: "bg-green",
  technician_assigned: "bg-blue",
  in_progress: "bg-blue",
  resolved: "bg-green",
};

function KanbanCard({
  item,
  dimmed,
  draggable,
  onApprove,
  onReject,
  onAdvance,
}: {
  item: MaintenanceRequest;
  dimmed?: boolean;
  draggable: boolean;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onAdvance?: (id: number, nextStatus: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(item.id),
    disabled: !draggable,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      className={`card-surface card-surface-hover p-3 ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${
        dimmed ? "opacity-60" : ""
      } ${isDragging ? "z-10 opacity-90 shadow-lg" : ""}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <StatusPill value={item.priority} />
        <span className="text-xs text-secondary">{item.asset_tag ?? `Asset #${item.asset_id}`}</span>
      </div>
      <p className="text-sm text-primary">{item.issue_description}</p>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>{item.technician_name ? `Tech: ${item.technician_name}` : `Raised by #${item.raised_by}`}</span>
        <span>{new Date(item.created_at).toLocaleDateString()}</span>
      </div>

      {/* Action buttons — shown only to managers */}
      {item.status === "pending" && (onApprove || onReject) ? (
        <div className="mt-2 flex gap-2">
          {onApprove ? (
            <button
              type="button"
              className={`${buttonClass} flex-1 text-xs`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onApprove(item.id); }}
            >
              Approve
            </button>
          ) : null}
          {onReject ? (
            <button
              type="button"
              className={`${secondaryButtonClass} flex-1 text-xs`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onReject(item.id); }}
            >
              Reject
            </button>
          ) : null}
        </div>
      ) : null}

      {item.status === "approved" && onAdvance ? (
        <button
          type="button"
          className={`${buttonClass} mt-2 w-full text-xs`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onAdvance(item.id, "technician_assigned"); }}
        >
          Assign technician
        </button>
      ) : null}

      {item.status === "technician_assigned" && onAdvance ? (
        <button
          type="button"
          className={`${buttonClass} mt-2 w-full text-xs`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onAdvance(item.id, "in_progress"); }}
        >
          Start work
        </button>
      ) : null}

      {item.status === "in_progress" && onAdvance ? (
        <button
          type="button"
          className={`${buttonClass} mt-2 w-full text-xs bg-green text-white`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onAdvance(item.id, "resolved"); }}
        >
          Mark resolved
        </button>
      ) : null}
    </div>
  );
}

function KanbanColumn({
  status,
  items,
  draggable,
  onApprove,
  onReject,
  onAdvance,
}: {
  status: string;
  items: MaintenanceRequest[];
  draggable: boolean;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onAdvance?: (id: number, nextStatus: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !draggable });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[420px] flex-col rounded-[var(--radius-card)] border border-line bg-bg/40 ${
        isOver ? "border-line-strong" : ""
      }`}
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-3">
        <span className={`h-2 w-2 rounded-full ${COLUMN_DOT[status] ?? "bg-muted"}`} />
        <span className="text-sm font-medium">{COLUMN_LABELS[status] ?? status}</span>
        <span className="ml-auto rounded-full border border-line bg-raised px-2 py-0.5 text-[11px] text-secondary">
          {items.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {items.map((item) => (
          <KanbanCard
            key={item.id}
            item={item}
            dimmed={status === "resolved"}
            draggable={draggable}
            onApprove={status === "pending" ? onApprove : undefined}
            onReject={status === "pending" ? onReject : undefined}
            onAdvance={["approved", "technician_assigned", "in_progress"].includes(status) ? onAdvance : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  const { user } = useAuth();
  const canRaise = can(user?.role, "maintenance_raise");
  const canAdvance = can(user?.role, "maintenance_advance");
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [assignment, setAssignment] = useState<{ requestId: number; nextStatus: string } | null>(null);
  const [technicianName, setTechnicianName] = useState("On-call tech");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(async () => {
    const data = await apiFetch<KanbanBoard>("/maintenance/kanban");
    setBoard(data);
  }, []);

  useEffect(() => {
    load().catch(() => setBoard({ columns: COLUMN_ORDER.map((status) => ({ status, count: 0, items: [] })) }));
    apiFetch<Asset[]>("/assets")
      .then(setAssets)
      .catch(() => setAssets([]));
  }, [load]);

  const columns = useMemo(() => {
    const byStatus = new Map((board?.columns ?? []).map((column) => [column.status, column.items]));
    return COLUMN_ORDER.map((status) => {
      let items = byStatus.get(status) ?? [];
      if (priorityFilter) items = items.filter((item) => item.priority === priorityFilter);
      if (search.trim()) {
        const q = search.toLowerCase();
        items = items.filter(
          (item) =>
            item.issue_description.toLowerCase().includes(q) ||
            (item.asset_tag ?? "").toLowerCase().includes(q) ||
            (item.asset_name ?? "").toLowerCase().includes(q),
        );
      }
      return { status, items };
    });
  }, [board, priorityFilter, search]);

  async function onDragEnd(event: DragEndEvent) {
    if (!canAdvance) return;
    const requestId = Number(event.active.id);
    const targetStatus = event.over?.id ? String(event.over.id) : null;
    if (!targetStatus || !COLUMN_ORDER.includes(targetStatus as (typeof COLUMN_ORDER)[number])) return;

    const current = columns.flatMap((column) => column.items).find((item) => item.id === requestId);
    if (!current || current.status === targetStatus) return;

    setError(null);
    try {
      const body: { status: string; technician_name?: string } = { status: targetStatus };
      if (targetStatus === "technician_assigned" && !current.technician_name) {
        setTechnicianName("On-call tech");
        setAssignment({ requestId, nextStatus: targetStatus });
        return;
      }
      await apiFetch(`/maintenance/${requestId}/status`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } catch (err) {
      const detail = (err as { detail?: unknown })?.detail;
      setError(typeof detail === "string" ? detail : "Could not update status");
    }
  }

  async function approveRequest(requestId: number) {
    if (!canAdvance) return;
    setError(null);
    try {
      await apiFetch(`/maintenance/${requestId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      });
      await load();
    } catch (err) {
      const detail = (err as { detail?: unknown })?.detail;
      setError(typeof detail === "string" ? detail : "Could not approve request");
    }
  }

  async function advanceRequest(requestId: number, nextStatus: string) {
    if (!canAdvance) return;
    setError(null);
    try {
      const body: { status: string; technician_name?: string } = { status: nextStatus };
      if (nextStatus === "technician_assigned") {
        const current = columns.flatMap((c) => c.items).find((item) => item.id === requestId);
        if (!current?.technician_name) {
          setTechnicianName("On-call tech");
          setAssignment({ requestId, nextStatus });
          return;
        }
      }
      await apiFetch(`/maintenance/${requestId}/status`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } catch (err) {
      const detail = (err as { detail?: unknown })?.detail;
      setError(typeof detail === "string" ? detail : "Could not advance request");
    }
  }

  async function rejectRequest(requestId: number) {
    if (!canAdvance) return;
    setError(null);
    try {
      await apiFetch(`/maintenance/${requestId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected" }),
      });
      await load();
    } catch (err) {
      const detail = (err as { detail?: unknown })?.detail;
      setError(typeof detail === "string" ? detail : "Could not reject request");
    }
  }

  async function submitAssignment() {
    if (!assignment || !technicianName.trim()) return;
    setError(null);
    try {
      await apiFetch(`/maintenance/${assignment.requestId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: assignment.nextStatus, technician_name: technicianName.trim() }),
      });
      setAssignment(null);
      setTechnicianName("On-call tech");
      await load();
    } catch (err) {
      const detail = (err as { detail?: unknown })?.detail;
      setError(typeof detail === "string" ? detail : "Could not assign technician");
    }
  }

  async function raiseRequest(form: FormData) {
    setError(null);
    await apiFetch("/maintenance", {
      method: "POST",
      body: JSON.stringify({
        asset_id: Number(form.get("asset_id")),
        issue_description: String(form.get("issue_description")),
        priority: String(form.get("priority") || "medium"),
        photo_url: photoUrl || String(form.get("photo_url") || "") || null,
      }),
    });
    setShowForm(false);
    setPhotoUrl("");
    await load();
  }

  async function onPhotoSelected(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await apiUpload("/uploads", file, "maintenance");
      setPhotoUrl(uploaded.url);
    } catch {
      setError("Photo upload failed — is MinIO running?");
    } finally {
      setUploading(false);
    }
  }

  const empty = columns.every((column) => column.items.length === 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Maintenance"
        description="Approve requests, assign technicians, track work, and resolve assets back to service."
        actions={
          <button className={buttonClass} type="button" onClick={() => setShowForm(true)} disabled={!canRaise}>
            Raise request
          </button>
        }
      />

      {!canAdvance ? (
        <p className="text-xs text-secondary">View-only kanban — only admin / asset managers can advance status.</p>
      ) : null}

      <Toolbar>
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Search assets or issues"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className={`${inputClass} max-w-[160px]`} value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </Toolbar>

      {error ? <p className="text-sm text-red">{error}</p> : null}

      {showForm ? (
        <Panel>
          <form
          className="grid min-w-0 gap-3 overflow-hidden md:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await raiseRequest(new FormData(event.currentTarget));
            } catch (err) {
              const detail = (err as { detail?: unknown })?.detail;
              setError(typeof detail === "string" ? detail : "Could not create request");
            }
          }}
          >
          <FormField label="Asset">
            <select className={inputClass} name="asset_id" required>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.tag} — {asset.name} ({asset.status})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Priority">
            <select className={inputClass} name="priority" defaultValue="medium">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </FormField>
          <FormField label="Issue description">
            <textarea className={`${inputClass} h-24 py-2`} name="issue_description" required />
          </FormField>
          <FormField label="Photo / document">
            <div className="min-w-0 overflow-hidden">
              <input
                className={fileInputClass}
                type="file"
                accept="image/*,application/pdf"
                onChange={(event) => void onPhotoSelected(event.target.files?.[0] ?? null)}
              />
            </div>
            {uploading ? <p className="mt-1 text-xs text-secondary">Uploading…</p> : null}
            {photoUrl ? (
              <p className="mt-1 truncate text-xs text-green" title={photoUrl}>
                Uploaded
              </p>
            ) : null}
          </FormField>
          <FormField label="Or photo URL (optional)">
            <input
              className={inputClass}
              name="photo_url"
              placeholder="https://..."
              value={photoUrl}
              onChange={(event) => setPhotoUrl(event.target.value)}
            />
          </FormField>
          <div className="flex gap-2 md:col-span-2">
            <button className={buttonClass} type="submit">
              Submit
            </button>
            <button className={secondaryButtonClass} type="button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
          </form>
        </Panel>
      ) : null}

      {empty && !showForm ? (
        <EmptyState
          title="No maintenance requests yet"
          description="Raise a request; approval flips the asset to under maintenance."
          action="Raise request"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid gap-3 xl:grid-cols-5 lg:grid-cols-3 md:grid-cols-2">
            {columns.map((column) => (
              <KanbanColumn
                key={column.status}
                status={column.status}
                items={column.items}
                draggable={canAdvance}
                onApprove={canAdvance ? approveRequest : undefined}
                onReject={canAdvance ? rejectRequest : undefined}
                onAdvance={canAdvance ? advanceRequest : undefined}
              />
            ))}
          </div>
        </DndContext>
      )}

      {assignment ? (
        <Modal
          title="Assign technician"
          description="Add the technician name before moving this request into the assigned column."
          onClose={() => setAssignment(null)}
        >
          <div className="grid gap-3">
            <FormField label="Technician name">
              <input
                className={inputClass}
                value={technicianName}
                onChange={(event) => setTechnicianName(event.target.value)}
                autoFocus
              />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <button className={buttonClass} type="button" onClick={() => void submitAssignment()} disabled={!technicianName.trim()}>
                Assign technician
              </button>
              <button className={secondaryButtonClass} type="button" onClick={() => setAssignment(null)}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
