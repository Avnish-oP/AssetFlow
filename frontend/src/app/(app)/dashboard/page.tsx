import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusPill } from "@/components/shared/StatusPill";

const kpis = [
  ["Available assets", 128],
  ["Allocated assets", 76],
  ["Under maintenance", 9],
  ["Bookings today", 14],
  ["Pending transfers", 3],
  ["Due this week", 11],
];

export default function DashboardPage() {
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-secondary">Live operational status across assets, bookings, and returns.</p>
      </header>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([label, value]) => (
          <KpiCard key={label} label={String(label)} value={value} />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <div>
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
        <div>
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

