import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] text-[15px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-al-blue disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-al-blue text-white shadow-sm hover:bg-al-blue-hover",
        destructive: "bg-al-critical text-white shadow-sm hover:bg-al-critical/90",
        outline: "border border-al-light-gray bg-transparent hover:bg-al-off-white text-al-near-black",
        secondary: "bg-al-light-gray/50 text-al-near-black hover:bg-al-light-gray",
        ghost: "hover:bg-al-light-gray/50 text-al-near-black",
        link: "text-al-blue underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2", // Apple standard touch target
        sm: "h-9 rounded-[6px] px-4 text-[13px]",
        lg: "h-12 rounded-[6px] px-8 text-[17px]",
        icon: "h-11 w-11 rounded-[6px]",
        "icon-sm": "h-9 w-9 rounded-[6px]",
        "icon-lg": "h-12 w-12 rounded-[6px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }