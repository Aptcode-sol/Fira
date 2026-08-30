'use client';

import React from 'react';
import { Pagination } from './Pagination';
import { usePaged } from '@/hooks/usePaged';

export interface Column<T> {
    /** Stable key, also the mobile row label when `header` is empty. */
    key: string;
    header: string;
    cell: (row: T) => React.ReactNode;
    align?: 'left' | 'center' | 'right';
    /** Rendered as the row title on mobile instead of a label/value pair. */
    primary?: boolean;
    /** Drop from the mobile layout entirely - use for anything already implied by the title. */
    hideOnMobile?: boolean;
    /** Extra classes for the cell (not the header). */
    cellClassName?: string;
}

export interface DataTableProps<T> {
    rows: T[];
    columns: Column<T>[];
    rowKey: (row: T) => string;
    /** Clicking a row opens its dedicated page. Omit for read-only tables. */
    onRowClick?: (row: T) => void;
    pageSize?: number;
    loading?: boolean;
    /** Rendered in place of the rows when there is nothing to show. */
    empty?: React.ReactNode;
    /** Appended to the pagination counter, e.g. "12 bookings". */
    label?: (total: number) => string;
    /** Trailing actions, kept outside the click target so buttons still work. */
    actions?: (row: T) => React.ReactNode;
}

const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

/**
 * One list surface for the dashboards: a real table from `md` up, stacked
 * label/value rows below it, and the shared pagination footer either way.
 *
 * The footer renders even when `rows` is empty, so an empty list still reads as
 * a finished list rather than a broken one.
 */
export function DataTable<T>({
    rows,
    columns,
    rowKey,
    onRowClick,
    pageSize = 10,
    loading = false,
    empty,
    label,
    actions,
}: DataTableProps<T>) {
    const { page, setPage, totalPages, pageRows, total } = usePaged(rows, pageSize);

    const mobileColumns = columns.filter((c) => !c.hideOnMobile);
    const primary = mobileColumns.find((c) => c.primary) ?? mobileColumns[0];
    const secondary = mobileColumns.filter((c) => c !== primary);

    // Row is a <tr>/<div>, not a <button>, because it contains action buttons -
    // nesting those inside a button is invalid and breaks their click handling.
    // Keyboard access comes from role/tabIndex plus the Enter and Space handler.
    const clickProps = (row: T) =>
        onRowClick
            ? {
                onClick: () => onRowClick(row),
                onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row);
                    }
                },
                role: 'button' as const,
                tabIndex: 0,
                className: 'cursor-pointer',
            }
            : {};

    return (
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden">
            {loading ? (
                <div className="p-4 space-y-3">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : total === 0 ? (
                <div className="px-4 py-12 text-center">
                    {empty ?? <p className="text-sm text-gray-300">Nothing to show yet.</p>}
                </div>
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 text-xs text-gray-400 uppercase tracking-wide">
                                    {columns.map((c) => (
                                        <th key={c.key} className={`px-4 py-3 font-semibold ${alignClass[c.align ?? 'left']}`}>
                                            {c.header}
                                        </th>
                                    ))}
                                    {actions && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.05]">
                                {pageRows.map((row) => (
                                    <tr
                                        key={rowKey(row)}
                                        {...clickProps(row)}
                                        className={`text-sm text-gray-200 hover:bg-white/[0.04] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                                    >
                                        {columns.map((c) => (
                                            <td
                                                key={c.key}
                                                className={`px-4 py-3.5 align-middle ${alignClass[c.align ?? 'left']} ${c.cellClassName ?? ''}`}
                                            >
                                                {c.cell(row)}
                                            </td>
                                        ))}
                                        {actions && (
                                            <td
                                                className="px-4 py-3.5 text-right align-middle"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="flex justify-end gap-2">{actions(row)}</div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile rows - same data, stacked, because a 6-column table
                        on a phone is a horizontal scroll nobody uses. */}
                    <div className="md:hidden divide-y divide-white/[0.05]">
                        {pageRows.map((row) => (
                            <div
                                key={rowKey(row)}
                                {...clickProps(row)}
                                className={`p-4 hover:bg-white/[0.04] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                            >
                                {primary && (
                                    <div className="text-sm font-semibold text-white mb-2 break-words">
                                        {primary.cell(row)}
                                    </div>
                                )}
                                <dl className="space-y-1.5">
                                    {secondary.map((c) => (
                                        <div key={c.key} className="flex items-baseline justify-between gap-4 text-xs">
                                            <dt className="text-gray-400 shrink-0">{c.header}</dt>
                                            <dd className={`text-right text-gray-200 min-w-0 break-words ${c.cellClassName ?? ''}`}>
                                                {c.cell(row)}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                                {actions && (
                                    <div className="mt-3 pt-3 border-t border-white/[0.05] flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                                        {actions(row)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            <Pagination
                page={page}
                totalPages={totalPages}
                onChange={setPage}
                disabled={loading}
                label={label ? label(total) : undefined}
            />
        </div>
    );
}

export default DataTable;
