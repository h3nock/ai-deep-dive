import React from "react";

export function Table(props: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="my-8 w-full overflow-x-auto rounded-xl border border-border shadow-sm">
      <table className="w-full text-left text-sm" {...props} />
    </div>
  );
}

export function TableHead(
  props: React.HTMLAttributes<HTMLTableSectionElement>
) {
  return <thead className="bg-surface border-b border-border" {...props} />;
}

export function TableBody(
  props: React.HTMLAttributes<HTMLTableSectionElement>
) {
  return <tbody className="divide-y divide-border" {...props} />;
}

export function TableRow(props: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className="hover:bg-zinc-800/50 transition-colors" {...props} />;
}

export function TableHeader(
  props: React.ThHTMLAttributes<HTMLTableHeaderCellElement>
) {
  return (
    <th
      className="px-6 py-4 font-semibold text-primary whitespace-nowrap"
      {...props}
    />
  );
}

export function TableCell(
  props: React.TdHTMLAttributes<HTMLTableDataCellElement>
) {
  return <td className="px-6 py-4 text-muted" {...props} />;
}
