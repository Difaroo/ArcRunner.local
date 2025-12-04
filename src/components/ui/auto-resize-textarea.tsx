import * as React from "react"
import { cn } from "@/lib/utils"

export interface AutoResizeTextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

export const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
    ({ className, value, ...props }, ref) => {
        return (
            <div className={cn("grid text-sm", className)}>
                <div
                    className={cn(
                        "invisible col-start-1 row-start-1 whitespace-pre-wrap break-words border border-transparent px-3 py-2",
                        className
                    )}
                    aria-hidden="true"
                >
                    {value + " "}
                </div>
                <textarea
                    className={cn(
                        "col-start-1 row-start-1 w-full resize-none overflow-hidden rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        className
                    )}
                    ref={ref}
                    value={value}
                    {...props}
                />
            </div>
        )
    }
)
AutoResizeTextarea.displayName = "AutoResizeTextarea"
