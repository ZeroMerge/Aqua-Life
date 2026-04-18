import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[6px] px-2.5 py-0.5 text-[13px] font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none transition-colors border border-transparent",
  {
    variants: {
      variant: {
        default: "bg-al-light-gray/60 text-al-near-black",
        secondary: "bg-al-blue/10 text-al-blue",
        destructive: "bg-al-critical/10 text-al-critical",
        warning: "bg-al-warning/10 text-al-warning",
        safe: "bg-al-safe/10 text-al-safe",
        outline: "text-al-near-black border-al-light-gray",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }