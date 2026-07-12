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
import { buttonClass, FormField, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { StatusPill } from "@/components/shared/StatusPill";
import {
  apiFetch,
  type Asset,
  type KanbanBoard,
  type MaintenanceRequest,
} from "@/lib/api";

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

function KanbanCard({ item, dimmed }: { item: MaintenanceRequest; dimmed?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(item.id) });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`card-surface card-surface-hover cursor-grab p-3 active:cursor-grabbing ${
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
    </div>
  );
}

function KanbanColumn({
  status,
  items,
}: {
  status: string;
  items: MaintenanceRequest[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
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
          <KanbanCard key={item.id} item={item} dimmed={status === "resolved"} />
        ))}
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    const requestId = Number(event.active.id);
    const targetStatus = event.over?.id ? String(event.over.id) : null;
    if (!targetStatus || !COLUMN_ORDER.includes(targetStatus as (typeof COLUMN_ORDER)[number])) return;

    const current = columns.flatMap((column) => column.items).find((item) => item.id === requestId);
    if (!current || current.status === targetStatus) return;

    setError(null);
    try {
      const body: { status: string; technician_name?: string } = { status: targetStatus };
      if (targetStatus === "technician_assigned" && !current.technician_name) {
        const name = window.prompt("Technician name", "On-call tech") ?? "";
        if (!name.trim()) return;
        body.technician_name = name.trim();
      }
      await apiFetch(`/maintenance/${requestId}/status`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } catch (err) {
      const detail = (err as { detail?: unknown })?.detail;
      setError(typeof detail === "string" ? detail : "Could not update status");
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
        photo_url: String(form.get("photo_url") || "") || null,
      }),
    });
    setShowForm(false);
    await load();
  }

  const empty = columns.every((column) => column.items.length === 0);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Maintenance</h1>
          <p className="text-sm text-secondary">Drag cards across the workflow. Asset status flips automatically.</p>
        </div>
        <button className={buttonClass} type="button" onClick={() => setShowForm(true)}>
          Raise request
        </button>
      </header>

      <div className="flex flex-wrap gap-3">
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
      </div>

      {error ? <p className="text-sm text-red">{error}</p> : null}

      {showForm ? (
        <form
          className="card-surface grid gap-3 p-4 md:grid-cols-2"
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
          <FormField label="Photo URL (optional)">
            <input className={inputClass} name="photo_url" placeholder="https://..." />
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
      ) : null}

      {empty && !showForm ? (
        <EmptyState
          title="No maintenance requests yet"
          description="Raise a request to put an asset under maintenance."
          action="Raise request"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid gap-3 xl:grid-cols-5 lg:grid-cols-3 md:grid-cols-2">
            {columns.map((column) => (
              <KanbanColumn key={column.status} status={column.status} items={column.items} />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}
