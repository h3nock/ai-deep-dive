"use client";

import React from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Action({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative group my-6">
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl opacity-10 group-hover:opacity-20 transition-opacity blur"></div>
      <div className="relative rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-700"></div>
            <div className="w-3 h-3 rounded-full bg-slate-700"></div>
            <div className="w-3 h-3 rounded-full bg-slate-700"></div>
          </div>
          <div className="text-xs font-mono text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-3 h-3" />
            zsh
          </div>
        </div>
        
        {/* Terminal Body */}
        <div className="p-4 overflow-x-auto">
           <div className="flex flex-col">
             {children}
           </div>
        </div>
      </div>
    </div>
  );
}
