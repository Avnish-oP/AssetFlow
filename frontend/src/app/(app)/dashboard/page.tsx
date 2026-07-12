import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusPill } from "@/components/shared/StatusPill";

const kpis = [
  ["Available assets", 128, <path key="available" d="M4 7h16v13H4V7Zm3-3h10v3H7V4Zm2 8h6m-6 4h4" />],
  ["Allocated assets", 76, <path key="allocated" d="M4 4h16v16H4zM8 8h8m-8 4h8m-8 4h5" />],
  ["Under maintenance", 9, <path key="maintenance" d="m14.7 6.3 3-3a4 4 0 0 1-5.4 5.4l-7.6 7.6a2 2 0 0 0 2.8 2.8l7.6-7.6a4 4 0 0 1 5.4-5.4l-3 3" />],
  ["Bookings today", 14, <path key="bookings" d="M6 3v3m12-3v3M4 8h16M5 5h14v15H5zM8 12h3m2 0h3m-8 4h3" />],
  ["Pending transfers", 3, <path key="transfers" d="M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3" />],
  ["Due this week", 11, <path key="due" d="M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />],
];

export default function DashboardPage() {
  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 pt-14 lg:pt-0">
      <header className="rounded-xl border border-line bg-surface-raised px-5 py-4 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-secondary">Live operational status across assets, bookings, and returns.</p>
      </header>
      <section className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([label, value, icon]) => (
          <KpiCard key={String(label)} label={String(label)} value={Number(value)} icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{icon}</svg>} />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-line bg-surface-raised p-4 sm:p-5">
          <h2 className="mb-3 text-base font-medium">Recent activity</h2>
          <DataTable headers={["Event", "Actor", "Status"]}>
            {[
              ["AF-0114 allocated", "Admin User", "active"],
              ["Room B2 booked 09:00-10:00", "Priya Shah", "upcoming"],
              ["Transfer request submitted", "Operations", "pending"],
            ].map((row) => (
              <tr key={row[0]}>
                <td className="px-4 py-3">{row[0]}</td>
                <td className="px-4 py-3 text-secondary">{row[1]}</td>
                <td className="px-4 py-3"><StatusPill value={row[2]} /></td>
              </tr>
            ))}
          </DataTable>
        </div>
        <div className="min-w-0 rounded-xl border border-line bg-surface-raised p-4 sm:p-5">
          <h2 className="mb-3 text-base font-medium">Upcoming returns</h2>
          <DataTable headers={["Asset", "Holder", "Due"]}>
            {[
              ["AF-0062 Dell Latitude", "Amit Rao", "Today"],
              ["AF-0108 Projector", "Facilities", "Tomorrow"],
              ["AF-0114 MacBook Pro", "Priya Shah", "Friday"],
            ].map((row) => (
              <tr key={row[0]}>
                <td className="px-4 py-3">{row[0]}</td>
                <td className="px-4 py-3 text-secondary">{row[1]}</td>
                <td className="px-4 py-3 text-secondary">{row[2]}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      </section>
    </div>
  );
}

