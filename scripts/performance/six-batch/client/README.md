# Six-patch combined client verification

This harness compares the real complete clean baseline checkout to the real complete six-patch checkout. It does not sum independent issue gains and does not replace candidate source with individual patch variants. No live store/platform is contacted.

## Reproduce

Install each checkout from its frozen lockfile first. From this harness directory, provide access to the candidate checkout's node_modules (a local symlink is sufficient), then run:

```
node build-review.mjs /absolute/baseline-root /absolute/combined-root
python3 run-parity.py
python3 run-coupled.py
```

Run the last command only in a quiet, exclusive CPU window. Node 24 / React 18.3.1 production renderer is used. No browser layout, paint, real network or user hardware time is claimed. The Workbench snapshot HTTP response is a deterministic shape-correct fixture. Both actual WorkbenchInstanceView and its actual ProductList/ProcurementCell implementation are exercised.

## Functional gates

- E: 53 real mounted ProductList/TanStack cases; compare the complete filtered product IDs, visible IDs, pagination, whole rendered host tree, selection callbacks and query callbacks. Covers Unicode normalization, null/array/object values, mapped fields, scale/unit change, unconfirmed fields, snapshot and store replacement, first image/hidden/custom/single/no columns, ordinary vs procurement and local vs server search.
- O: actual mounted Workbench plus 1,159 numeric/currency/scale/error cases, negative zero, failed construction, 80 currency keys and revisits, same row-object updates, constructor replacement and recovery. Compare full output trees/values, not only hashes.
- Coupled: each same mounted Workbench repeatedly performs search miss, selective offer search, all-match search, clear, numeric sort, and display edits. Both E and O execute together. First/last cycle full host-tree hashes and snapshot requests/events must match exactly.

## Measurement

- Cases: 10, 76, 267, 1,000 loaded products with default 10 visible rows; 267 products with supported page size 20.
- Five ABBA process cycles per case (10 fresh processes per arm).
- Fifteen complete user-action cycles per process; discard first three warm-up cycles. Keep every raw sample.
- Report per-process median, median across process medians, all-sample median and p95. CPU and process RSS are supplemental, not browser memory claims.
- Whole-cycle improvement is directly measured by summing that cycle's actual action durations, not by adding percentages of independent fixes.
- Initial/cold mount is retained but not the primary warm interactive metric. Small and all-match controls are mandatory; disclose regressions.

The detailed six-patch server tests and backend performance measurements are owned by the integration lead. This client harness alone cannot establish whole-application performance or approve a push.
