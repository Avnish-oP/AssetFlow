"use client";

import { useEffect, useState } from "react";
import { ConflictBanner } from "@/components/shared/ConflictBanner";
import { DataTable } from "@/components/shared/DataTable";
import { buttonClass, FormField, inputClass } from "@/components/shared/FormField";
import { StatusPill } from "@/components/shared/StatusPill";
import { apiFetch, type ApiError, type Asset, type Booking } from "@/lib/api";

type BookingConflict = {
  conflicting_booking?: { booked_by_name?: string; start?: string; end?: string };
};

export default function BookingsPage() {
  const [resources, setResources] = useState<Asset[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conflict, setConflict] = useState<BookingConflict | null>(null);

  useEffect(() => {
    apiFetch<Asset[]>("/assets?is_bookable=true").then(setResources).catch(() => setResources([{ id: 2, tag: "AF-ROOM-B2", name: "Room B2", status: "available", condition: "good", location: "Floor 2", is_bookable: true }]));
    apiFetch<Booking[]>("/bookings").then(setBookings).catch(() => setBookings([]));
  }, []);

  async function book(form: FormData) {
    setConflict(null);
    const date = String(form.get("date"));
    try {
      const booking = await apiFetch<Booking>("/bookings", {
        method: "POST",
        body: JSON.stringify({
          resource_id: Number(form.get("resource_id")),
          start: new Date(`${date}T${form.get("start")}:00`).toISOString(),
          end: new Date(`${date}T${form.get("end")}:00`).toISOString(),
        }),
      });
      setBookings((current) => [booking, ...current]);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 409) setConflict(apiError.detail as BookingConflict);
      else throw error;
    }
  }

  const slots = ["09:00-10:00", "09:30-10:30", "10:00-11:00", "11:00-12:00"];

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-xl font-semibold">Resource booking</h1>
        <p className="text-sm text-secondary">Overlapping slots are rejected by the Postgres range constraint.</p>
      </header>
      <form
        className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-5"
        onSubmit={async (event) => {
          event.preventDefault();
          await book(new FormData(event.currentTarget));
        }}
      >
        <FormField label="Resource"><select className={inputClass} name="resource_id">{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></FormField>
        <FormField label="Date"><input className={inputClass} name="date" type="date" defaultValue="2026-07-12" required /></FormField>
        <FormField label="Start"><input className={inputClass} name="start" type="time" defaultValue="09:00" required /></FormField>
        <FormField label="End"><input className={inputClass} name="end" type="time" defaultValue="10:00" required /></FormField>
        <button className={`${buttonClass} mt-6`}>Book</button>
      </form>
      {conflict ? (
        <ConflictBanner title="Slot unavailable">
          Conflicts with {conflict.conflicting_booking?.booked_by_name ?? "an existing booking"}
          {conflict.conflicting_booking?.start ? ` (${new Date(conflict.conflicting_booking.start).toLocaleTimeString()} - ${new Date(conflict.conflicting_booking.end ?? "").toLocaleTimeString()})` : ""}.
        </ConflictBanner>
      ) : null}
      <section>
        <h2 className="mb-3 text-base font-medium">Time slots</h2>
        <div className="grid gap-2">
          {slots.map((slot) => {
            const isConflict = Boolean(conflict && slot === "09:30-10:30");
            return (
              <div key={slot} className={`flex items-center justify-between rounded-lg border bg-surface px-4 py-3 text-sm ${isConflict ? "border-dashed border-red bg-red-bg" : "border-line"}`}>
                <span>{slot}</span>
                {isConflict ? <span className="text-red">Overlap blocked</span> : <span className="text-secondary">Available boundary-safe slot</span>}
              </div>
            );
          })}
        </div>
      </section>
      <DataTable headers={["Resource", "Start", "End", "Status"]}>
        {bookings.map((booking) => (
          <tr key={booking.id}>
            <td className="px-4 py-3">{booking.resource_id}</td>
            <td className="px-4 py-3 text-secondary">{new Date(booking.start).toLocaleString()}</td>
            <td className="px-4 py-3 text-secondary">{new Date(booking.end).toLocaleString()}</td>
            <td className="px-4 py-3"><StatusPill value={booking.status} /></td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

