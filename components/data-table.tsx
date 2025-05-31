"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconPlus,
  IconCalendar,
  IconCurrencyDollar,
} from "@tabler/icons-react"
import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  flexRender,
} from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface Schedule {
  id: string
  type: string
  vendor: string
  invoice_date: string
  total_amount: number
  service_start: string
  service_end: string
  description: string
  created_at: string
}



export function DataTable({ data, currencySymbol = '$' }: { data: Schedule[], currencySymbol?: string }) {
  const router = useRouter()
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "description", desc: false }
  ])

  const columns: ColumnDef<Schedule>[] = [
    {
      accessorKey: "description",
      header: "Schedule Name",
      cell: ({ row }) => {
        const schedule = row.original
        return (
          <div className="space-y-1">
            <div className="font-medium">{schedule.description}</div>
            <div className="text-sm text-muted-foreground">
              Created {new Date(schedule.created_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "vendor",
      header: "Contact",
      cell: ({ row }) => {
        return (
          <div className="font-medium">{row.original.vendor}</div>
        )
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.original.type
        if (type === 'prepayment') {
          return (
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
              Prepaid Expense
            </Badge>
          )
        } else {
          return (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            Unearned Revenue
            </Badge>
          )
        }
      },
    },
    {
      accessorKey: "total_amount",
      header: "Amount",
      cell: ({ row }) => {
        const amount = Number(row.original.total_amount)
        return (
          <div className="font-medium">
            {currencySymbol}{amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )
      },
    },
    {
      accessorKey: "period",
      header: "Period",
      cell: ({ row }) => {
        const schedule = row.original
        try {
          const startDate = new Date(schedule.service_start)
          const endDate = new Date(schedule.service_end)
          
          // Check if dates are valid
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return <div className="text-sm text-muted-foreground">Invalid Date</div>
          }
          
          return (
            <div className="text-sm">
              {startDate.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
              })} - {endDate.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
              })}
            </div>
          )
        } catch (error) {
          return <div className="text-sm text-muted-foreground">Invalid Date</div>
        }
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  })

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Recent Schedules</CardTitle>
            <CardDescription>
              Your most recently created prepayment and unearned revenue schedules
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/register">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
            <Link href="/new-schedule">
              <Button size="sm">
                <IconPlus className="mr-1 size-3" />
                New Schedule
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {data.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="h-12 px-4">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => router.push(`/register/${row.original.id}/edit`)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-3 px-4">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        No schedules found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3 mb-4">
                <IconCalendar className="size-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">No schedules yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Get started by creating your first prepayment or unearned revenue schedule.
              </p>
              <Link href="/new-schedule">
                <Button>
                  <IconPlus className="mr-1 size-4" />
                  Create First Schedule
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
