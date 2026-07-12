export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="min-w-[480px] w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-secondary">
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-normal">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

