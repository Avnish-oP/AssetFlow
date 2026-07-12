"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/shared/DataTable";
import { buttonClass, FormField, inputClass } from "@/components/shared/FormField";
import { StatusPill } from "@/components/shared/StatusPill";
import { useToast } from "@/components/shared/Toast";
import { apiFetch, type Asset } from "@/lib/api";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    apiFetch<Asset[]>(`/assets?${params.toString()}`)
      .then(setAssets)
      .catch(() => setAssets([]));
  }, [search, status]);

  async function createAsset(form: FormData) {
    const payload = {
      name: form.get("name"),
      serial_number: form.get("serial_number") || null,
      location: form.get("location") || null,
      is_bookable: form.get("is_bookable") === "on",
      condition: "good",
    };
    setIsSubmitting(true);
    try {
      const asset = await apiFetch<Asset>("/assets", { method: "POST", body: JSON.stringify(payload) });
      setAssets((current) => [asset, ...current]);
      showToast("Asset registered successfully", "success");
      form.get("name"); // Just to use form in try
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
        <p className="text-sm text-secondary">Register assets and filter the asset directory.</p>
      </header>
      <div className="grid gap-4 rounded-lg border border-line bg-surface p-4">
        <form
          className="grid gap-3 md:grid-cols-5"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            await createAsset(new FormData(form));
            if (!isSubmitting) form.reset();
          }}
        >
          <FormField label="Asset name"><input className={inputClass} name="name" required /></FormField>
          <FormField label="Serial number"><input className={inputClass} name="serial_number" /></FormField>
          <FormField label="Location"><input className={inputClass} name="location" /></FormField>
          <label className="flex items-center gap-2 pt-6 text-sm text-secondary"><input name="is_bookable" type="checkbox" /> Bookable</label>
          <button disabled={isSubmitting} className={`${buttonClass} mt-6`}>
            {isSubmitting ? "Registering..." : "Register asset"}
          </button>
        </form>
      </div>
      <div className="flex gap-3">
        <input className={`${inputClass} w-72`} placeholder="Search assets" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="allocated">Allocated</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>
      <DataTable headers={["Tag", "Name", "Location", "Bookable", "Status"]}>
        {assets.map((asset) => (
          <tr key={asset.id}>
            <td className="px-4 py-3 text-secondary">{asset.tag}</td>
            <td className="px-4 py-3">{asset.name}</td>
            <td className="px-4 py-3 text-secondary">{asset.location ?? "-"}</td>
            <td className="px-4 py-3 text-secondary">{asset.is_bookable ? "Yes" : "No"}</td>
            <td className="px-4 py-3"><StatusPill value={asset.status} /></td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
