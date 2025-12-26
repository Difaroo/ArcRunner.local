import { cn } from "@/lib/utils"

interface PageHeaderProps {
    title: React.ReactNode
    className?: string
    children?: React.ReactNode
}

export function PageHeader({ title, className, children }: PageHeaderProps) {
    return (
        <div className={cn("flex items-center justify-between px-6 h-14 border-t border-white/5 relative z-50 pointer-events-auto print:border-t-0 print:shadow-none print:border-b-[2px] print:!border-black print:mb-2 print:pb-0 print:h-auto print:px-0 print:items-end", className)}>
            <h2 className="text-lg font-sans font-normal text-muted-foreground">
                {title}
            </h2>
            {children}
        </div>
    )
}
