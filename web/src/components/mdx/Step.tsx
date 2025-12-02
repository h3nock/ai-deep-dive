"use client";

import React from "react";

interface StepProps {
  title?: string;
  children: React.ReactNode;
}

export function Step({ title, children }: StepProps) {
  // If no title, this is a project intro step - render more cleanly
  if (!title) {
    return (
      <div className="relative">
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    );
  }

  return (
    <div className="relative py-8 border-b border-border last:border-0">
      <h3 className="text-2xl font-bold text-primary mb-6">{title}</h3>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}
