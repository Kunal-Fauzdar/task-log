import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Flat fills, pill shape. Each variant carries a distinct place on the app's green ramp so a
// row of mixed statuses stays readable without relying on text alone:
//   outline  -> nothing recorded yet          (hairline)
//   secondary-> neutral tag                    (soft green chip)
//   accent   -> in progress / ongoing          (sage)
//   success  -> completed / positive           (bright green)
//   brand    -> holiday / strongest emphasis   (deepest green)
//   destructive -> invalid / error / attention (earthy brick — the one non-green signal)
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        accent: "bg-accent text-accent-foreground [a&]:hover:bg-accent/85",
        success: "bg-success text-success-foreground [a&]:hover:bg-success/85",
        brand:
          "bg-brand-strong text-brand-strong-foreground [a&]:hover:bg-brand-strong/90",
        destructive:
          "bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-muted-foreground [a&]:hover:bg-secondary [a&]:hover:text-secondary-foreground",
        ghost: "[a&]:hover:bg-secondary [a&]:hover:text-secondary-foreground",
        link: "text-link underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
