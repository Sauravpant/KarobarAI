import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.ComponentProps<"textarea"> {}

function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[80px] w-full rounded-xl border border-input bg-slate-50 px-3.5 py-2 text-sm shadow-none transition-all duration-200 outline-none",
        "placeholder:text-muted-foreground/60",
        "hover:border-slate-300",
        "focus-visible:border-[#E3182D] focus-visible:bg-white focus-visible:ring-[3px] focus-visible:ring-[#E3182D]/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
