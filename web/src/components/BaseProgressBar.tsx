import { cn } from "@/lib/utils";

export interface BaseProgressBarProps {
  completed: number;
  total: number;
  isLoaded: boolean;
  label?: string;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
  hideWhenEmpty?: boolean;
}

export function BaseProgressBar({
  completed,
  total,
  isLoaded,
  label = "completed",
  className,
  showLabel = true,
  size = "md",
  hideWhenEmpty = false,
}: BaseProgressBarProps) {
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  if (hideWhenEmpty && isLoaded && completed === 0) {
    return null;
  }

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted">
            {isLoaded ? `${completed} of ${total} ${label}` : ""}
          </span>
          {isLoaded && completed > 0 && (
            <span className="text-xs font-medium text-secondary">
              {percentage}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "w-full bg-surface rounded-full overflow-hidden",
          size === "sm" ? "h-0.5" : "h-1"
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            percentage === 100 ? "bg-success progress-shimmer" : "bg-secondary"
          )}
          style={{ width: isLoaded ? `${percentage}%` : "0%" }}
        />
      </div>
    </div>
  );
}
