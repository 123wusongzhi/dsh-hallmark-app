# Workbench read-response recovery candidate — 2026-10-16

Status: isolated source candidate, not integrated, published, installed, or counted as a new accepted UX fix. Based on local commit `c7b26cf`.

## Reproduced failure

An HTTP 502 gateway returning HTML rather than JSON threw a raw JSON parse error before the client retained the HTTP status. The workbench interpreted that unclassified error as non-retryable and discarded its successful snapshot. The rendered table unmounted, losing the user's local page and search filter. This differs from an ordinary JSON 503 or fetch rejection, which already preserved the snapshot.

The enabled `WorkbenchInstanceView` regression uses the real `AppsPresentationService`, in-memory `RuntimeStore`, and recorded product data. Only the transport fault is injected. Against the original API source, the assertion that the table remains mounted fails: actual table count 0, expected 1. This reproduced on Node 22.18.0 and 24.21.0.

## Minimal change

Read-only resource, refresh, workbench read, and preview requests now classify body-read/JSON failures while preserving the HTTP status. Malformed successful responses and 429/5xx responses are retryable read failures. Other client errors remain non-retryable. Response bodies and raw parser diagnostics are not shown to the user.

Aborted reads preserve their original cancellation error. Workbench save, initialize, prepare, pin, and unpin behavior is unchanged; those operations are never assigned a safe-read retry policy by this change. No automatic write retry is added.

## Verification scope

The related six-file group passed 13/13 tests on each exact runtime, Node 22.18.0 and 24.21.0. The final expanded new regression passed 2/2 on each. Both recorded-data audits passed. Initial typechecks lacked the generated browser corpus; it was rebuilt with the repository preparation script before retrying; both prepared-worktree typechecks passed.

- Real React + service journey: page retention, local filter retention, repeated malformed response, recovery clearing the notice, hidden/resumed task retaining its snapshot, cold failed load offering explicit retry, and successful retry.
- Non-JSON 401 and 403 remove protected rows; successful recovery starts with reset local state.
- API boundaries: HTTP 200/401/403/404/429/502/503, resource/refresh/read/preview methods, cancellation, structured denial, and unchanged mutation failure classification.
- Related regression group: cache fallback, cache refresh, table continuity, store isolation, and workspace resume.

Offline source verification only. No live merchant, browser screenshot, native desktop, installation, or full-suite claim. Existing candidate acceptance counts are unchanged. Raw execution evidence stays local.
