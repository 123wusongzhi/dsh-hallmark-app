# Plan conflict read guidance review — 2026-10-16

## Reproduced gap

On base `23c8918`, actual AppsRuntime calls and `projectModelResult` returned only `BUSINESS_PLAN_VERSION_CHANGED` with `retryPolicy: never` for each of:

- `hallmark.plan.revise`
- `hallmark.listing.draft.revise`
- `hallmark.plan.submit`
- `hallmark.listing.draft.submit`

The latter two combine review and execution; there are no separate update/review/execute capabilities in this surface. Both exact Node 22.18.0 and 24.21.0 reproduced the missing read route before the production change.

## Narrow fix

Only the provider's conflict response changes. After a genuine revise/submit version conflict, the provider reads the original plan inside the current connection's existing business store. Verified metadata includes store identity, an informational `observedRevision`, and the existing `hallmark.plan.get` route with `view: payload`, `cursor: 0`, and `limit: 10`.

Guidance requires checking current store, target rows, content, status and remaining relevant pages, retaining original authorization scope, reconciling only unexecuted rows, and checking authorization again before submission. It explicitly forbids merely replacing expectedRevision, blindly replaying writes, or creating duplicate plans. Pending/unknown outcomes retain original-request inspection semantics.

The route does not authorize a write or pin the read: plan.get can return a newer revision. Existing optimistic-write validation remains unchanged. No new capabilities, permissions, model calls, automatic retries, or approval mechanisms are introduced. Existing connection/session and business-store isolation remain authoritative; this change does not invent per-plan ownership rules.

Verified recovery metadata has a 1,500-byte budget. If exceeded, the entire executable route is omitted. Caller payloads, caller revision values, titles, full rows, and stale preparation references are not echoed into conflict details. If reading the original plan fails during enrichment, the original conflict remains without details.

The suggested read is row-paged, not a new byte-limited plan API. Existing model projection handles large read results. Normal conflict projections measured 955 bytes for revise and 1,039 bytes for submit in this controlled test.

## Verification

The test uses immutable recorded source title and store identity with explicitly local plan/row/offer lifecycle controls. All external client, broker, reviewer and fetch routes fail if called.

Controls cover all four aliases, executing the returned read, retained failed/never status, no full-result spill for conflict guidance, unchanged business plans, different connection, unbound session, missing plan, huge caller payload/reference, oversized verified identity, another revision change before reading, stale revision rejected again, unresolved row preserved, disappearance during enrichment, and deletion before reading. External calls, business executions and review-cache entries remain zero.

Exact runtimes: Node 22.18.0 and 24.21.0. Targeted regression set: business-plan-pages, business-generation, listing-provider-revision, provider, business-operations and apps-runtime/runtime. Real-data audit and TypeScript checks accompany the targeted run. This is not a full-suite, live merchant, model, browser, or desktop validation.

An initial TypeScript run found missing generated browser-data.ts in the fresh worktree; the repository's offline real-data audit generated it from the verified frozen corpus before subsequent checks. No source facts or tracked corpus files were altered.
