import React from "react";

interface ByteStreamProps {
  bytes: number[];
  label?: string;
}

export function ByteStream({ bytes, label }: ByteStreamProps) {
  return (
    <div className="mt-4 mb-2">
      {label && (
        <div className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {bytes.map((byte, index) => (
          <div key={index} className="flex flex-col items-center group">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-surface border-2 border-border text-secondary font-mono font-bold shadow-sm group-hover:border-sky-500 group-hover:text-sky-400 transition-all">
              {byte}
            </div>
            <span className="text-[10px] text-muted mt-1 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
              0x{byte.toString(16).toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
