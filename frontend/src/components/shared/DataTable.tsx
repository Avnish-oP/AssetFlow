import React from "react";

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  const isEmpty = React.Children.count(children) === 0;
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-secondary bg-surface-raised">
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-normal">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {isEmpty ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-8 text-center text-sm text-secondary">
                No data available
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

