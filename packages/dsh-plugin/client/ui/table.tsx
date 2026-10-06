// Adapted from shadcn/ui new-york-v4/ui/table.tsx (MIT, Copyright 2023 shadcn).
// Source: https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/table.tsx
// Tailwind utilities are replaced by plugin-scoped hm-* rules. See SHADCN-LICENSE.txt.
import React from 'react';
export function Table({className='',...props}:React.ComponentProps<'table'>){return <div data-slot="table-container" className="hm-table-scroll" tabIndex={0} aria-label="可横向滚动的数据表"><table data-slot="table" className={className} {...props}/></div>;}
export function TableHeader(props:React.ComponentProps<'thead'>){return <thead data-slot="table-header" {...props}/>;}
export function TableBody(props:React.ComponentProps<'tbody'>){return <tbody data-slot="table-body" {...props}/>;}
export function TableRow(props:React.ComponentProps<'tr'>){return <tr data-slot="table-row" {...props}/>;}
export function TableHead(props:React.ComponentProps<'th'>){return <th data-slot="table-head" {...props}/>;}
export function TableCell(props:React.ComponentProps<'td'>){return <td {...props}/>;}
