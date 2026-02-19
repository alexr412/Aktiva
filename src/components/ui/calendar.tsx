"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-2xl font-bold",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        
        // CSS Grid Fix
        table: "!w-full !border-collapse !space-y-1",
        head_row: "!grid !grid-cols-7 !w-full",
        head_cell: "text-muted-foreground !w-9 font-normal text-[0.8rem] flex justify-center items-center m-auto",
        row: "!grid !grid-cols-7 !w-full mt-2",
        
        cell: cn(
          "relative !h-9 !w-9 !p-0 text-center text-sm focus-within:relative focus-within:z-20 flex justify-center items-center m-auto",
          // For v9, style the cell for selection. This will create the circular background.
          "[&:has([aria-selected])]:bg-destructive [&:has([aria-selected])]:text-destructive-foreground [&:has([aria-selected])]:rounded-full",
        ),
        
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "!h-9 !w-9 !p-0 font-normal !rounded-full"
        ),
        
        // Modifier classes for react-day-picker v9
        day_today: "font-bold text-destructive-foreground", // Style for today's date number if it's inside a selected cell
        day_selected: "text-destructive-foreground",
        
        day_outside: "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-50",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
