import { cn } from "@/lib/utils"

interface PageHeaderProps {
    title: React.ReactNode
    className?: string
    children?: React.ReactNode
}

export function PageHeader({ title, className, children }: PageHeaderProps) {
    return (
        <div className={cn("flex items-center px-6 h-14 border-t border-white/5", className)}>
            <h2 className="text-lg font-sans font-normal text-white flex-1">
                {title}
            </h2>
            {children}
        </div>
    )
}
