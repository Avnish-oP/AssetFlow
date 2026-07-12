"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DataTable } from "@/components/shared/DataTable";
import { DatePicker } from "@/components/shared/DatePicker";
import { EmptyState } from "@/components/shared/EmptyState";
import { buttonClass, FormField, fileInputClass, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { Select } from "@/components/shared/Select";
import { StatusPill } from "@/components/shared/StatusPill";
import { useToast } from "@/components/shared/Toast";
import { apiFetch, apiUpload, type Asset, type ResourceRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";

type Category = { id: number; name: string };

export default function AssetsPage() {
  const { user } = useAuth();
  const canWrite = can(user?.role, "assets_write");
  const canReview = can(user?.role, "resource_request_review");
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
  const [formKey, setFormKey] = useState(0);
  const { showToast } = useToast();

  // Resource request state
  const [requestingAsset, setRequestingAsset] = useState<Asset | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [requestPriority, setRequestPriority] = useState("medium");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState<ResourceRequest[]>([]);
  const [allRequests, setAllRequests] = useState<ResourceRequest[]>([]);
  const [showRequests, setShowRequests] = useState(false);

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

  const loadRequests = useCallback(() => {
    apiFetch<ResourceRequest[]>("/resource-requests?mine=true")
      .then(setMyRequests)
      .catch(() => setMyRequests([]));
    if (canReview) {
      apiFetch<ResourceRequest[]>("/resource-requests?status=pending")
        .then(setAllRequests)
        .catch(() => setAllRequests([]));
    }
  }, [canReview]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch<Category[]>("/categories")
      .then(setCategories)
      .catch(() => setCategories([]));
    loadRequests();
  }, [loadRequests]);

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

  async function submitResourceRequest() {
    if (!requestingAsset || !requestReason.trim()) return;
    setRequestSubmitting(true);
    try {
      await apiFetch<ResourceRequest>("/resource-requests", {
        method: "POST",
        body: JSON.stringify({
          asset_id: requestingAsset.id,
          reason: requestReason,
          priority: requestPriority,
        }),
      });
      showToast(`Request submitted for ${requestingAsset.tag}`, "success");
      setRequestingAsset(null);
      setRequestReason("");
      setRequestPriority("medium");
      loadRequests();
    } catch (err) {
      const apiErr = err as { detail?: string | { message?: string } };
      const msg =
        typeof apiErr.detail === "string"
          ? apiErr.detail
          : (apiErr.detail as { message?: string })?.message ?? "Failed to submit request";
      showToast(msg, "error");
    } finally {
      setRequestSubmitting(false);
    }
  }

  async function reviewRequest(requestId: number, action: "approved" | "rejected") {
    try {
      await apiFetch(`/resource-requests/${requestId}/review`, {
        method: "POST",
        body: JSON.stringify({ status: action }),
      });
      showToast(`Request ${action}`, "success");
      loadRequests();
      load(); // refresh asset statuses
    } catch {
      showToast("Failed to review request", "error");
    }
  }

  return (
    <div className="grid gap-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-[1.85rem] tracking-tight">Assets</h1>
          <p className="text-sm text-secondary">
            {canWrite
              ? "Register assets (auto tag) and search the directory by tag, serial, or name."
              : "Browse available assets and request allocation."}
          </p>
        </div>
        <button
          className={secondaryButtonClass}
          onClick={() => setShowRequests(!showRequests)}
        >
          {showRequests
            ? "Hide Requests"
            : `My Requests${myRequests.length > 0 ? ` (${myRequests.length})` : ""}`}
        </button>
      </header>

      {/* Resource Request Modal */}
      {requestingAsset ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">Request Resource</h2>
            <p className="mt-1 text-sm text-secondary">
              Request{" "}
              <span className="text-green">{requestingAsset.tag}</span> —{" "}
              {requestingAsset.name}
            </p>
            <div className="mt-5 grid gap-4">
              <FormField label="Why do you need this resource?">
                <textarea
                  className={`${inputClass} h-24 resize-none pt-2`}
                  placeholder="Describe your use case..."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Priority">
                <select
                  className={inputClass}
                  value={requestPriority}
                  onChange={(e) => setRequestPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </FormField>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className={secondaryButtonClass}
                onClick={() => {
                  setRequestingAsset(null);
                  setRequestReason("");
                  setRequestPriority("medium");
                }}
              >
                Cancel
              </button>
              <button
                className={buttonClass}
                disabled={requestSubmitting || !requestReason.trim()}
                onClick={submitResourceRequest}
              >
                {requestSubmitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Requests Section */}
      {showRequests ? (
        <div className="grid gap-4">
          {/* Pending requests for admins to review */}
          {canReview && allRequests.length > 0 ? (
            <div className="card-surface p-4">
              <h3 className="mb-3 text-base font-medium text-amber">
                Pending Requests ({allRequests.length})
              </h3>
              <DataTable
                headers={[
                  "Asset",
                  "Requested By",
                  "Reason",
                  "Priority",
                  "Date",
                  "Actions",
                ]}
              >
                {allRequests.map((rr) => (
                  <tr key={rr.id}>
                    <td className="px-4 py-3">
                      <span className="text-green">{rr.asset_tag}</span>{" "}
                      <span className="text-secondary">{rr.asset_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      {rr.requester_name ?? `#${rr.requested_by}`}
                    </td>
                    <td
                      className="max-w-[200px] truncate px-4 py-3 text-secondary"
                      title={rr.reason}
                    >
                      {rr.reason}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={rr.priority} />
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {new Date(rr.created_at).toLocaleDateString()}
                    </td>
                    <td className="space-x-2 px-4 py-3">
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-green/20 px-3 text-xs font-medium text-green transition hover:bg-green/30"
                        onClick={() => reviewRequest(rr.id, "approved")}
                      >
                        Approve
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-red/20 px-3 text-xs font-medium text-red transition hover:bg-red/30"
                        onClick={() => reviewRequest(rr.id, "rejected")}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          ) : null}

          {/* User's own requests */}
          <div className="card-surface p-4">
            <h3 className="mb-3 text-base font-medium">My Requests</h3>
            {myRequests.length === 0 ? (
              <p className="py-4 text-center text-sm text-secondary">
                No resource requests yet.
              </p>
            ) : (
              <DataTable
                headers={["Asset", "Reason", "Priority", "Status", "Submitted"]}
              >
                {myRequests.map((rr) => (
                  <tr key={rr.id}>
                    <td className="px-4 py-3">
                      <span className="text-green">{rr.asset_tag}</span>{" "}
                      <span className="text-secondary">{rr.asset_name}</span>
                    </td>
                    <td
                      className="max-w-[200px] truncate px-4 py-3 text-secondary"
                      title={rr.reason}
                    >
                      {rr.reason}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={rr.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={rr.status} />
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {new Date(rr.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </div>
      ) : null}

      {canWrite ? (
        <div className="card-surface grid gap-4 overflow-hidden p-4">
          <form
            key={formKey}
            className="grid min-w-0 gap-3 md:grid-cols-3 lg:grid-cols-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              await createAsset(new FormData(form));
              form.reset();
              setPhotoUrl("");
              setFormKey((key) => key + 1);
            }}
          >
            <FormField label="Asset name">
              <input className={inputClass} name="name" required />
            </FormField>
            <FormField label="Category">
              <Select
                name="category_id"
                defaultValue=""
                options={[
                  { value: "", label: "Uncategorized" },
                  ...categories.map((category) => ({ value: String(category.id), label: category.name })),
                ]}
              />
            </FormField>
            <FormField label="Serial number">
              <input className={inputClass} name="serial_number" />
            </FormField>
            <FormField label="Condition">
              <Select
                name="condition"
                defaultValue="good"
                options={[
                  { value: "new", label: "New" },
                  { value: "good", label: "Good" },
                  { value: "fair", label: "Fair" },
                  { value: "damaged", label: "Damaged" },
                ]}
              />
            </FormField>
            <FormField label="Acquisition date">
              <DatePicker name="acquisition_date" placeholder="Acquisition date" />
            </FormField>
            <FormField label="Acquisition cost">
              <input
                className={inputClass}
                name="acquisition_cost"
                type="number"
                min="0"
                step="0.01"
              />
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
                  onChange={(event) =>
                    void onPhotoSelected(event.target.files?.[0] ?? null)
                  }
                />
              </div>
              {uploading ? (
                <p className="mt-1 text-xs text-secondary">Uploading…</p>
              ) : null}
              {photoUrl ? (
                <p className="mt-1 truncate text-xs text-brand" title={photoUrl}>
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
            <button
              disabled={isSubmitting}
              className={`${buttonClass} mt-6 md:col-span-2 lg:col-span-1`}
            >
              {isSubmitting ? "Registering..." : "+ Register asset"}
            </button>
          </form>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-wrap gap-3">
        <input
          className={`${inputClass} max-w-full sm:max-w-xs`}
          placeholder="Search by tag, serial, name, or QR value…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          className="max-w-full sm:max-w-[180px]"
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "All statuses" },
            { value: "available", label: "Available" },
            { value: "allocated", label: "Allocated" },
            { value: "reserved", label: "Reserved" },
            { value: "maintenance", label: "Maintenance" },
            { value: "lost", label: "Lost" },
            { value: "retired", label: "Retired" },
            { value: "disposed", label: "Disposed" },
          ]}
        />
        <Select
          className="max-w-full sm:max-w-[200px]"
          value={categoryId}
          onChange={setCategoryId}
          options={[
            { value: "", label: "All categories" },
            ...categories.map((category) => ({ value: String(category.id), label: category.name })),
          ]}
        />
        <input
          className={`${inputClass} max-w-full sm:max-w-[12rem]`}
          placeholder="Location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
        <button
          className={secondaryButtonClass}
          type="button"
          onClick={() => load()}
        >
          Apply filters
        </button>
      </div>

      {loadError ? (
        <EmptyState
          title="Could not load assets"
          description={loadError}
          action="Retry"
          onAction={() => load()}
        />
      ) : null}

      {!loadError && assets.length === 0 ? (
        <EmptyState
          title="No assets found"
          description="Adjust filters or register a new asset."
        />
      ) : null}

      {!loadError && assets.length > 0 ? (
        <DataTable
          headers={[
            "Tag",
            "Name",
            "Category",
            "Location",
            "Condition",
            "Status",
            "Bookable",
            "",
          ]}
        >
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td className="px-4 py-3">
                <Link className="text-brand hover:underline" href={`/assets/${asset.id}`}>
                  {asset.tag}
                </Link>
              </td>
              <td className="px-4 py-3">{asset.name}</td>
              <td className="px-4 py-3 text-secondary">
                {categories.find((c) => c.id === asset.category_id)?.name ??
                  "—"}
              </td>
              <td className="px-4 py-3 text-secondary">
                {asset.location ?? "—"}
              </td>
              <td className="px-4 py-3 text-secondary">{asset.condition}</td>
              <td className="px-4 py-3">
                <StatusPill value={asset.status} />
              </td>
              <td className="px-4 py-3 text-secondary">
                {asset.is_bookable ? "Yes" : "No"}
              </td>
              <td className="px-4 py-3">
                {asset.status === "available" && !asset.is_bookable ? (
                  <button
                    className="inline-flex h-8 items-center rounded-md bg-green/20 px-3 text-xs font-medium text-green transition hover:bg-green/30"
                    onClick={() => setRequestingAsset(asset)}
                  >
                    Request
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </DataTable>
      ) : null}
    </div>
  );
}
