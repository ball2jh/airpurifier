import { cn } from "@/lib/utils"

function Progress({ value = 0, className, indicatorClassName, ...props }) {
  return (
    <div
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-surface-1",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full transition-all duration-500 ease-out rounded-full",
          indicatorClassName
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export { Progress }
