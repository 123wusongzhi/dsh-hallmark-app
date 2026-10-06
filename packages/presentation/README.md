# Presentation design and persistence

Design read: a local, single-user merchandising workspace embedded in DSH, with restrained, trustworthy, highly readable host-native presentation.

Reference: [taste-skill v2](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md), read 2026-10-05. Its introduction and section 13 explicitly exclude dashboards and data tables. We therefore borrow the contextual principles, not its landing-page architecture, hero rules or dependency defaults.

Dials: `DESIGN_VARIANCE=4`, `MOTION_INTENSITY=2`, `VISUAL_DENSITY=6`.

- One accent with dedicated profit/loss/warning semantic colors; neutral light/dark tokens, AA >= 4.5:1 for foreground colors on surfaces (automated test).
- System font, compact title hierarchy, tabular numbers, 8px base radius, restrained spacing and no default shadows.
- Native host theme integration is the responsibility of the DSH client adapter; the standalone HTML fallback does not override DSH CSS or load remote fonts, images or packages. Product image URLs are used only from supplied business data and are restricted to HTTP(S).
- Seven widgets share source/data-time/metric-basis footers. Missing cost or metric basis is not rendered as zero profit. Reference profit cannot be labelled actual settled net profit.
- Local snapshot failures retain the last successful payload, and display a stale/error status. Empty states explain the next action. Small screens collapse to one column; focus-visible and reduced-motion rules are present. The fallback is static SSR: live loading, active states, interactive sorting/paging and keyboard-controlled tabs belong to the actual host client UI, not an unverified server-side approximation.
- No fabricated production business values, decorative charts, screenshot copies, external fonts, heavy chart libraries, hero animations or replacement application shell.

## API

`PresentationManager(store)` exports `renderView`, `renderFromTemplate`, `getView`, `getViewData`, `updateView`, `saveComponent`, `saveEntry`, `saveTemplate`, `listSaved`, `manageSaved` and `getTemplate`. See `src/types.ts` for exact shapes.

Temporary views and unsaved patches remain in memory. All three save paths require a non-empty `userRequest`, retaining the original instruction for auditing. This field enforces provenance, not an NLP claim that any non-empty sentence necessarily authorizes saving: tool descriptions and the calling agent enforce explicit user intent.

Saved components contain only Spec, query/data bindings and an inlined template version. Templates contain design and binding slots, not store IDs, business rows or screenshots. `getViewData` never contacts Hallmark: it reads the current successful snapshot or a non-expired `result_set:<id>` (24-hour lifetime managed by core). Saved query tools are derived from the shared read/compute descriptors, exclude non-data tools and cannot refresh or write.

`renderViewHTML(spec, bindingData, 'light' | 'dark')` supplies escaped, no-script HTML/SVG fallback output. A real DSH desktop UI and real-data visual verification are separate integration acceptance, not claimed by these unit tests.
