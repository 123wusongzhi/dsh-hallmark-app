# Separate sustained-interaction follow-up

This supplement preserves the original five-cycle evidence, harnesses, bundles and manifests. It was created to investigate the original five-change trial's medium-business aggregate CPU increase and 500-product selection-tail regression without attributing either to GC/JIT. The formatter trial was subsequently rejected after repeated roughly 200 ms clear-selection events in two sustained processes.

This repository accepts four changes; its collected-products component and formatter helpers remain at the baseline. Running this supplement against this repository measures the accepted business change plus an unchanged collected-products control. The historical formatter trial is preserved outside the repository at workspace-relative `output/candidate72-validation-20261011/candidate`, with original results in the sibling `results` directory. Reproducing that trial requires passing that preserved tree explicitly. Historical trial results do not describe the current repository.

```powershell
node <candidate>/scripts/performance/candidate72-windows/frontend/supplement-run.mjs build <baseline> <candidate> <new-output>
node <candidate>/scripts/performance/candidate72-windows/frontend/supplement-run.mjs functional <baseline> <candidate> <new-output>
node <candidate>/scripts/performance/candidate72-windows/frontend/supplement-run.mjs timing <baseline> <candidate> <new-output> 5
```

Two workloads are included: business 10 rows × 20 attributes, and the collected-products 500-row control. The default is five serial ABBA cycles, producing 40 independent processes. The final argument may override the cycle count; use a fresh output directory for each run.

Both business arms execute 30 warmup cycles followed by 200 measured cycles. CPU and elapsed measurement start after warmup and after capturing its full output frame. Warmup CPU/time remain separately recorded. Both collected arms execute 30 warmup cycles followed by 100 measured cycles with the original eleven-action order and post-warmup CPU boundary. No forced GC, altered delays, sampling exclusions, or outlier deletion are used.

Each measured process retains complete initial, post-warmup and final host frames. The runner compares these frames directly across arms, in addition to the original fixture, independent selection/filter/order oracle and request checks. `functional` retains complete per-action host frames for the original interaction sequence in both workloads, checks matching legacy image-error behavior, and runs the accepted business-content regression. Rejected formatter-specific tests are excluded. Full per-action timing samples and outputs remain in child JSON plus `timing-raw.json`.

`timing-summary.json` includes per-action median/p95/max, cold mount, cycle timing, post-warmup task CPU, ABBA direction, and `selectionTails`: aggregate and each-process median/p95/max plus >8 ms and >16.67 ms counts. These thresholds only describe this headless harness; they are not browser dropped-frame assertions.

`supplement-config.json` fixes all workload lengths. The build manifest records its SHA256, full harness text snapshots and SHA256, production source hashes, and bundle hashes. Subsequent runs reject changed configs, harnesses, production sources, or bundles. The actual measured output records the config too. Original evidence must remain available alongside any conclusions from this follow-up, including negatives that do not recur during sustained interaction.
