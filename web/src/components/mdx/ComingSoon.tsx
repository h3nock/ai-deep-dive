import React from "react";
import { Description } from "./Description";

export function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 rounded-full bg-blue-50 p-4 dark:bg-blue-900/20">
        <svg
          className="h-8 w-8 text-blue-600 dark:text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
      </div>
      <h2 className="mb-3 text-2xl font-semibold text-slate-900 dark:text-white">
        Coming Soon
      </h2>
      <p className="max-w-md text-slate-600 dark:text-slate-400">
        We're currently polishing this chapter to ensure it meets our high standards. 
        Check back soon for the complete content!
      </p>
    </div>
  );
}
