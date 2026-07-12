"use client";

import { useEffect, useMemo, useState } from "react";
import { ConflictBanner } from "@/components/shared/ConflictBanner";
import { DataTable, TableRow } from "@/components/shared/DataTable";
import { DatePicker } from "@/components/shared/DatePicker";
import { Select } from "@/components/shared/Select";
import { buttonClass, FormField, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { Modal, PageHeader, Panel, SectionHeader } from "@/components/shared/Layout";import { StatusPill } from "@/components/shared/StatusPill";
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
  const [transferAssetId, setTransferAssetId] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [transferReason, setTransferReason] = useState("Required for active project handoff");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { showToast } = useToast();

  const [returnTarget, setReturnTarget] = useState<Allocation | null>(null);
  const [returnNotes, setReturnNotes] = useState("");
  const [returnCondition, setReturnCondition] = useState("good");
  const [message, setMessage] = useState<string | null>(null);
  const [transferAssetId, setTransferAssetId] = useState<number | "">("");
  const [transferToId, setTransferToId] = useState<number | "">("");
  const transferableAllocations = allocations.filter((a) => a.status === "active");

  async function refresh() {
    setLoadError(null);
    try {
      const nextAssets = await apiFetch<Asset[]>("/assets");
      setAssets(nextAssets);
    } catch {
      setAssets([]);
      setLoadError("Could not load assets.");
    }
    // status=active|overdue is org-wide so employees can request transfers of held assets
    const [nextEmployees, activeAllocations, overdueAllocations, nextTransfers] = await Promise.all([
      apiFetch<User[]>("/employees").catch(() => [] as User[]),
      apiFetch<Allocation[]>("/allocations?status=active").catch(() => [] as Allocation[]),
      apiFetch<Allocation[]>("/allocations?status=overdue").catch(() => [] as Allocation[]),
      apiFetch<TransferRequest[]>("/transfers").catch(() => [] as TransferRequest[]),
    ]);
    const byId = new Map<number, Allocation>();
    for (const row of [...activeAllocations, ...overdueAllocations]) {
      byId.set(row.id, row);
    }
    setEmployees(nextEmployees);
    setAllocations([...byId.values()]);
    setTransfers(nextTransfers);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    if (!transferToId && user.role === "employee") {
      setTransferToId(String(user.id));
    }
  }, [user, transferToId]);

  const transferableAllocations = useMemo(
    () =>
      allocations.filter(
        (row) =>
          (row.status === "active" || row.status === "overdue") &&
          row.holder_user_id != null &&
          row.holder_user_id !== user?.id,
      ),
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
      setTransferAssetId("");
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
    setTransferAssetId(String(allocation.asset_id));
    if (user?.id) setTransferToId(String(user.id));
    setTransferReason("Requesting transfer of allocated asset");
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-[1.85rem] tracking-tight">Allocation & transfer</h1>
        <p className="text-sm text-secondary">
          Direct re-allocation is blocked when an active holder exists. Request a transfer instead.
        </p>
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
      ) : null}

      {canRequestTransfer ? (
        <form
          className="card-surface grid gap-3 p-4 md:grid-cols-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await submitStandaloneTransfer(new FormData(event.currentTarget));
          }}
        >
          <FormField label="Request transfer of">
            <Select
              name="asset_id"
              value={transferAssetId}
              onChange={setTransferAssetId}
              placeholder="Select allocated asset"
              required
              options={transferableAllocations.map((allocation) => ({
                value: String(allocation.asset_id),
                label: `${assetLabel(allocation.asset_id)} — held by ${employeeName(allocation.holder_user_id)}`,
              }))}
            />
          </FormField>
          <FormField label="Transfer to">
            <Select
              name="to_holder_id"
              value={transferToId}
              onChange={setTransferToId}
              placeholder="Select employee"
              required
              options={employees.map((employee) => ({
                value: String(employee.id),
                label: `${employee.name}${employee.id === user?.id ? " (you)" : ""}`,
              }))}
            />
          </FormField>
          <FormField label="Reason">
            <input
              className={inputClass}
              value={transferReason}
              onChange={(event) => setTransferReason(event.target.value)}
              required
            />
          </FormField>
          <button
            disabled={isSubmitting || transferableAllocations.length === 0}
            className={`${buttonClass} mt-6`}
          >
            {isSubmitting ? "Submitting..." : "Request transfer"}
          </button>
        </form>
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
              <Select
                name="to_holder_id"
                options={employees.map((employee) => ({
                  value: String(employee.id),
                  label: employee.name,
                }))}
                defaultValue={user?.id ? String(user.id) : employees[0] ? String(employees[0].id) : ""}
              />
            </FormField>
            <FormField label="Reason">
              <input className={inputClass} value={transferReason} onChange={(event) => setTransferReason(event.target.value)} />
            </FormField>
            <button disabled={isSubmitting} className={`${secondaryButtonClass} mt-6`}>
              {isSubmitting ? "Submitting..." : "Submit transfer"}
            </button>
          </form>
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
                  {canRequestTransfer &&
                  (allocation.status === "active" || allocation.status === "overdue") &&
                  allocation.holder_user_id !== user?.id ? (
                    <button
                      className="text-xs text-blue hover:underline"
                      type="button"
                      onClick={() => prefillTransfer(allocation)}
                    >
                      Request transfer
                    </button>
                  ) : null}
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
        </Modal>
      ) : null}
    </div>
  );
}
