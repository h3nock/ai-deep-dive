"use client";

import React from "react";

export function SplitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col relative">
      {children}
    </div>
  );
}
