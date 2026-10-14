"use client"

import React, { useMemo } from "react"
import {
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy"
import { flexRender } from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface ShowcaseItem {
  id: string
  name: string
  category: string
  version: string
  status: "Configured" | "Active" | "Compatible"
}

export function TanStackTableDemo() {
  const data = useMemo<ShowcaseItem[]>(
    () => [
      { id: "1", name: "Motion", category: "Animation", version: "^14.2.0", status: "Active" },
      { id: "2", name: "GSAP", category: "Animation Timeline", version: "^3.15.0", status: "Active" },
      { id: "3", name: "shadcn/ui", category: "Component System", version: "v4 Radix-Nova", status: "Configured" },
      { id: "4", name: "TanStack Query", category: "Server State", version: "^5.104.2", status: "Active" },
      { id: "5", name: "Zustand", category: "Global State", version: "^5.0.15", status: "Active" },
      { id: "6", name: "React Hook Form + Zod", category: "Forms & Validation", version: "^7.90 / ^4.6", status: "Configured" },
      { id: "7", name: "Sonner", category: "Notifications", version: "^2.0.8", status: "Compatible" },
      { id: "8", name: "tsParticles", category: "Interactive Canvas", version: "^4.4.0", status: "Active" },
    ],
    []
  )

  const columns = useMemo<LegacyColumnDef<ShowcaseItem, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Library / Tool",
        cell: (info) => <span className="font-semibold">{String(info.getValue())}</span>,
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: (info) => <span className="text-muted-foreground">{String(info.getValue())}</span>,
      },
      {
        accessorKey: "version",
        header: "Version",
        cell: (info) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{String(info.getValue())}</code>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (info) => {
          const val = String(info.getValue())
          return (
            <Badge
              variant={val === "Active" ? "default" : val === "Configured" ? "secondary" : "outline"}
              className="text-xs"
            >
              {val}
            </Badge>
          )
        },
      },
    ],
    []
  )

  const table = useLegacyTable({
    data,
    columns,
  })

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
