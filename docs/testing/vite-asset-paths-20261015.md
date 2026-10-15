# Actual Vite template assets through source preview

Date: 2026-10-15. Base: `d653938e06ff8b85794bebcbd07285330b108e28`.

## Contract and scope

The original `component-workspace/collected-products` template is a Vite/React/Tailwind project. Its checked-in `vite.config.ts` sets `base:'./'`. `DESIGN.md` and `docs/source-component-authoring.md` require previewing the same built dist. The real `startSourcePreview` serves the iframe entry at `/dist/index.html` and registers emitted resources under `/dist/`; its resource handler does not provide root `/assets/` aliases. The native source frame also uses a build-prefixed entry URL, but this test does not run native DSH or claim desktop evidence.

`test/source-preview/vite-asset-paths.test.ts` copies the actual template to an isolated temporary directory, links already installed component dependencies and invokes the real Vite CLI with the unchanged configuration and sources. It does not substitute esbuild for Vite, generate a replacement component, or rewrite business data.

The actual preview server returns the generated HTML. The test resolves every entry script/stylesheet reference as a browser would, requests it over loopback HTTP, and asserts status 200, independently expected JavaScript/CSS MIME and byte equality with the emitted manifest member. No browser executes the JavaScript, no DOM/layout or performance claim is made, and no provider/business request is sent. There is no business fixture: this is build/resource infrastructure coverage.

## Why existing tests miss this configuration regression

- The old preview test writes its own already-correct `dist/index.html` and asset bytes.
- Existing component/interaction/image tests bundle direct source imports and never consume this Vite configuration.
- `source-starter-react.test.ts` really builds a different generated esbuild starter and already catches duplicate React dispatcher problems; that covered candidate was excluded.
- The formal generated-product browser/performance gate likewise generates product-list/composed-table projects rather than this original Vite template. Its HTTP failure checks already cover generated-starter asset-path failures; that separate candidate was excluded.
- `test/plugin-apps/versions.test.ts` copies the Apps bundle inputs, not `component-workspace`, and checks release artifact domains. No duplicate version/hash test is added.

## Mutation proof

Only change `component-workspace/collected-products/vite.config.ts` from `base:'./'` to `base:'/'`. This is a common root-deployment configuration that is wrong for this prefixed source host.

Old neighboring command:

```sh
node --test test/source-preview/preview.test.ts test/source-preview/commerce-image-loading.test.ts test/source-preview/selection-interaction.test.ts test/source-preview/source-starter-react.test.ts test/plugin-server/source-assets.test.ts
```

New command:

```sh
node --test test/source-preview/vite-asset-paths.test.ts
```

Observed: original new 1/1 green; mutated old 10/10 green; mutated new fails after Vite successfully builds because the actual handler returns HTTP 404 for `/assets/index-*.js` instead of 200; restored combined 11/11 green. This is a missing detector; unmodified production code passes and no production fix is included.

## Cost and harness

The additional test takes approximately 9–11 seconds on the audit machine, dominated by the real Vite build. This is not a performance benchmark. Dependencies must already exist under both the root project and `component-workspace/collected-products`; nothing is installed. The old neighboring image test also requires the preinstalled `component-workspace/helen-margin` dependencies. No npm pack, whole Apps build, release publication or system deployment is performed.

All repository paths use `import.meta.url`. Dependency lookup occurs before creating a temporary directory. Vite has a 30-second subprocess timeout; each HTTP fetch has a 5-second deadline and the test has a 45-second cap. Nested finally blocks close the actual preview server and remove the isolated project even after an assertion failure. The original template and its dist are not built or overwritten.

Data audit, `tsc --noEmit` and diff check passed. Running the new test from outside the repository passed 1/1. An unavailable component dependency directory failed explicitly before mkdtemp and left no new temporary directory. The failed HTTP mutation and restored runs also left no temporary fixture directories. Full repository suite and browser/desktop execution were not run.

Independent pre-publication rerun: combined 11/11 pass (8.90 s); mutation old 10/10 pass (1.19 s), new fails at the actual HTTP 404 assertion (9.75 s), restored combined 11/11 pass (9.44 s); repository-external cwd 1/1 pass (8.75 s). Data audit and typecheck passed. Injected faults before temporary-directory creation, after template copy, and after the actual preview server starts all exited with explicit failure and left no temporary project. The started-server control also verified server.listening=false and the TCP port closed. Vite-owned Node compile-cache directories are toolchain caches, not temporary project leaks. Production bytes were restored unchanged; no full-suite or browser claim is made.
