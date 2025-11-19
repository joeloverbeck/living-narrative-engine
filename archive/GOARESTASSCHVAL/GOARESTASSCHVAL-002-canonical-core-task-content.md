# GOARESTASSCHVAL-002 – Canonical core tasks and refinement methods

_Status: Completed_

## Problem
No canonical `*.task.json` or refinement-method files exist in `data/mods/core`, leaving docs without concrete examples and preventing schema + loader coverage based on real assets.

## Proposed scope
Create two canonical planning tasks in `data/mods/core/tasks/` (`consume_nourishing_item` and `arm_self`) plus their refinement methods under `data/mods/core/refinement-methods/`. Each task must demonstrate structural gates, planning scope parameterization, JSON-Logic preconditions/effects, and branching refinement methods that reference real primitive actions (e.g., `items:pick_up_item`, `items:drink_entirely`).

Because no knowledge-limited scopes or state components exist for these scenarios today, add lightweight `core:known_nourishing_items` and `core:known_armament_items` scope definitions along with marker components `core:hungry` and `core:armed` so the new content validates cleanly. Update `data/mods/core/mod-manifest.json` now that schema support is already present (dependency on GOARESTASSCHVAL-001 is resolved) and refresh the docs to walk through the canonical samples.

## File list
- `data/mods/core/tasks/consume_nourishing_item.task.json`
- `data/mods/core/tasks/arm_self.task.json`
- `data/mods/core/tasks/README.md` (or equivalent doc breadcrumb if needed)
- `data/mods/core/refinement-methods/consume_nourishing_item/*.json`
- `data/mods/core/refinement-methods/arm_self/*.json`
- `data/mods/core/components/hungry.component.json`
- `data/mods/core/components/armed.component.json`
- `data/mods/core/scopes/known_nourishing_items.scope`
- `data/mods/core/scopes/known_armament_items.scope`
- `data/mods/core/mod-manifest.json`
- `docs/modding/authoring-planning-tasks.md`
- `docs/goap/task-loading.md`

## Out of scope
- Changing task schema shape or loader validation rules (handled elsewhere).
- Adding gameplay systems beyond what the canonical samples require.
- Introducing new planner heuristics or runtime behaviors unrelated to the sample assets.

## Acceptance criteria
### Tests
- `npm run validate:quick` (loads the manifest entries for the new files).
- `npm run test:integration -- tests/integration/loaders/taskLoading.integration.test.js`
- `npm run test:unit -- tests/unit/loaders/taskLoader.test.js` (ensure fixtures updated for canonical content).

### Invariants
- Schema defaults (cost/priority) continue to apply where omitted.
- Canonical tasks remain data-only; no bespoke JS is added outside allowed operator hooks.
- Other mods’ manifests continue to validate without referencing the new files.

## Outcome
- Added `data/mods/core/tasks/consume_nourishing_item.task.json` and `arm_self.task.json` plus their refinement methods so canonical planning examples now exist in core.
- Created the supporting scopes (`core:known_nourishing_items`, `core:known_armament_items`) and marker components (`core:hungry`, `core:armed`) and wired them into the core manifest for schema validation.
- Documented the samples in `docs/modding/authoring-planning-tasks.md` and `docs/goap/task-loading.md`, and pointed content authors at the new README under `data/mods/core/tasks/`.
