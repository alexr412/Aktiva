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
        // Container für Monate
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        
        // Header (Monatsname + Pfeile)
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        
        // --- DER FIX (CSS GRID) ---
        // Wir setzen !important (!), um globale Styles zu überschreiben.
        
        // Die Tabelle selbst
        table: "!w-full !border-collapse space-y-1",
        
        // Die Kopfzeile (Mo, Di, Mi...): Zwingend 7 Spalten
        head_row: "!grid !grid-cols-7 !w-full mb-2",
        head_cell: "text-muted-foreground rounded-md !w-9 font-normal text-[0.8rem] flex justify-center items-center m-auto",
        
        // Die Datumszeilen: Zwingend 7 Spalten. Das verhindert das Stapeln!
        row: "!grid !grid-cols-7 !w-full mt-2",
        
        // Die einzelne Zelle
        cell: "!h-9 !w-9 text-center text-sm !p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 flex justify-center items-center m-auto",
        
        // Der Button im Tag (Interaktion & Style)
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "!h-9 !w-9 !p-0 font-normal aria-selected:opacity-100 hover:bg-indigo-100 hover:text-indigo-900 rounded-full flex justify-center items-center transition-all"
        ),
        
        // --- VISUELLE STYLES (wie in deinen Beispielen) ---
        day_selected:
          "bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white focus:bg-indigo-700 focus:text-white rounded-full shadow-md", // Runder blauer Kreis
        
        day_today: "bg-indigo-50 text-indigo-600 font-bold border border-indigo-200 rounded-full", // Aktueller Tag leicht hervorgehoben
        
        day_outside:
          "text-muted-foreground opacity-50",
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
