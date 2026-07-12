"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { buttonClass, FormField, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { StatusPill } from "@/components/shared/StatusPill";
import { useToast } from "@/components/shared/Toast";
import { apiFetch, type Asset } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";

type Category = { id: number; name: string };

export default function AssetsPage() {
  const { user } = useAuth();
  const canWrite = can(user?.role, "assets_write");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    setLoadError(null);
    apiFetch<Asset[]>(`/assets?${params.toString()}`)
      .then(setAssets)
      .catch(() => {
        setAssets([]);
        setLoadError("Could not load assets. Check that the API is running and you are signed in.");
      });
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canWrite) return;
    apiFetch<Category[]>("/categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [canWrite]);

  async function createAsset(form: FormData) {
    const categoryValue = String(form.get("category_id") || "");
    const costValue = String(form.get("acquisition_cost") || "").trim();
    const dateValue = String(form.get("acquisition_date") || "").trim();
    const payload = {
      name: form.get("name"),
      category_id: categoryValue ? Number(categoryValue) : null,
      serial_number: form.get("serial_number") || null,
      location: form.get("location") || null,
      condition: String(form.get("condition") || "good"),
      acquisition_date: dateValue || null,
      acquisition_cost: costValue ? Number(costValue) : null,
      is_bookable: form.get("is_bookable") === "on",
    };
    setIsSubmitting(true);
    try {
      const asset = await apiFetch<Asset>("/assets", { method: "POST", body: JSON.stringify(payload) });
      setAssets((current) => [asset, ...current]);
      showToast("Asset registered successfully", "success");
    } catch {
      showToast("Failed to register asset", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-xl font-semibold">Assets</h1>
        <p className="text-sm text-secondary">
          {canWrite ? "Register assets and filter the asset directory." : "Browse the asset directory (read-only)."}
        </p>
      </header>

      {canWrite ? (
        <div className="card-surface grid gap-4 p-4">
          <form
            className="grid gap-3 md:grid-cols-3 lg:grid-cols-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              await createAsset(new FormData(form));
              form.reset();
            }}
          >
            <FormField label="Asset name">
              <input className={inputClass} name="name" required />
            </FormField>
            <FormField label="Category">
              <select className={inputClass} name="category_id" defaultValue="">
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Serial number">
              <input className={inputClass} name="serial_number" />
            </FormField>
            <FormField label="Location">
              <input className={inputClass} name="location" />
            </FormField>
            <FormField label="Condition">
              <select className={inputClass} name="condition" defaultValue="good">
                <option value="new">New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="damaged">Damaged</option>
              </select>
            </FormField>
            <FormField label="Acquisition date">
              <input className={inputClass} name="acquisition_date" type="date" />
            </FormField>
            <FormField label="Acquisition cost">
              <input className={inputClass} name="acquisition_cost" type="number" min="0" step="0.01" />
            </FormField>
            <label className="flex items-center gap-2 pt-6 text-sm text-secondary">
              <input name="is_bookable" type="checkbox" /> Bookable
            </label>
            <button disabled={isSubmitting} className={`${buttonClass} mt-6`}>
              {isSubmitting ? "Registering..." : "Register asset"}
            </button>
          </form>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Search tag, name, serial"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className={`${inputClass} max-w-[180px]`} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="allocated">Allocated</option>
          <option value="maintenance">Maintenance</option>
          <option value="reserved">Reserved</option>
          <option value="lost">Lost</option>
          <option value="retired">Retired</option>
          <option value="disposed">Disposed</option>
        </select>
        <button className={secondaryButtonClass} type="button" onClick={() => load()}>
          Apply filters
        </button>
      </div>

      {loadError ? (
        <EmptyState title="Could not load assets" description={loadError} action="Retry" onAction={() => load()} />
      ) : null}
      {loadError ? <p className="text-sm text-red">{loadError}</p> : null}

      {!loadError && assets.length === 0 ? (
        <EmptyState title="No assets found" description="Register an asset or clear filters." />
      ) : null}

      {!loadError && assets.length > 0 ? (
        <DataTable headers={["Tag", "Name", "Status", "Condition", "Location", "Bookable"]}>
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td className="px-4 py-3 font-medium">{asset.tag}</td>
              <td className="px-4 py-3">{asset.name}</td>
              <td className="px-4 py-3">
                <StatusPill value={asset.status} />
              </td>
              <td className="px-4 py-3 text-secondary">{asset.condition}</td>
              <td className="px-4 py-3 text-secondary">{asset.location ?? "—"}</td>
              <td className="px-4 py-3 text-secondary">{asset.is_bookable ? "Yes" : "No"}</td>
            </tr>
          ))}
        </DataTable>
      ) : null}
    </div>
  );
}
