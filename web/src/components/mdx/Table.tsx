import React from "react";

export function Table(props: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="my-8 w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <table className="w-full text-left text-sm" {...props} />
    </div>
  );
}

export function TableHead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800" {...props} />;
}

export function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="divide-y divide-slate-200 dark:divide-slate-800" {...props} />;
}

export function TableRow(props: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors" {...props} />;
}

export function TableHeader(props: React.ThHTMLAttributes<HTMLTableHeaderCellElement>) {
  return <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap" {...props} />;
}

export function TableCell(props: React.TdHTMLAttributes<HTMLTableDataCellElement>) {
  return <td className="px-6 py-4 text-slate-600 dark:text-slate-400" {...props} />;
}
