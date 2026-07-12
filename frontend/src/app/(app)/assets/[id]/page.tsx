"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { secondaryButtonClass } from "@/components/shared/FormField";
import { StatusPill } from "@/components/shared/StatusPill";
import { apiFetch, type Allocation, type Asset, type MaintenanceRequest } from "@/lib/api";

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const assetId = Number(params.id);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!assetId) return;
    Promise.all([
      apiFetch<Asset>(`/assets/${assetId}`),
      apiFetch<Allocation[]>(`/allocations?asset_id=${assetId}`).catch(() => [] as Allocation[]),
      apiFetch<MaintenanceRequest[]>(`/maintenance`).catch(() => [] as MaintenanceRequest[]),
    ])
      .then(([nextAsset, nextAllocations, allMaintenance]) => {
        setAsset(nextAsset);
        setAllocations(nextAllocations);
        setMaintenance(allMaintenance.filter((row) => row.asset_id === assetId));
      })
      .catch(() => setError("Could not load asset detail."));
  }, [assetId]);

  if (error) {
    return (
      <div className="grid gap-4">
        <Link href="/assets" className={secondaryButtonClass}>
          Back to directory
        </Link>
        <EmptyState title="Asset not found" description={error} />
      </div>
    );
  }

  if (!asset) {
    return <p className="text-sm text-secondary">Loading asset…</p>;
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-secondary">
            <Link href="/assets" className="hover:text-primary">
              Assets
            </Link>{" "}
            / {asset.tag}
          </p>
          <h1 className="mt-1 text-xl font-semibold">
            {asset.tag} — {asset.name}
          </h1>
          <p className="text-sm text-secondary">
            {asset.location ?? "No location"} · {asset.is_bookable ? "Bookable" : "Non-bookable"}
          </p>
        </div>
        <StatusPill value={asset.status} />
      </header>

      <section className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-4">
        <div>
          <div className="text-xs text-secondary">Condition</div>
          <div className="text-sm">{asset.condition}</div>
        </div>
        <div>
          <div className="text-xs text-secondary">Serial</div>
          <div className="text-sm">{asset.serial_number ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-secondary">Category</div>
          <div className="text-sm">{asset.category_id ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-secondary">Location</div>
          <div className="text-sm">{asset.location ?? "—"}</div>
        </div>
        {"acquisition_date" in asset && (asset as Record<string, unknown>).acquisition_date ? (
          <div>
            <div className="text-xs text-secondary">Acquired</div>
            <div className="text-sm">{String((asset as Record<string, unknown>).acquisition_date)}</div>
          </div>
        ) : null}
        {"acquisition_cost" in asset && (asset as Record<string, unknown>).acquisition_cost != null ? (
          <div>
            <div className="text-xs text-secondary">Cost</div>
            <div className="text-sm">₹{Number((asset as Record<string, unknown>).acquisition_cost).toLocaleString()}</div>
          </div>
        ) : null}
        {asset.photo_url ? (
          <div className="md:col-span-4">
            <div className="text-xs text-secondary mb-1">Photo</div>
            <img
              src={asset.photo_url}
              alt={asset.name}
              className="h-40 w-auto max-w-full rounded-lg border border-line object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
            <p className="hidden text-xs text-secondary">{asset.photo_url}</p>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-base font-medium">Allocation history</h2>
        {allocations.length === 0 ? (
          <EmptyState title="No allocations yet" description="This asset has not been issued." />
        ) : (
          <DataTable headers={["Holder", "Status", "Allocated", "Expected return", "Returned"]}>
            {allocations.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 text-secondary">{row.holder_user_id ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusPill value={row.status} />
                </td>
                <td className="px-4 py-3 text-secondary">{new Date(row.allocated_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-secondary">{row.expected_return_date ?? "—"}</td>
                <td className="px-4 py-3 text-secondary">
                  {row.returned_at ? new Date(row.returned_at).toLocaleString() : "—"}
                  {row.return_condition_notes ? ` · ${row.return_condition_notes}` : ""}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-medium">Maintenance history</h2>
        {maintenance.length === 0 ? (
          <EmptyState title="No maintenance requests" description="Repairs for this asset will appear here." />
        ) : (
          <DataTable headers={["Issue", "Priority", "Status", "Technician", "Opened"]}>
            {maintenance.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">{row.issue_description}</td>
                <td className="px-4 py-3">
                  <StatusPill value={row.priority} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill value={row.status} />
                </td>
                <td className="px-4 py-3 text-secondary">{row.technician_name ?? "—"}</td>
                <td className="px-4 py-3 text-secondary">{new Date(row.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
