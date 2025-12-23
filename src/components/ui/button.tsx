import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-normal ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:text-black cursor-pointer",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-all duration-300",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
                outline:
                    "border border-black bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
                "outline-primary":
                    "border border-black text-primary bg-background shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary disabled:text-primary disabled:text-opacity-50 disabled:border-opacity-30",
                "outline-destructive":
                    "border border-black text-destructive bg-background shadow-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive disabled:opacity-50",
                "outline-warning":
                    "border border-black text-orange-500 bg-background shadow-sm hover:bg-orange-500/10 hover:text-orange-500 hover:border-orange-500 disabled:opacity-50",
                "outline-success":
                    "border border-black text-green-600 bg-background shadow-sm hover:bg-green-600/10 hover:text-green-600 hover:border-green-600 disabled:opacity-50",
                secondary:
                    "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-md px-3",
                lg: "h-11 rounded-md px-8",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
