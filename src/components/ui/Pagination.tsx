import React from 'react'
import { Sel } from './Input'
import { Btn } from './Button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
    page: number;
    totalPages: number;
    pageSize: number;
    totalRecords?: number;
    setPagination?: React.Dispatch<React.SetStateAction<{ page: number; totalPages: number; pageSize: number; totalRecords: number }>>;
}

export default function Pagination({ page, totalPages, pageSize, totalRecords, setPagination }: PaginationProps) {
    return (
        <div className="mt-6 flex items-center justify-between">

            {/* Page Size */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Show</span>

                <Sel className="w-20" value={pageSize} onChange={(e) => setPagination?.((prev) => ({ ...prev, page: 1, pageSize: Number(e.target.value) }))}>
                    <option>3</option>
                    <option>6</option>
                    <option>12</option>
                    <option>24</option>
                    <option>48</option>
                </Sel>

                <span className="w-48"> page {page} of {totalPages}</span>
            </div>

            {/* Total records + Navigation arrows */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {totalRecords != null && (
                    <span>Total {totalRecords} record{totalRecords !== 1 ? "s" : ""}</span>
                )}

            {/* Pagination */}
            <div className="flex overflow-hidden rounded-lg border border-border bg-card shadow-xs">
                <Btn onClick={() => setPagination?.((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))} v="ghost" sz="icon" disabled={page <= 1} className="h-10 w-10 rounded-none border-r border-border hover:bg-secondary">
                    <ChevronLeft className="h-4 w-4" />
                </Btn>

                {/* <Btn v="primary" className="h-10 min-w-10 rounded-none border-r border-border shadow-none">
                    1
                </Btn>

                <Btn v="ghost" className="h-10 min-w-10 rounded-none border-r border-border hover:bg-secondary"
                >
                    2
                </Btn>

                <div className="flex h-10 min-w-10 items-center justify-center border-r border-border text-muted-foreground">
                    ...
                </div>


                <Btn v="ghost" className="h-10 min-w-10 rounded-none border-r border-border hover:bg-secondary">
                    10
                </Btn> */}

                <Btn onClick={() => setPagination?.((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}    v="ghost" sz="icon" disabled={page >= totalPages} className="h-10 w-10 rounded-none hover:bg-secondary">
                    <ChevronRight className="h-4 w-4" />
                </Btn>

            </div>

            </div>

        </div>
    )
}
