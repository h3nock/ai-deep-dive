import React from "react";

interface ByteStreamProps {
  bytes: number[];
  label?: string;
}

export function ByteStream({ bytes, label }: ByteStreamProps) {
  return (
    <div className="mt-4 mb-2">
      {label && (
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {bytes.map((byte, index) => (
          <div 
            key={index}
            className="flex flex-col items-center group"
          >
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono font-bold shadow-sm group-hover:border-blue-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all">
              {byte}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
              0x{byte.toString(16).toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
