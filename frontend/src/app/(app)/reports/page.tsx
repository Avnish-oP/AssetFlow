"use client";

import { useEffect, useMemo, useState } from "react";

import { DataTable, TableRow } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { secondaryButtonClass } from "@/components/shared/FormField";
import { StatusPill } from "@/components/shared/StatusPill";
import { apiFetch, type ReportAssetStat, type ReportSummary } from "@/lib/api";

export default function ReportsPage() {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const loadReport = async () => {
      try {
        const next = await apiFetch<ReportSummary>('/reports/summary');
        if (!alive) {
          return;
        }
        setReport(next);
        setLoading(false);
        setError(null);
      } catch {
        if (!alive) {
          return;
        }
        setError('Could not load reports.');
        setLoading(false);
      }
    };

    void loadReport();
    const interval = window.setInterval(() => {
      void loadReport();
    }, 60000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  const kpis = useMemo(
    () =>
      report
        ? [
            { label: 'Total assets', value: report.totals.total_assets, accentColor: 'blue' as const },
            { label: 'Available', value: report.totals.available_assets, accentColor: 'green' as const },
            { label: 'Allocated', value: report.totals.allocated_assets, accentColor: 'blue' as const },
            { label: 'Maintenance', value: report.totals.maintenance_assets, accentColor: 'amber' as const },
            { label: 'Overdue allocations', value: report.totals.overdue_allocations, accentColor: 'red' as const },
            { label: 'Utilization', value: `${report.totals.utilization_rate}%`, accentColor: 'green' as const },
          ]
        : [],
    [report],
  );

  async function downloadExport() {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('assetflow_access_token') : null;
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/reports/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      throw new Error('Could not download report export');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'assetflow-reports.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="text-sm text-secondary">
            {loading ? 'Loading report summary…' : report ? `Snapshot generated ${new Date(report.generated_at).toLocaleString()}.` : 'No report data available.'}
          </p>
        </div>
        <button type="button" className={secondaryButtonClass} onClick={() => void downloadExport()}>
          Export CSV
        </button>
      </header>

      {error ? <p className="rounded-lg border border-red bg-red-bg px-4 py-3 text-sm text-red">{error}</p> : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} accentColor={kpi.accentColor} />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <StatTable title="Most used assets" rows={report?.most_used ?? []} />
        <StatTable title="Idle assets" rows={report?.idle_assets ?? []} />
        <StatTable title="Maintenance frequency" rows={report?.maintenance_frequency ?? []} />
        <StatTable title="Due for retirement" rows={report?.retirement_candidates ?? []} showAge />
      </div>
    </div>
  );
}

function StatTable({ title, rows, showAge = false }: { title: string; rows: ReportAssetStat[]; showAge?: boolean }) {
  return (
    <div>
      <h2 className="mb-3 text-base font-medium">{title}</h2>
      <DataTable headers={["Asset", "Status", "Usage", "Condition", ...(showAge ? ["Age"] : [])]}>
        {rows.length === 0 ? (
          <TableRow>
            <td className="px-4 py-3 text-secondary" colSpan={showAge ? 5 : 4}>
              No items found.
            </td>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={`${title}-${row.asset_id}`}>
              <td className="px-4 py-3">
                <div className="font-medium text-primary">{row.tag}</div>
                <div className="text-xs text-secondary">{row.name}</div>
              </td>
              <td className="px-4 py-3">
                <StatusPill value={row.status} />
              </td>
              <td className="px-4 py-3 text-secondary">{row.usage_count}</td>
              <td className="px-4 py-3 text-secondary">{row.condition}</td>
              {showAge ? <td className="px-4 py-3 text-secondary">{row.age_days ?? '—'}</td> : null}
            </TableRow>
          ))
        )}
      </DataTable>
    </div>
  );
}

