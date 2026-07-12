"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DataTable, TableRow } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { buttonClass, FormField, fileInputClass, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { PageHeader, Panel, Toolbar } from "@/components/shared/Layout";
import { StatusPill } from "@/components/shared/StatusPill";
import { useToast } from "@/components/shared/Toast";
import { apiFetch, apiUpload, type Asset } from "@/lib/api";
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
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (categoryId) params.set("category_id", categoryId);
    if (location) params.set("location", location);
    setLoadError(null);
    apiFetch<Asset[]>(`/assets?${params.toString()}`)
      .then(setAssets)
      .catch(() => {
        setAssets([]);
        setLoadError("Could not load assets. Check that the API is running and you are signed in.");
      });
  }, [search, status, categoryId, location]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch<Category[]>("/categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  async function createAsset(form: FormData) {
    const categoryValue = String(form.get("category_id") || "");
    const costValue = String(form.get("acquisition_cost") || "").trim();
    const dateValue = String(form.get("acquisition_date") || "").trim();
    const payload = {
      name: form.get("name"),
      category_id: categoryValue ? Number(categoryValue) : null,
      serial_number: form.get("serial_number") || null,
      acquisition_date: dateValue || null,
      acquisition_cost: costValue ? Number(costValue) : null,
      condition: String(form.get("condition") || "good"),
      location: form.get("location") || null,
      photo_url: photoUrl || form.get("photo_url") || null,
      is_bookable: form.get("is_bookable") === "on",
    };
    setIsSubmitting(true);
    try {
      const asset = await apiFetch<Asset>("/assets", { method: "POST", body: JSON.stringify(payload) });
      setAssets((current) => [asset, ...current]);
      setPhotoUrl("");
      showToast(`Asset ${asset.tag} registered`, "success");
    } catch {
      showToast("Failed to register asset", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onPhotoSelected(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await apiUpload("/uploads", file, "assets");
      setPhotoUrl(uploaded.url);
      showToast("Photo uploaded", "success");
    } catch {
      showToast("Photo upload failed — is MinIO running?", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Assets"
        description={
          canWrite
            ? "Register assets with automatic tags and search by tag, serial, QR value, or name."
            : "Browse the asset directory in read-only mode."
        }
      />

      {canWrite ? (
        <Panel>
          <form
            className="grid min-w-0 gap-3 md:grid-cols-3 lg:grid-cols-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              await createAsset(new FormData(form));
              form.reset();
              setPhotoUrl("");
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
            <FormField label="Location">
              <input className={inputClass} name="location" />
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
            <FormField label="Or photo URL">
              <input
                className={inputClass}
                name="photo_url"
                placeholder="https://…"
                value={photoUrl}
                onChange={(event) => setPhotoUrl(event.target.value)}
              />
            </FormField>
            <label className="flex min-w-0 items-center gap-2 pt-6 text-sm text-secondary">
              <input name="is_bookable" type="checkbox" /> Shared / bookable
            </label>
            <button disabled={isSubmitting} className={`${buttonClass} mt-6 md:col-span-2 lg:col-span-1`}>
              {isSubmitting ? "Registering..." : "Register asset"}
            </button>
          </form>
        </Panel>
      ) : null}

      <Toolbar>
        <input
          className={`${inputClass} max-w-full sm:max-w-xs`}
          placeholder="Search by tag, serial, name, or QR value…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className={`${inputClass} max-w-full sm:max-w-[180px]`} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="allocated">Allocated</option>
          <option value="reserved">Reserved</option>
          <option value="maintenance">Maintenance</option>
          <option value="lost">Lost</option>
          <option value="retired">Retired</option>
          <option value="disposed">Disposed</option>
        </select>
        <select className={`${inputClass} max-w-full sm:max-w-[200px]`} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          className={`${inputClass} max-w-full sm:max-w-[12rem]`}
          placeholder="Location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
        <button className={secondaryButtonClass} type="button" onClick={() => load()}>
          Apply filters
        </button>
      </Toolbar>

      {loadError ? (
        <EmptyState title="Could not load assets" description={loadError} action="Retry" onAction={() => load()} />
      ) : null}

      {!loadError && assets.length === 0 ? (
        <EmptyState title="No assets found" description="Adjust filters or register a new asset." />
      ) : null}

      {!loadError && assets.length > 0 ? (
        <DataTable headers={["Tag", "Name", "Category", "Location", "Condition", "Status", "Bookable"]}>
          {assets.map((asset) => (
            <TableRow key={asset.id}>
              <td className="px-4 py-3">
                <Link className="text-green hover:underline" href={`/assets/${asset.id}`}>
                  {asset.tag}
                </Link>
              </td>
              <td className="px-4 py-3">{asset.name}</td>
              <td className="px-4 py-3 text-secondary">
                {categories.find((c) => c.id === asset.category_id)?.name ?? "—"}
              </td>
              <td className="px-4 py-3 text-secondary">{asset.location ?? "—"}</td>
              <td className="px-4 py-3 text-secondary">{asset.condition}</td>
              <td className="px-4 py-3">
                <StatusPill value={asset.status} />
              </td>
              <td className="px-4 py-3 text-secondary">{asset.is_bookable ? "Yes" : "No"}</td>
            </TableRow>
          ))}
        </DataTable>
      ) : null}
    </div>
  );
}
