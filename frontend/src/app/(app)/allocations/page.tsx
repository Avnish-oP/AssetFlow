"use client";

import { useEffect, useState } from "react";
import { ConflictBanner } from "@/components/shared/ConflictBanner";
import { DataTable, TableRow } from "@/components/shared/DataTable";
import { DatePicker } from "@/components/shared/DatePicker";
import { buttonClass, FormField, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { Select } from "@/components/shared/Select";
import { StatusPill } from "@/components/shared/StatusPill";
import { useToast } from "@/components/shared/Toast";
import {
  apiFetch,
  type Allocation,
  type ApiError,
  type Asset,
  type TransferRequest,
  type User,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/roles";

type Conflict = {
  asset_id: number;
  asset_tag?: string;
  asset_name?: string;
  current_holder?: { holder_name?: string; department?: string; holder_user_id?: number };
};

export default function AllocationsPage() {
  const { user } = useAuth();
  const canManage = can(user?.role, "allocations_manage");
  const canRequestTransfer = can(user?.role, "transfer_request");
  const canApproveTransfer = can(user?.role, "transfer_approve");
  const canReturn = can(user?.role, "allocation_return");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [transferReason, setTransferReason] = useState("Required for active project handoff");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { showToast } = useToast();

  const [returnTarget, setReturnTarget] = useState<Allocation | null>(null);
  const [returnNotes, setReturnNotes] = useState("");
  const [returnCondition, setReturnCondition] = useState("good");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setLoadError(null);
    try {
      const nextAssets = await apiFetch<Asset[]>("/assets");
      setAssets(nextAssets);
    } catch {
      setAssets([]);
      setLoadError("Could not load assets.");
    }
    const [nextEmployees, nextAllocations, nextTransfers] = await Promise.all([
      apiFetch<User[]>("/employees").catch(() => [] as User[]),
      apiFetch<Allocation[]>("/allocations").catch(() => [] as Allocation[]),
      apiFetch<TransferRequest[]>("/transfers").catch(() => [] as TransferRequest[]),
    ]);
    setEmployees(nextEmployees);
    setAllocations(nextAllocations);
    setTransfers(nextTransfers);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function submitAllocation(form: FormData) {
    setConflict(null);
    setIsSubmitting(true);
    setMessage(null);
    try {
      await apiFetch<Allocation>("/allocations", {
        method: "POST",
        body: JSON.stringify({
          asset_id: Number(form.get("asset_id")),
          holder_user_id: Number(form.get("holder_user_id")),
          expected_return_date: form.get("expected_return_date") || null,
        }),
      });
      await refresh();
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
        body: JSON.stringify({
          asset_id: conflict.asset_id,
          to_holder_id: Number(form.get("to_holder_id")),
          reason: transferReason,
        }),
      });
      setConflict(null);
      showToast("Transfer request submitted", "success");
      await refresh();
    } catch {
      showToast("Failed to submit transfer", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function actOnTransfer(id: number, action: "approve" | "complete" | "reject") {
    setMessage(null);
    await apiFetch(`/transfers/${id}/${action}`, { method: "POST" });
    setMessage(`Transfer ${action}d`);
    await refresh();
  }

  async function submitReturn() {
    if (!returnTarget) return;
    await apiFetch(`/allocations/${returnTarget.id}/return`, {
      method: "POST",
      body: JSON.stringify({
        return_condition_notes: returnNotes || null,
        condition: returnCondition,
      }),
    });
    setReturnTarget(null);
    setReturnNotes("");
    setReturnCondition("good");
    setMessage("Asset returned");
    await refresh();
  }

  const employeeName = (id?: number | null) => employees.find((employee) => employee.id === id)?.name ?? (id ? `#${id}` : "—");
  const assetLabel = (id: number) => {
    const asset = assets.find((row) => row.id === id);
    return asset ? `${asset.tag} ${asset.name}` : `#${id}`;
  };

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-[1.85rem] tracking-tight">Allocation & transfer</h1>
        <p className="text-sm text-secondary">Direct re-allocation is blocked when an active holder exists.</p>
      </header>

      {message ? <p className="text-sm text-brand">{message}</p> : null}
      {loadError ? <p className="text-sm text-red">{loadError}</p> : null}

      {canManage ? (
      <form
        className="card-surface grid gap-3 p-4 md:grid-cols-4"
        onSubmit={async (event) => {
          event.preventDefault();
          await submitAllocation(new FormData(event.currentTarget));
        }}
      >
        <FormField label="Asset">
          <Select
            key={`alloc-asset-${assets[0]?.id ?? "x"}`}
            name="asset_id"
            options={assets.map((asset) => ({
              value: String(asset.id),
              label: `${asset.tag} ${asset.name}`,
            }))}
            defaultValue={assets[0] ? String(assets[0].id) : ""}
          />
        </FormField>
        <FormField label="Holder">
          <Select
            key={`alloc-holder-${employees[0]?.id ?? "x"}`}
            name="holder_user_id"
            options={employees.map((employee) => ({
              value: String(employee.id),
              label: employee.name,
            }))}
            defaultValue={employees[0] ? String(employees[0].id) : ""}
          />
        </FormField>
        <FormField label="Expected return">
          <DatePicker name="expected_return_date" placeholder="Expected return" />
        </FormField>
        <button disabled={isSubmitting} className={`${buttonClass} mt-6`}>
          {isSubmitting ? "Allocating..." : "Allocate"}
        </button>
      </form>
      ) : (
        <p className="text-sm text-secondary">You can submit a transfer request when an allocation conflict appears.</p>
      )}

      {conflict && canRequestTransfer ? (
        <div className="grid gap-4">
          <ConflictBanner title={`Already allocated: ${conflict.asset_tag ?? "Asset"}`}>
            Currently held by {conflict.current_holder?.holder_name ?? "another holder"}
            {conflict.current_holder?.department ? ` (${conflict.current_holder.department})` : ""}. Submit a transfer
            request instead.
          </ConflictBanner>
          <form
            className="card-surface grid gap-3 p-4 md:grid-cols-[1fr_2fr_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              await submitTransfer(new FormData(event.currentTarget));
            }}
          >
            <FormField label="Transfer to">
              <Select
                name="to_holder_id"
                options={employees.map((employee) => ({
                  value: String(employee.id),
                  label: employee.name,
                }))}
                defaultValue={employees[0] ? String(employees[0].id) : ""}
              />
            </FormField>
            <FormField label="Reason">
              <input className={inputClass} value={transferReason} onChange={(event) => setTransferReason(event.target.value)} />
            </FormField>
            <button disabled={isSubmitting} className={`${secondaryButtonClass} mt-6`}>{isSubmitting ? "Submitting..." : "Submit transfer"}</button>
          </form>
        </div>
      ) : null}

      <section className="grid gap-3">
        <h2 className="text-base font-medium">Active allocations</h2>
        <DataTable headers={["Asset", "Holder", "Allocated", "Due", "Status", ""]}>
          {allocations.map((allocation) => (
            <TableRow key={allocation.id}>
              <td className="px-4 py-3">{assetLabel(allocation.asset_id)}</td>
              <td className="px-4 py-3 text-secondary">{employeeName(allocation.holder_user_id)}</td>
              <td className="px-4 py-3 text-secondary">{new Date(allocation.allocated_at).toLocaleString()}</td>
              <td className="px-4 py-3 text-secondary">{allocation.expected_return_date ?? "—"}</td>
              <td className="px-4 py-3">
                <StatusPill value={allocation.status} />
              </td>
              <td className="px-4 py-3">
                {canReturn &&
                (allocation.status === "active" || allocation.status === "overdue") &&
                (canManage || allocation.holder_user_id === user?.id) ? (
                  <button
                    className="text-xs text-brand hover:underline"
                    type="button"
                    onClick={() => {
                      setReturnTarget(allocation);
                      setReturnNotes("");
                      setReturnCondition("good");
                    }}
                  >
                    Return
                  </button>
                ) : null}
              </td>
            </TableRow>
          ))}
        </DataTable>
      </section>

      <section className="grid gap-3">
        <h2 className="text-base font-medium">Transfer requests</h2>
        {transfers.some((transfer) => transfer.status === "approved") ? (
          <p className="text-xs text-amber">
            Approved transfers must be <span className="font-medium">Completed</span> to reallocate the asset to the new
            holder.
          </p>
        ) : null}
        <DataTable headers={["Asset", "From", "To", "Status", "Actions"]}>
          {transfers.map((transfer) => (
            <TableRow key={transfer.id}>
              <td className="px-4 py-3">{assetLabel(transfer.asset_id)}</td>
              <td className="px-4 py-3 text-secondary">{employeeName(transfer.from_holder_id)}</td>
              <td className="px-4 py-3 text-secondary">{employeeName(transfer.to_holder_id)}</td>
              <td className="px-4 py-3">
                <StatusPill value={transfer.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {canApproveTransfer && transfer.status === "requested" ? (
                    <>
                      <button className="text-xs text-brand hover:underline" type="button" onClick={() => actOnTransfer(transfer.id, "approve")}>
                        Approve
                      </button>
                      <button className="text-xs text-red hover:underline" type="button" onClick={() => actOnTransfer(transfer.id, "reject")}>
                        Reject
                      </button>
                    </>
                  ) : null}
                  {canApproveTransfer && transfer.status === "approved" ? (
                    <button
                      className={`${buttonClass} h-8 px-3 text-xs`}
                      type="button"
                      onClick={() => actOnTransfer(transfer.id, "complete")}
                    >
                      Complete reallocation
                    </button>
                  ) : null}
                </div>
              </td>
            </TableRow>
          ))}
        </DataTable>
      </section>

      {returnTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="card-surface w-full max-w-md p-5">
            <h3 className="mb-1 text-base font-medium">Return asset</h3>
            <p className="mb-4 text-sm text-secondary">{assetLabel(returnTarget.asset_id)}</p>
            <div className="grid gap-3">
              <FormField label="Condition">
                <Select
                  value={returnCondition}
                  onChange={setReturnCondition}
                  options={[
                    { value: "good", label: "Good" },
                    { value: "fair", label: "Fair" },
                    { value: "damaged", label: "Damaged" },
                  ]}
                />
              </FormField>
              <FormField label="Condition notes">
                <textarea
                  className={`${inputClass} h-24 py-2`}
                  value={returnNotes}
                  onChange={(event) => setReturnNotes(event.target.value)}
                  placeholder="Any wear, damage, or accessories returned"
                />
              </FormField>
              <div className="flex gap-2">
                <button className={buttonClass} type="button" onClick={() => submitReturn()}>
                  Confirm return
                </button>
                <button className={secondaryButtonClass} type="button" onClick={() => setReturnTarget(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
