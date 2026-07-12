"use client";

import { useEffect, useState } from "react";
import { ConflictBanner } from "@/components/shared/ConflictBanner";
import { DataTable } from "@/components/shared/DataTable";
import { buttonClass, FormField, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { StatusPill } from "@/components/shared/StatusPill";
import { useToast } from "@/components/shared/Toast";
import { apiFetch, type Allocation, type ApiError, type Asset, type User } from "@/lib/api";

type Conflict = {
  asset_id: number;
  asset_tag?: string;
  asset_name?: string;
  current_holder?: { holder_name?: string; department?: string; holder_user_id?: number };
};

export default function AllocationsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [transferReason, setTransferReason] = useState("Required for active project handoff");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    apiFetch<Asset[]>("/assets").then(setAssets).catch(() => setAssets([]));
    apiFetch<User[]>("/employees").then(setEmployees).catch(() => setEmployees([]));
    apiFetch<Allocation[]>("/allocations").then(setAllocations).catch(() => setAllocations([]));
  }, []);

  async function submitAllocation(form: FormData) {
    setConflict(null);
    setIsSubmitting(true);
    try {
      const allocation = await apiFetch<Allocation>("/allocations", {
        method: "POST",
        body: JSON.stringify({
          asset_id: Number(form.get("asset_id")),
          holder_user_id: Number(form.get("holder_user_id")),
          expected_return_date: form.get("expected_return_date") || null,
        }),
      });
      setAllocations((current) => [allocation, ...current]);
      showToast("Asset allocated successfully", "success");
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 409) {
        setConflict(apiError.detail as Conflict);
        showToast("Asset already allocated", "error");
      } else {
        showToast("Failed to allocate asset", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitTransfer(form: FormData) {
    if (!conflict) return;
    setIsSubmitting(true);
    try {
      await apiFetch("/transfers", {
        method: "POST",
        body: JSON.stringify({ asset_id: conflict.asset_id, to_holder_id: Number(form.get("to_holder_id")), reason: transferReason }),
      });
      setConflict(null);
      showToast("Transfer request submitted", "success");
    } catch {
      showToast("Failed to submit transfer", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-xl font-semibold">Allocation & transfer</h1>
        <p className="text-sm text-secondary">Direct re-allocation is blocked when an active holder exists.</p>
      </header>
      <form
        className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-4"
        onSubmit={async (event) => {
          event.preventDefault();
          await submitAllocation(new FormData(event.currentTarget));
        }}
      >
        <FormField label="Asset"><select className={inputClass} name="asset_id">{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.tag} {asset.name}</option>)}</select></FormField>
        <FormField label="Holder"><select className={inputClass} name="holder_user_id">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></FormField>
        <FormField label="Expected return"><input className={inputClass} name="expected_return_date" type="date" /></FormField>
        <button disabled={isSubmitting} className={`${buttonClass} mt-6`}>
          {isSubmitting ? "Allocating..." : "Allocate"}
        </button>
      </form>
      {conflict ? (
        <div className="grid gap-4">
          <ConflictBanner title={`Already allocated: ${conflict.asset_tag ?? "Asset"}`}>
            Currently held by {conflict.current_holder?.holder_name ?? "another holder"}
            {conflict.current_holder?.department ? ` (${conflict.current_holder.department})` : ""}. Submit a transfer request instead.
          </ConflictBanner>
          <form
            className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_2fr_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              await submitTransfer(new FormData(event.currentTarget));
            }}
          >
            <FormField label="Transfer to"><select className={inputClass} name="to_holder_id">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></FormField>
            <FormField label="Reason"><input className={inputClass} value={transferReason} onChange={(event) => setTransferReason(event.target.value)} /></FormField>
            <button disabled={isSubmitting} className={`${secondaryButtonClass} mt-6`}>
              {isSubmitting ? "Submitting..." : "Submit transfer"}
            </button>
          </form>
        </div>
      ) : null}
      <DataTable headers={["Asset", "Holder", "Allocated", "Status"]}>
        {allocations.map((allocation) => {
          const assetName = assets.find((a) => a.id === allocation.asset_id)?.name ?? `ID: ${allocation.asset_id}`;
          const assetTag = assets.find((a) => a.id === allocation.asset_id)?.tag ?? "";
          const holderName = employees.find((e) => e.id === allocation.holder_user_id)?.name ?? `ID: ${allocation.holder_user_id}`;
          return (
            <tr key={allocation.id}>
              <td className="px-4 py-3 text-secondary">
                {assetTag} <span className="text-primary">{assetName}</span>
              </td>
              <td className="px-4 py-3">{allocation.holder_user_id ? holderName : "-"}</td>
              <td className="px-4 py-3 text-secondary">{new Date(allocation.allocated_at).toLocaleString()}</td>
              <td className="px-4 py-3"><StatusPill value={allocation.status} /></td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}

