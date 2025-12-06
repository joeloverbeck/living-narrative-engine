# GOARESTASSCHVAL-004 – Validate refinement-method references from tasks

## Status

Completed – validation logic shipped alongside loader/doc/schema updates.

## Problem

- `refinementMethods.$ref` values in task files are never dereferenced during load, so typos or missing method files slip through and later crash when the refinement engine runs.
- Path strings are treated as opaque – callers can include `../` traversal or point at folders outside the owning mod and we never complain.
- Loader metadata still points the refinement-method loader at the legacy `tasks/refinement-methods/` directory, so even canonical data under `mods/<mod>/refinement-methods/` requires workarounds before it can load.

## Proposed scope

- Update the loader metadata/configuration so refinement-method manifests resolve files from `data/mods/<mod>/refinement-methods/` (root-level folder) instead of the obsolete `tasks/refinement-methods/` path. Fix any schema/docs that still reference the old layout.
- Enhance `TaskLoader` so each `$ref` is validated eagerly: normalize the path (allow an optional leading `./`), reject traversal (`..`) or paths that do not live inside `refinement-methods/`, resolve the absolute file location via the path resolver, and fetch/parse the JSON to ensure the file exists.
- While parsing, ensure the referenced file’s `id` matches the task’s declared `methodId`. Cache resolved files per loader run so multiple tasks referencing the same method only hit disk once.
- Emit targeted error messages (include modId/taskId/refPath) whenever a ref path is invalid or the fetched data is missing/incorrect. Tasks without refinement methods should keep working exactly as before.

## File list

- `src/loaders/taskLoader.js`
- `src/goap/loaders/refinementMethodLoader.js` (only if additional surface area is required for caching/coordination)
- `src/loaders/loaderMeta.js` / `defaultLoaderConfig.js`
- `data/schemas/task.schema.json`
- `data/schemas/mod-manifest.schema.json`
- `docs/modding/authoring-planning-tasks.md` (and any other doc still referencing the legacy folder)
- `tests/unit/loaders/taskLoader.test.js`
- `tests/integration/loaders/taskLoading.integration.test.js`
- `tests/unit/schemas/modManifest.schema.test.js`

## Out of scope

- Redesigning the refinement-method schema or execution pipeline.
- Implementing new operators referenced by canonical methods (covered by content tickets).
- Adjusting planner scoring or refinement branching logic.

## Acceptance criteria

### Tests

- `npm run test:unit -- tests/unit/loaders/taskLoader.test.js`
- `npm run test:unit -- tests/unit/schemas/modManifest.schema.test.js`
- `npm run test:integration -- tests/integration/loaders/taskLoading.integration.test.js`
- `npm run validate:quick` (fails when method references are broken and passes when fixed).

## Outcome

- TaskLoader now normalizes `$ref` strings, refuses traversal, fetches refinement files under `refinement-methods/`, and verifies IDs/taskIds while caching lookups.
- Loader metadata, schemas, docs, and tests align on the root-level `refinement-methods/` folder so method manifests and tasks agree on their locations.

### Invariants

- `$ref` resolution remains relative to the owning mod’s `refinement-methods/` directory.
- Valid references load exactly once per file; no duplicate registry entries are introduced.
- Tasks without refinement methods continue to load exactly as before.
