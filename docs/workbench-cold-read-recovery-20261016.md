# Workbench metadata recovery — 2026-10-16

Local source candidate only. Original baseline: `3d8310dba2724f203c4bf531abcac9e9c8480718`. The cold-read-only checkpoint `7c1e02beb1ce5c013dc278e6ec253c84efe2fbcd` was not published; independent review found the adjacent accepted-snapshot permission defect and this candidate addresses both parts of the same metadata recovery journey.

## Two reproduced failures

1. A cold detail-tab metadata request fails before any board is accepted. The baseline displays the read error and retry action, but also states “此组件已从工作台移除”. The catalogue's equivalent failure claims “0 个常用组件”. Neither absence statement follows from a failed read. Both exact runtimes fail the new assertion `failed reads must not assert absence`; initial logs are retained.
2. After a successful board and table load, a denied metadata reread leaves the old table visible. The original metadata catch only set error text. The existing #100 protection belongs to data-read responses and does not cover this endpoint. Adding the denial expectation to the cold-read checkpoint fails on both runtimes: `metadata HTTP 401 removes previously accepted data`, actual table count 1, expected 0. The later 403/404 representations are explicit regression cases. Independent review separately reproduced 403/404 against both the original baseline and cold-read checkpoint.

## Scoped correction

- An unread board displays “尚未读取到工作台，无法确认组件列表。请点击‘重新读取工作台’重试。” Successful empty boards still show zero components; a successfully read board missing the requested instance still reports its removal.
- Metadata reads reuse the existing `cacheFallbackAllowed` policy. Transient failures retain the accepted board and its table/filter. Non-fallback failures invalidate the local board and unmount its data reader, clearing selection/filter interaction state and cancelling pending reads.
- A per-app local rejection guard prevents a new object reference to an old parent snapshot from restoring denied content. A successful metadata read unlocks it.
- The workspace propagates explicit `null` invalidation to its overview and retained detail tabs. Its per-app denial set blocks ordinary board publications and cached parent updates, including after app navigation. Only the metadata-read acceptance callback clears this guard. Successful mutations retain their existing behavior outside a denied scope; no mutation is retried automatically.
- Aborted responses and responses from another app-read identity are ignored. The production keyed-app boundary remains in use.

The invalidation scope is the app-level `resource=workbench&appId=...` metadata endpoint. A 404 there makes that board unavailable. This does not reinterpret a single component data-read 404 as permission revocation for the entire app.

## Production React coverage

`test/plugin-apps/workbench-cold-read-recovery.test.ts` mounts the production `AppsDirectory → AppsWorkspace → WorkbenchBoard → WorkbenchInstanceView → table` path, plus focused board scenarios. Only fetch responses are controlled locally; product/store values come from the verified recorded corpus.

- Cold detail/catalogue HTTP 503/403/404, repeated failures, pending retry without false empty/removal, successful retry showing recorded product data or cards, and the return action.
- Successfully read empty catalogue and confirmed missing component remain distinct negative controls.
- Existing snapshot plus transient metadata 503 preserves local search and makes no additional product read on metadata retry.
- Accepted snapshot plus JSON 401/403/404 (`NOT_FOUND` for 404) and HTML 403/404 removes the old table. Repeated retry and parent snapshot replacement cannot restore it. A successful reread renders a new table with fresh local state.
- Two genuinely mounted retained detail readers are both removed when parent metadata is denied. The pending child data read is aborted, its late response is ignored, and old detail controls disappear. Switching detail tabs or returning to the catalogue cannot restore rejected rows/cards.
- Stale parent board events are rejected; switching away and back does not clear the denial guard. A later successful metadata read permits recovery.
- A delayed 403 from an old, aborted app cannot invalidate a newly accepted app board.
- Hidden-task cancellation/resumption and read-only recovery. No merchant operation, agent call or write is issued by this fixture.

## Verification

The final twelve-file related group includes this regression, store retry, cards, #100 malformed read-response recovery, cache fallback, table browsing continuity, workspace resume/tab close/performance, material close/agent request and business store entry. The final result is recorded in the local verification manifest. The initial cold-only matrix was seven files, 12/12 on both runtimes; it is historical evidence, not the final expanded acceptance count.

Two final negative controls restore only one production module from `7c1e02b` while keeping the new assertions:

- Board-only rollback: the accepted-snapshot metadata denial assertion fails (table 1 versus 0).
- Workspace-only rollback: the hidden parent-owned table survives the denial (table 1 versus 0).

Initial failures, intermediate runs, the initial test-only TypeScript implicit-parameter errors, and corrected final runs remain separate. No timeout or assertion was relaxed. A twelve-file run started before the final per-app guard/test edits is retained as intermediate evidence only; the final matrix is rerun on the frozen production/test contents.

## Limits

This is React/API-boundary fixture verification, not browser interaction, visual-layout acceptance or a full repository suite. The unrelated intermittent `workspace-resume` child-status-null incident is not diagnosed or fixed here. No publication, installation, live-store access or external write occurred.

The scope is workbench overview/detail metadata and shared snapshot propagation. `MaterialLibrary` has independent metadata/read/write and draft state; its permission lifecycle is not fully covered or certified by this change. Retaining its local board after parent invalidation is a separate investigation lead, not evidence here of actual unauthorized backend reads or writes.

The supplied public SHA `455eedecf37dcb1d732ec45d5bdfc3d0414328e1` is unavailable in this checkout's Git object database. No public-head comparison or integration claim is made. All baseline claims refer to the local frozen commits above.
