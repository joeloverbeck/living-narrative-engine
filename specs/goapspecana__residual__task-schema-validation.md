# GOAPSPECANA Residual: Task Schema Validation & Canonical Samples

**Reference**: `tickets/GOAPSPECANA-002-task-schema-specification.md` — planning-task schema + loader (now mostly shipped).

> This spec covers only the remaining scope after previous partial implementation.

## Context
- `data/mods/core/mod-manifest.json` exposes an empty `tasks` array and no mod ships `*.task.json` files, so no real content exercises the schema.
- `src/loaders/taskLoader.js` validates JSON structure but only checks `planningScope` and `refinementMethods.$ref` for formatting, not for existence of referenced scopes or method files.
- `tests/unit/goap/planner/goapPlanner.parameterBinding.test.js` shows how missing scopes currently surface at runtime (planner logs warnings and drops the task instead of failing during content load).
- Modder docs (`docs/modding/authoring-planning-tasks.md`, `docs/goap/task-loading.md`) describe canonical files under `data/mods/<mod>/tasks/` and `data/mods/<mod>/refinement-methods/`, but those files are absent.
- User-visible impact: mod authors cannot look at a verified example, and `npm run validate:*` cannot catch broken scope/method references because nothing real is loaded.

## Original intent (brief)
- Publish a complete JSON schema + loader for planning tasks so mods can define GOAP intents (`tickets/GOAPSPECANA-002-task-schema-specification.md`).
- Provide sample task files (e.g., `consume_nourishing_item.task.json`) and wire them into validation/documentation.
- Ensure the validation system rejects malformed tasks before planning time.

## Already implemented (for reference only)
- `data/schemas/task.schema.json` (version 1.0.0) defines the task contract, including `structuralGates`, `planningScope`, `planningPreconditions`, `planningEffects`, and `refinementMethods`.
- `src/loaders/taskLoader.js` enforces schema validation plus formatting rules for scope references and method IDs.
- Loader unit/integration suites (`tests/unit/loaders/taskLoader.test.js`, `tests/integration/loaders/taskLoading.integration.test.js`) keep schema + loader behaviour covered.
- Modder documentation lives at `docs/modding/authoring-planning-tasks.md` and `docs/goap/task-loading.md`.

## Remaining Problem
1. **No canonical content**: `data/mods/**/tasks/` does not exist and every manifest lists `"tasks": []`. Without at least one checked-in `.task.json` (plus matching refinement-method files in `data/mods/<mod>/refinement-methods/`), we cannot prove schema + loader compatibility using real files, and modders have nothing concrete to copy. Integration tests rely on synthetic fixtures fetched from mocks instead of actual disk content.
2. **Cross-file validation gaps**:
   - `TaskLoader` only validates that `planningScope` looks like `modId:scopeName` (or `none`/`self`). If a mod references a non-existent scope, the loader still succeeds and the planner later emits `Planning scope not found` warnings (`tests/unit/goap/planner/goapPlanner.parameterBinding.test.js`).
   - `refinementMethods.$ref` values are never dereferenced; typos silently produce runtime failures when the refinement method loader cannot find a matching file/ID.
   - The mod-manifest schema is missing a `"refinement-methods"` content entry rooted at `data/mods/<mod>/refinement-methods/`, so even if a mod wanted to ship method files, the manifest would fail validation.
3. **Doc vs code mismatch**: Authoring docs explain how to place files under `tasks/` and `refinement-methods/`, but running the repo provides no working sample nor validation to back those instructions.
4. **Planning-scope semantics unproven**: `specs/goap-system-specs.md` requires planning scopes to bind concrete entities (e.g., `items:known_nourishing_items`) so the planner spawns a parametrized task instance per known entity. Nothing in the loader, tests, or canonical content demonstrates that workflow, so we are missing coverage for knowledge-limited scopes, multi-instance task registration, and the data-driven refinement branching that depends on scope variables.

## Truth sources
- `data/schemas/task.schema.json`
- `src/loaders/taskLoader.js`
- `tests/unit/loaders/taskLoader.test.js`
- `tests/integration/loaders/taskLoading.integration.test.js`
- `tests/unit/goap/planner/goapPlanner.parameterBinding.test.js`
- `data/mods/core/mod-manifest.json`
- `docs/modding/authoring-planning-tasks.md`
- `docs/goap/task-loading.md`

## Desired behavior (residual only)
### Normal cases
- Ship at least two canonical task definitions under `data/mods/core/tasks/` (e.g., `consume_nourishing_item.task.json`, `arm_self.task.json`) that fully exercise `structuralGates`, `planningScope`, `planningPreconditions`, `planningEffects`, and `refinementMethods`.
- Provide matching refinement-method files inside `data/mods/core/refinement-methods/` and list them in the manifest once the schema allows the `refinement-methods` content key.
- Update `data/mods/core/mod-manifest.json` (and schema) so task + refinement-method files are enumerated, allowing `npm run validate:*` to load them via the existing loader stack.
- Extend `TaskLoader` so, during `_validateTaskStructure`, it looks up the named scope in the scope registry (or scoped AST cache) and fails the load if the scope is missing (excluding `none`/`self`).
- Add a validation step (during load or immediately after content load) that ensures each referenced refinement method exists (either by verifying the `$ref` path resolves on disk or by checking the data registry for the `methodId`).
- Canonical sample tasks must demonstrate the workflow described in `specs/goap-system-specs.md`: a planning scope such as `items:known_nourishing_items` binds concrete entities so the planner creates multiple scored task instances (apple vs melon) and refinement methods can branch based on scope parameters (inventory vs nearby vs container vs movement). The spec assumes refinements stay data-driven; new operator hooks (e.g., `is_entity_inside_accessible_container`) belong under `src/logic/operators/` and must be referenced from the canonical methods instead of bespoke JS.

### Edge cases
- `planningScope: none` and `planningScope: self` remain valid shortcuts and must bypass existence checks.
- If a scope is provided by another mod (dependency), the validation must respect load order and surface a helpful error if the dependency is missing.
- Relative `$ref` paths should forbid `..` segments and must resolve inside the owning mod.
- `refinementMethods.$ref` paths resolve relative to `data/mods/<mod>/refinement-methods/` rather than living under `tasks/`. Update schema documentation and loader error messages to match.

### Failure modes
- Loading should throw descriptive errors when a scope reference is missing (`"planningScope 'core:foo' not found in scope registry"`).
- Missing or unreadable refinement-method files should cause loader failures (`"refinementMethods[0].$ref" did not resolve: path ..., methodId ...`).
- Manifest validation must reject content sections that omit listed files or include unsupported keys once `refinement-methods` is added.

### Invariants
- The schema fields defined in `data/schemas/task.schema.json` remain unchanged; this work only augments validation + content coverage.
- Loader defaults (`cost = 10`, `priority = 50`) keep working.
- Planner/runtime code should not see behavioural regressions; tasks that pass loader validation must behave the same as before.

### API contracts
- Keep `planningScope` as a string referencing scopes by `modId:scopeName` plus the two special literals.
- Task + method IDs continue using namespaced identifiers; no change to consumer APIs (`GoapPlanner`, `RefinementEngine`).
- Docs stay accurate with the new canonical files referenced by path.

## Out of scope
- Redesigning the scope DSL or JSON Logic condition schema.
- Changing planner heuristics, cost/priority semantics, or refinement engine logic.
- Introducing new GOAP operation types (covered by other specs).

## Testing plan (residual)
- **Invariants to keep**: `tests/unit/loaders/taskLoader.test.js`, `tests/integration/loaders/taskLoading.integration.test.js`, `tests/unit/goap/planner/goapPlanner.parameterBinding.test.js`, and downstream GOAP integration suites must remain green.
- **New/updated tests**:
  1. Fixture-based loader test that reads the canonical `*.task.json` files from disk and verifies they validate + register correctly.
  2. Unit tests covering the new `planningScope` existence check (both success and failure cases, including `none`/`self`) plus verification that valid scopes seed multiple task instances using scope variables.
  3. Tests asserting the loader fails when a referenced refinement method file/ID is missing or resides outside the allowed directory (root-level `refinement-methods/`).
  4. Schema validation test ensuring `mod-manifest.schema.json` accepts the `refinement-methods` content key and rejects invalid entries.
  5. Integration test (or an extension to `tests/integration/loaders/taskLoading.integration.test.js`) that loads the canonical tasks + methods via the full `ContentLoadManager` to prove registry wiring using real files, including planning-scope parameter binding and scoring heuristics between multiple entity-derived task instances.
- **Regression focus**: run `npm run validate:ecosystem` (or `validate:quick`) after adding files to ensure new manifests integrate cleanly.
