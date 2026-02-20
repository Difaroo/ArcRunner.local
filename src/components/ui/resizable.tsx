"use client"

import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = ({
  className,
  direction,
  ...props
}: any) => {
  // @ts-ignore
  const Group = ResizablePrimitive.Group || ResizablePrimitive.PanelGroup;
  return (
    <Group
      orientation={direction}
      className={cn(
        "flex h-full w-full",
        direction === "vertical" ? "flex-col" : "flex-row",
        className
      )}
      {...props}
    />
  )
}

// @ts-ignore
const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle,
  className,
  direction,
  ...props
}: any) => {
  // @ts-ignore
  const Separator = ResizablePrimitive.Separator || ResizablePrimitive.PanelResizeHandle;
  const isVertical = direction === "vertical";

  return (
    <Separator
      className={cn(
        "relative flex items-center justify-center bg-border after:absolute focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1",
        isVertical ? "h-px w-full after:left-0 after:h-1 after:w-full after:-translate-y-1/2 after:translate-x-0" : "w-px h-full after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className={cn("z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-stone-900", isVertical ? "rotate-90" : "")}>
          <GripVertical className="h-2.5 w-2.5 text-stone-500" />
        </div>
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
