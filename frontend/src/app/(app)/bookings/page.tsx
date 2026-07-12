"use client";

import { useEffect, useMemo, useState } from "react";
import { ConflictBanner } from "@/components/shared/ConflictBanner";
import { DataTable } from "@/components/shared/DataTable";
import { DatePicker } from "@/components/shared/DatePicker";
import { buttonClass, FormField, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { Select } from "@/components/shared/Select";
import { StatusPill } from "@/components/shared/StatusPill";
import { TimePicker } from "@/components/shared/TimePicker";
import { useToast } from "@/components/shared/Toast";
import { apiFetch, type ApiError, type Asset, type Booking } from "@/lib/api";

type DaySlot = {
  id: number;
  resource_id: number;
  booked_by: number;
  booked_by_name?: string;
  status: string;
  start: string;
  end: string;
};

type BookingConflict = {
  error?: string;
  conflicting_booking?: {
    booked_by_name?: string;
    start?: string;
    end?: string;
  };
};

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toTimeValue(hours: number, minutes = 0) {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

function formatClock(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function BookingsPage() {
  const [resources, setResources] = useState<Asset[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [daySlots, setDaySlots] = useState<DaySlot[]>([]);
  const [resourceId, setResourceId] = useState<number | "">("");
  const [date, setDate] = useState(todayIso());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [conflict, setConflict] = useState<BookingConflict | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();
  const [error, setError] = useState("");
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(todayIso());
  const [rescheduleStart, setRescheduleStart] = useState("09:00");
  const [rescheduleEnd, setRescheduleEnd] = useState("10:00");

  useEffect(() => {
    apiFetch<Asset[]>("/assets?is_bookable=true")
      .then((items) => {
        setResources(items);
        if (items[0]) setResourceId(items[0].id);
      })
      .catch(() => setError("Could not load bookable resources."));
    apiFetch<Booking[]>("/bookings")
      .then(setBookings)
      .catch(() => {
        setBookings([]);
        setError((prev) => prev || "Could not load bookings.");
      });
  }, []);

  async function loadDaySlots(nextResourceId: number, nextDate: string) {
    const slots = await apiFetch<DaySlot[]>(`/bookings/slots?resource_id=${nextResourceId}&date=${nextDate}`);
    setDaySlots(slots);
  }

  useEffect(() => {
    if (!resourceId || !date) return;
    loadDaySlots(Number(resourceId), date).catch(() => setDaySlots([]));
  }, [resourceId, date]);

  const requestedRange = useMemo(() => {
    if (!date || !start || !end) return null;
    const startAt = new Date(`${date}T${start}:00`);
    const endAt = new Date(`${date}T${end}:00`);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) return null;
    return { startAt, endAt };
  }, [date, start, end]);

  const previewConflict = useMemo(() => {
    if (!requestedRange) return null;
    return (
      daySlots.find((slot) =>
        overlaps(requestedRange.startAt, requestedRange.endAt, new Date(slot.start), new Date(slot.end)),
      ) ?? null
    );
  }, [daySlots, requestedRange]);

  async function book() {
    if (!resourceId || !requestedRange) {
      setError("Pick a resource and a valid start/end time.");
      return;
    }
    setConflict(null);
    setIsSubmitting(true);
    setError("");
    try {
      const booking = await apiFetch<Booking>("/bookings", {
        method: "POST",
        body: JSON.stringify({
          resource_id: Number(resourceId),
          start: requestedRange.startAt.toISOString(),
          end: requestedRange.endAt.toISOString(),
        }),
      });
      setBookings((current) => [booking, ...current]);
      await loadDaySlots(Number(resourceId), date);
      showToast("Resource booked successfully", "success");
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 409) {
        setConflict(apiError.detail as BookingConflict);
        await loadDaySlots(Number(resourceId), date);
        showToast("Slot unavailable", "error");
      } else {
        showToast("Failed to book resource", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function cancelBooking(booking: Booking) {
    if (booking.status === "cancelled" || booking.status === "completed") return;
    try {
      const updated = await apiFetch<Booking>(`/bookings/${booking.id}/cancel`, { method: "POST" });
      setBookings((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      if (resourceId) await loadDaySlots(Number(resourceId), date);
      showToast("Booking cancelled", "success");
    } catch {
      showToast("Failed to cancel booking", "error");
    }
  }

  function openReschedule(booking: Booking) {
    setRescheduleId(booking.id);
    setRescheduleDate(booking.start.slice(0, 10));
    setRescheduleStart(new Date(booking.start).toTimeString().slice(0, 5));
    setRescheduleEnd(new Date(booking.end).toTimeString().slice(0, 5));
  }

  async function submitReschedule() {
    if (!rescheduleId) return;
    const startAt = new Date(`${rescheduleDate}T${rescheduleStart}:00`);
    const endAt = new Date(`${rescheduleDate}T${rescheduleEnd}:00`);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
      showToast("Pick a valid reschedule window", "error");
      return;
    }
    try {
      const updated = await apiFetch<Booking>(`/bookings/${rescheduleId}/reschedule`, {
        method: "POST",
        body: JSON.stringify({ start: startAt.toISOString(), end: endAt.toISOString() }),
      });
      setBookings((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      if (resourceId) await loadDaySlots(Number(resourceId), date);
      setRescheduleId(null);
      showToast("Booking rescheduled", "success");
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 409) {
        showToast("Slot unavailable for reschedule", "error");
      } else {
        showToast("Failed to reschedule", "error");
      }
    }
  }

  function selectHour(hour: number) {
    setStart(toTimeValue(hour));
    setEnd(toTimeValue(hour + 1));
    setConflict(null);
  }

  const selectedResource = resources.find((resource) => resource.id === resourceId);

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-[1.85rem] tracking-tight">Resource booking</h1>
        <p className="text-sm text-secondary">Overlapping slots are rejected by the Postgres range constraint.</p>
      </header>

      <form
        className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-5"
        onSubmit={async (event) => {
          event.preventDefault();
          await book();
        }}
      >
        <FormField label="Resource">
          <Select
            value={resourceId === "" ? "" : String(resourceId)}
            onChange={(next) => setResourceId(next ? Number(next) : "")}
            options={
              resources.length === 0
                ? [{ value: "", label: "No bookable resources" }]
                : resources.map((resource) => ({
                    value: String(resource.id),
                    label: `${resource.tag} — ${resource.name}`,
                  }))
            }
          />
        </FormField>
        <FormField label="Date">
          <DatePicker value={date} onChange={setDate} required placeholder="Booking date" />
        </FormField>
        <FormField label="Start">
          <TimePicker value={start} onChange={setStart} required placeholder="Start time" />
        </FormField>
        <FormField label="End">
          <TimePicker value={end} onChange={setEnd} required placeholder="End time" />
        </FormField>
        <button className={`${buttonClass} mt-6`} disabled={!resourceId || isSubmitting}>
          {isSubmitting ? "Booking..." : "Book a slot"}
        </button>
      </form>

      {error ? <p className="text-sm text-red">{error}</p> : null}

      {conflict ? (
        <ConflictBanner title="Slot unavailable">
          Requested {start}–{end} conflicts with{" "}
          {conflict.conflicting_booking?.booked_by_name ?? "an existing booking"}
          {conflict.conflicting_booking?.start
            ? ` (${formatClock(conflict.conflicting_booking.start)}–${formatClock(conflict.conflicting_booking.end)})`
            : ""}
          . Adjacent boundary slots (e.g. 10:00–11:00 after 9:00–10:00) are allowed.
        </ConflictBanner>
      ) : previewConflict ? (
        <ConflictBanner title="Overlap preview">
          This request overlaps {previewConflict.booked_by_name ?? "an existing booking"} (
          {formatClock(previewConflict.start)}–{formatClock(previewConflict.end)}). Submitting will return 409.
        </ConflictBanner>
      ) : null}

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">Day schedule</h2>
            <p className="text-xs text-secondary">
              {selectedResource ? `${selectedResource.name} · ${date}` : "Select a resource"}
            </p>
          </div>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => resourceId && loadDaySlots(Number(resourceId), date)}
          >
            Refresh
          </button>
        </div>

        <div className="grid gap-2">
          {HOURS.map((hour) => {
            const hourStart = new Date(`${date}T${toTimeValue(hour)}:00`);
            const hourEnd = new Date(`${date}T${toTimeValue(hour + 1)}:00`);
            const booked = daySlots.find((slot) => overlaps(hourStart, hourEnd, new Date(slot.start), new Date(slot.end)));
            const requestOverlapsHour =
              Boolean(requestedRange) && overlaps(requestedRange!.startAt, requestedRange!.endAt, hourStart, hourEnd);
            const conflictHour = Boolean((conflict || previewConflict) && requestOverlapsHour && booked);
            const requestOnly = Boolean(requestOverlapsHour && !booked);

            let rowClass = "border-line bg-raised";
            let label = "Available";
            let detail = "Click to select 1-hour slot";

            if (booked && conflictHour) {
              rowClass = "border-dashed border-red bg-red-bg";
              label = "Conflict — slot unavailable";
              detail = `Booked by ${booked.booked_by_name ?? "user"} · ${formatClock(booked.start)}–${formatClock(booked.end)}`;
            } else if (booked) {
              rowClass = "border-blue bg-blue-bg";
              label = `Booked — ${booked.booked_by_name ?? "user"}`;
              detail = `${formatClock(booked.start)}–${formatClock(booked.end)}`;
            } else if (requestOnly) {
              rowClass = "border-brand bg-brand-bg";
              label = "Requested";
              detail = `${start}–${end}`;
            }

            return (
              <button
                key={hour}
                type="button"
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition ${rowClass}`}
                onClick={() => {
                  if (!booked) selectHour(hour);
                }}
                disabled={Boolean(booked)}
              >
                <div className="flex items-center gap-4">
                  <span className="w-14 font-medium text-primary">{toTimeValue(hour)}</span>
                  <div>
                    <div className="text-primary">{label}</div>
                    <div className="text-xs text-secondary">{detail}</div>
                  </div>
                </div>
                {booked ? <StatusPill value={booked.status} /> : <span className="text-xs text-muted">Free</span>}
              </button>
            );
          })}
        </div>
      </section>

      <DataTable headers={["Resource", "Start", "End", "Status", "Actions"]}>
        {bookings.map((booking) => {
          const resourceName = resources.find((r) => r.id === booking.resource_id)?.name ?? `ID: ${booking.resource_id}`;
          const canEdit = booking.status === "upcoming" || booking.status === "ongoing";
          return (
            <tr key={booking.id}>
              <td className="px-4 py-3 font-medium">{resourceName}</td>
              <td className="px-4 py-3 text-secondary">{new Date(booking.start).toLocaleString()}</td>
              <td className="px-4 py-3 text-secondary">{new Date(booking.end).toLocaleString()}</td>
              <td className="px-4 py-3">
                <StatusPill value={booking.status} />
              </td>
              <td className="space-x-2 px-4 py-3">
                {canEdit ? (
                  <>
                    <button type="button" className={secondaryButtonClass} onClick={() => openReschedule(booking)}>
                      Reschedule
                    </button>
                    <button type="button" className={secondaryButtonClass} onClick={() => void cancelBooking(booking)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>

      {rescheduleId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5">
            <h3 className="mb-3 text-base font-medium">Reschedule booking #{rescheduleId}</h3>
            <div className="grid gap-3">
              <FormField label="Date">
                <DatePicker value={rescheduleDate} onChange={setRescheduleDate} placeholder="Date" />
              </FormField>
              <FormField label="Start">
                <TimePicker value={rescheduleStart} onChange={setRescheduleStart} placeholder="Start time" />
              </FormField>
              <FormField label="End">
                <TimePicker value={rescheduleEnd} onChange={setRescheduleEnd} placeholder="End time" />
              </FormField>
              <div className="flex gap-2">
                <button type="button" className={buttonClass} onClick={() => void submitReschedule()}>
                  Save
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setRescheduleId(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
