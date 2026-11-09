"use client";

/**
 * DataTable — Reusable data table component
 * 
 * Features:
 * - Sortable columns
 * - Loading state
 * - Empty state
 * - Row click handler
 * - Responsive design
 */

import React, { useState, useMemo } from 'react';
import '../../styles/components/DataTable.css';
import VoxlaeLoader from './VoxlaeLoader';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  maxHeight?: string;
  className?: string;
}

type SortDirection = 'asc' | 'desc' | null;

function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  isLoading = false,
  emptyMessage = 'No data available',
  emptyIcon,
  maxHeight,
  className = '',
}: DataTableProps<T>): React.ReactElement {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') { setSortKey(null); setSortDirection(null); }
      else setSortDirection('asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDirection]);

  const getValue = (row: T, key: string): any => {
    if (key.includes('.')) {
      return key.split('.').reduce((obj, k) => obj?.[k], row as any);
    }
    return row[key as keyof T];
  };

  const renderCell = (row: T, column: Column<T>, index: number): React.ReactNode => {
    const value = getValue(row, column.key as string);
    if (column.render) {
      return column.render(value, row, index);
    }
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? '✓' : '✕';
    return String(value);
  };

  const classes = [
    'vx-data-table',
    isLoading && 'vx-data-table--loading',
    onRowClick && 'vx-data-table--clickable',
    className,
  ].filter(Boolean).join(' ');

  if (isLoading) {
    return (
      <div className={classes}>
        <VoxlaeLoader variant="section" label="Loading data…" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={classes}>
        <div className="vx-data-table__empty">
          {emptyIcon && <div className="vx-data-table__empty-icon">{emptyIcon}</div>}
          <span>{emptyMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={classes} style={{ maxHeight }}>
      <div className="vx-data-table__wrapper">
        <table className="vx-data-table__table">
          <thead className="vx-data-table__head">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key as string}
                  className={`vx-data-table__th ${column.sortable ? 'vx-data-table__th--sortable' : ''}`}
                  style={{ 
                    width: column.width, 
                    textAlign: column.align || 'left' 
                  }}
                  onClick={() => column.sortable && handleSort(column.key as string)}
                >
                  <div className="vx-data-table__th-content">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <span className="vx-data-table__sort-icon">
                        {sortKey === column.key ? (
                          sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '↕'
                        ) : '↕'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="vx-data-table__body">
            {sortedData.map((row, index) => (
              <tr
                key={keyExtractor(row, index)}
                className="vx-data-table__row"
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key as string}
                    className="vx-data-table__td"
                    style={{ textAlign: column.align || 'left' }}
                  >
                    {renderCell(row, column, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
