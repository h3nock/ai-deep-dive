"use client";

import { useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
}

/**
 * Premium confirmation modal following the site's design system.
 * Inline icon + title layout for minimal, developer-focused aesthetic.
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
}: ConfirmModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    cancelButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const focusableElements = [
          cancelButtonRef.current,
          confirmButtonRef.current,
        ].filter(Boolean);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: "text-error",
      confirmButton:
        "bg-error/20 text-error border border-error/50 hover:bg-error/30 hover:border-error",
    },
    warning: {
      icon: "text-warning",
      confirmButton:
        "bg-warning/20 text-warning border border-warning/50 hover:bg-warning/30 hover:border-warning",
    },
    default: {
      icon: "text-secondary",
      confirmButton:
        "bg-surface text-secondary border border-border-hover hover:bg-border-hover hover:text-primary",
    },
  };

  const styles = variantStyles[variant];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-description"
          className="w-full max-w-[340px] bg-surface border border-border rounded-xl shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
        >
          {/* Content */}
          <div className="px-6 pt-5 pb-4">
            {/* Title with inline icon */}
            <div className="flex items-center gap-2.5 mb-2">
              <RotateCcw className={`w-4 h-4 ${styles.icon} shrink-0`} />
              <h2
                id="modal-title"
                className="text-base font-semibold text-primary"
              >
                {title}
              </h2>
            </div>

            {/* Description - text-secondary for readability (not muted, this is important content) */}
            <p
              id="modal-description"
              className="text-sm text-secondary leading-relaxed"
            >
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 px-6 pb-5">
            <button
              ref={cancelButtonRef}
              onClick={onClose}
              className="flex-1 h-9 text-sm font-medium rounded-lg text-muted bg-transparent border border-border hover:text-secondary hover:border-border-hover hover:bg-surface/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border-hover focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {cancelText}
            </button>
            <button
              ref={confirmButtonRef}
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 h-9 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border-hover focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${styles.confirmButton}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
