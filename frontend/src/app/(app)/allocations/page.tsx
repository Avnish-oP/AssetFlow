"use client";

import { useEffect, useMemo, useState } from "react";
import { ConflictBanner } from "@/components/shared/ConflictBanner";
import { DataTable, TableRow } from "@/components/shared/DataTable";
import { buttonClass, FormField, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { Modal, PageHeader, Panel, SectionHeader } from "@/components/shared/Layout";
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
  const [transferAssetId, setTransferAssetId] = useState<number | "">("");
  const [transferToId, setTransferToId] = useState<number | "">("");
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
      apiFetch<Allocation[]>("/allocations?status=active").catch(() => [] as Allocation[]),
      apiFetch<TransferRequest[]>("/transfers").catch(() => [] as TransferRequest[]),
    ]);
    setEmployees(nextEmployees);
    setAllocations(nextAllocations);
    setTransfers(nextTransfers);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    if (transferToId === "" && user.role === "employee") {
      setTransferToId(user.id);
    }
  }, [user, transferToId]);

  const transferableAllocations = useMemo(
    () => allocations.filter((row) => row.holder_user_id != null && row.holder_user_id !== user?.id),
    [allocations, user?.id],
  );

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

  async function submitTransferRequest(assetId: number, toHolderId: number) {
    setIsSubmitting(true);
    try {
      await apiFetch("/transfers", {
        method: "POST",
        body: JSON.stringify({
          asset_id: assetId,
          to_holder_id: toHolderId,
          reason: transferReason,
        }),
      });
      setConflict(null);
      showToast("Transfer request submitted", "success");
      await refresh();
    } catch (error) {
      const apiError = error as ApiError;
      const detail = typeof apiError.detail === "string" ? apiError.detail : "Failed to submit transfer";
      showToast(detail, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitStandaloneTransfer(form: FormData) {
    const assetId = Number(form.get("asset_id") || transferAssetId);
    const toHolderId = Number(form.get("to_holder_id") || transferToId);
    if (!assetId || !toHolderId) {
      showToast("Pick an asset and transfer target", "error");
      return;
    }
    await submitTransferRequest(assetId, toHolderId);
  }

  async function submitConflictTransfer(form: FormData) {
    if (!conflict) return;
    await submitTransferRequest(conflict.asset_id, Number(form.get("to_holder_id")));
  }

  async function actOnTransfer(id: number, action: "approve" | "complete" | "reject") {
    setMessage(null);
    try {
      await apiFetch(`/transfers/${id}/${action}`, { method: "POST" });
      setMessage(`Transfer ${action}d`);
      await refresh();
    } catch {
      showToast(`Failed to ${action} transfer`, "error");
    }
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

  function prefillTransfer(allocation: Allocation) {
    setTransferAssetId(allocation.asset_id);
    if (user?.id) setTransferToId(user.id);
    setTransferReason("Requesting transfer of allocated asset");
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Allocation & transfer"
        description="Direct re-allocation is blocked when an active holder exists. Request a transfer instead."
      />

      {message ? <p className="text-sm text-green">{message}</p> : null}
      {loadError ? <p className="text-sm text-red">{loadError}</p> : null}

      {canManage ? (
        <Panel>
          <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await submitAllocation(new FormData(event.currentTarget));
          }}
          >
          <FormField label="Asset">
            <select className={inputClass} name="asset_id">
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.tag} {asset.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Holder">
            <select className={inputClass} name="holder_user_id">
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Expected return">
            <input className={inputClass} name="expected_return_date" type="date" />
          </FormField>
          <button disabled={isSubmitting} className={`${buttonClass} mt-6`}>
            {isSubmitting ? "Allocating..." : "Allocate"}
          </button>
          </form>
        </Panel>
      ) : null}

      {canRequestTransfer ? (
        <Panel>
          <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await submitStandaloneTransfer(new FormData(event.currentTarget));
          }}
          >
          <FormField label="Request transfer of">
            <select
              className={inputClass}
              name="asset_id"
              value={transferAssetId}
              onChange={(event) => setTransferAssetId(event.target.value ? Number(event.target.value) : "")}
              required
            >
              <option value="">Select allocated asset</option>
              {transferableAllocations.map((allocation) => (
                <option key={allocation.id} value={allocation.asset_id}>
                  {assetLabel(allocation.asset_id)} — held by {employeeName(allocation.holder_user_id)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Transfer to">
            <select
              className={inputClass}
              name="to_holder_id"
              value={transferToId}
              onChange={(event) => setTransferToId(event.target.value ? Number(event.target.value) : "")}
              required
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                  {employee.id === user?.id ? " (you)" : ""}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Reason">
            <input
              className={inputClass}
              value={transferReason}
              onChange={(event) => setTransferReason(event.target.value)}
              required
            />
          </FormField>
          <button disabled={isSubmitting || transferableAllocations.length === 0} className={`${buttonClass} mt-6`}>
            {isSubmitting ? "Submitting..." : "Request transfer"}
          </button>
          </form>
        </Panel>
      ) : null}

      {conflict && canRequestTransfer ? (
        <div className="grid gap-4">
          <ConflictBanner title={`Already allocated: ${conflict.asset_tag ?? "Asset"}`}>
            Currently held by {conflict.current_holder?.holder_name ?? "another holder"}
            {conflict.current_holder?.department ? ` (${conflict.current_holder.department})` : ""}. Submit a transfer
            request instead.
          </ConflictBanner>
          <Panel>
            <form
            className="grid gap-3 md:grid-cols-[1fr_2fr_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              await submitConflictTransfer(new FormData(event.currentTarget));
            }}
            >
            <FormField label="Transfer to">
              <select className={inputClass} name="to_holder_id" defaultValue={user?.id}>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Reason">
              <input className={inputClass} value={transferReason} onChange={(event) => setTransferReason(event.target.value)} />
            </FormField>
            <button disabled={isSubmitting} className={`${secondaryButtonClass} mt-6`}>
              {isSubmitting ? "Submitting..." : "Submit transfer"}
            </button>
            </form>
          </Panel>
        </div>
      ) : null}

      <section className="grid gap-3">
        <SectionHeader title="Active allocations" />
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
                <div className="flex flex-wrap gap-2">
                  {canRequestTransfer && allocation.holder_user_id !== user?.id ? (
                    <button className="text-xs text-blue hover:underline" type="button" onClick={() => prefillTransfer(allocation)}>
                      Request transfer
                    </button>
                  ) : null}
                  {canReturn &&
                  (allocation.status === "active" || allocation.status === "overdue") &&
                  (canManage || allocation.holder_user_id === user?.id) ? (
                    <button
                      className="text-xs text-green hover:underline"
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
                </div>
              </td>
            </TableRow>
          ))}
        </DataTable>
      </section>

      <section className="grid gap-3">
        <SectionHeader title="Transfer requests" />
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
                      <button className="text-xs text-green hover:underline" type="button" onClick={() => actOnTransfer(transfer.id, "approve")}>
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
                  {!canApproveTransfer && (transfer.status === "requested" || transfer.status === "approved") ? (
                    <span className="text-xs text-muted">Awaiting manager</span>
                  ) : null}
                </div>
              </td>
            </TableRow>
          ))}
        </DataTable>
      </section>

      {returnTarget ? (
        <Modal title="Return asset" description={assetLabel(returnTarget.asset_id)} onClose={() => setReturnTarget(null)}>
            <div className="grid gap-3">
              <FormField label="Condition">
                <select className={inputClass} value={returnCondition} onChange={(event) => setReturnCondition(event.target.value)}>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="damaged">Damaged</option>
                </select>
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
        </Modal>
      ) : null}
    </div>
  );
}
