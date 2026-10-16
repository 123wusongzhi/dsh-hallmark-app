# Issue 76 supplement: truthful listing packaging edits

## Reproduction and contract

The structured listing editor introduced in `5bdd4be` offered `m` alongside `mm/cm`, and said it preserved original units. The production adapter accepts `mm/cm` and normalizes to mm. More importantly, the established packaging contract gives maintained/source rules priority; listing payload values only fill missing groups. This supplement preserves that contract.

Real React + local adapter/engine reproduction, with controlled source packaging of 50 g and 100 × 80 × 20 mm:

- Entering 0.5 × 0.4 × 0.3 m saved the source dimensions instead.
- Control: 50 × 40 × 30 cm also saved the source dimensions.
- Control: 500 × 400 × 300 mm also saved the source dimensions.
- 0.2 kg and 200 g similarly saved 50 g.

Thus changing units alone was not a workaround. The UI incorrectly presented rule-backed values as editable, while the backend was following the existing source-priority rule. No merchant writes or model reviews were performed.

## Supplement behavior

- `listingPackaging` exposes only optional weight/dimensions group states: `rules`, `draft`, or `missing`. Public projection allowlists the two values and does not expose source evidence. Unknown/old providers remain explicitly unknown rather than falsely locked.
- Known rule-backed groups are disabled independently. Their adopted values and source priority are visible in the expanded packaging area, including after advanced JSON normalization.
- Missing groups remain editable with g/kg and mm/cm. New m selection is removed; old unsupported values remain visible for correction.
- Invalid fallback input gets field-level issues and is preserved; unrelated valid groups still normalize. Missing input remains an ordinary missing-field issue. Tiny values that would round to zero and values beyond the resolver's supported range are rejected only for fallback groups.
- Existing valid or invalid legacy payload values do not override or newly block authoritative maintained/source rules. No rule-precedence change was made.
- “按当前包装规则更新草稿” explicitly revises the current saved row. Its copy says it persists the draft and reparses pricing/other business fields without submitting. The completion notice shows previous values; the packaging area shows adopted values and sources. Unchanged rules keep unchanged values/revision where the existing engine deduplicates the revision.
- This action is disabled during any unsaved/raw edit, pending/busy/confirmation/recovery state, or non-editable row. It is never automatic.

## Independent candidate verification

Both Node 22.18.0 and Node 24.21.0:

- 96/96 focused tests pass: real adapter, packaging repository, listing preparation/provider, public plan pages, Host business-value/partial-status projections, structured listing editor, new real React + adapter/engine package flow, lazy content, confirmation/recovery paths.
- TypeScript `tsc --noEmit` passes.
- Real fixture audit passes (173 required files; immutable recorded source coverage retained).
- `git diff --check` passes.

New tests exercise source complete/missing/half-missing, mm/cm and g/kg equivalence, unsupported and invalid fallback, unknown raw fields, independent field groups, legacy invalid rule-backed payloads, minimal public metadata, maintained-rule changes applied by explicit revise, unchanged updates, and dirty/raw/busy/confirmation/unknown guards. They assert zero platform dispatch and zero model reviews.

This is a supplement to issue 76, not a new UX issue count. The independent candidate verification above used a candidate based on `9384e50`, before subsequent integration; that historical verification is not a statement about current publication status. The later exact integrated source and dual-Node results are recorded in the [integration regression report](testing/issue76-packaging-dual-node-20261016.md).
