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
    <div className="card-surface overflow-x-auto">
      <table className="w-full min-w-0 border-collapse text-left text-sm md:min-w-[480px]">
        <thead>
          <tr className="border-b border-line text-xs text-secondary bg-surface-raised">
            {headers.map((header) => (
              <th key={header} className="px-4 py-3.5 font-normal">
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

export function TableRow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tr className={`row-hover ${className}`}>{children}</tr>;
}
