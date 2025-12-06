# GOAPSPECANA-002: Task Schema Specification

**Status**: Partially Implemented (schema + loaders shipped; canonical samples & cross-content validation pending)
**Priority**: CRITICAL
**Estimated Effort**: 2 days
**Dependencies**: GOAPSPECANA-001
**Blocks**: GOAPSPECANA-007, GOAPSPECANA-010
**Residual Spec**: `specs/goapspecana__residual__task-schema-validation.md`
**Last Reviewed**: 2025-11-18

## Current Status Summary (2025-11-18)

- **Implemented & tested**: `data/schemas/task.schema.json` defines the planner task contract; `src/loaders/taskLoader.js` enforces it with schema + structural checks; `tests/unit/loaders/taskLoader.test.js` and `tests/integration/loaders/taskLoading.integration.test.js` keep the loader + registry wiring green; docs live at `docs/modding/authoring-planning-tasks.md` and `docs/goap/task-loading.md`.
- **No longer relevant**: the earlier idea of declaring static `parameters` blocks per task was replaced by the Scope DSL-driven `planningScope`, and structural gates now use JSON Logic containers instead of ad-hoc `requires_components` arrays.
- **Still missing / under-specified**: no canonical `.task.json` files exist under `data/mods/**/tasks`, and the loader does not yet verify that referenced scopes or refinement-method files actually exist—see the residual spec for the remaining scope.

## Problem Statement

The original ticket called out the lack of a formal schema for GOAP planning tasks. That portion is now solved: tasks are modeled via `task.schema.json`, enforced by TaskLoader, documented for modders, and exercised through unit/integration tests. The remaining risk lies in the absence of real content samples and missing cross-content validation, which have been split into the residual spec referenced above.

## Objective

Maintain a single source of truth for planning-task structure, explain how each field is validated today, and document which pieces have been delivered versus which are handled by the residual follow-up. This spec now serves mainly as reference documentation plus a signpost to the outstanding work.

## Acceptance Criteria

- [x] Complete `data/schemas/task.schema.json` created (Draft-07, see file header).
- [x] Schema validates via AJV in the loader pipeline (TaskLoader + BaseManifestItemLoader use the configured schema).
- [x] All fields documented with descriptions directly in the schema and accompanying docs.
- [x] Required vs optional fields clearly marked through the schema `required` array.
- [x] Validation rules specified (patterns for IDs, planningScope format, refinement method IDs, operation schemas for effects).
- [ ] Example task files validate successfully → **Delegated to** `specs/goapspecana__residual__task-schema-validation.md`.
- [x] Schema integrated into validation system (configured through `StaticConfiguration.getContentTypeSchemaId('tasks')`).
- [x] Documentation updated with task authoring guide (`docs/modding/authoring-planning-tasks.md`).

## Tasks & Implementation Notes

### 1. Schema Structure Definition ✅

The schema defines: `id`, `description`, optional `structuralGates`, required `planningScope`, optional `planningPreconditions`, required `planningEffects`, required `refinementMethods`, and optional `cost`/`priority`. JSON Schema Draft-07 is enforced via AJV.

### 2. Planning Scope & Parameter Binding ✅ (supersedes the old "Parameters Schema")

Instead of embedding parameter definitions, tasks bind parameters dynamically using the Scope DSL. `planningScope` accepts `none`, `self`, or namespaced scope IDs (`modId:scope_name`). Runtime parameter resolution happens in `GoapPlanner` via the scope registry.

### 3. Structural Gates Schema ✅

`structuralGates` is a JSON Logic container with a required `condition` and optional `description`. It references `condition-container.schema.json`, so any operator supported by the logic engine can be used.

### 4. Planning Preconditions Schema ✅

`planningPreconditions` is an array of `{description?, condition}` objects that share the same condition schema. Preconditions are optional but, when present, must include a JSON Logic expression.

### 5. Planning Effects Schema ✅

`planningEffects` delegates to `operation.schema.json`, meaning planners can reuse the same operation types as rules (e.g., `ADD_COMPONENT`, `MODIFY_COMPONENT`, `REMOVE_COMPONENT`). Each effect must declare a `type` field.

### 6. Refinement Schema ✅

Tasks carry a `refinementMethods` array, each entry requiring a `methodId` (`modId:task_id.method_name`) and a `$ref` pointing to the relative path of the `.refinement.json` file. Method ID validation and task-to-method alignment are enforced inside `TaskLoader`.

### 7. Canonical Task Examples 🚧 (delegated)

No `.task.json` files exist under `data/mods/core/tasks/`, and manifests list empty `tasks` arrays. The work to author/example files, wire them into manifests, and make them part of the validation story is tracked separately in the residual spec.

### 8. Integration with Loading System ✅

TaskLoader extends `SimpleItemLoader` and adds task-specific validation (scope format, refinement method IDs, effect types). The mod manifest already exposes a `tasks` array, `StaticConfiguration` maps the schema ID, and integration tests confirm registry wiring.

## Expected Outputs

1. **Schema File**: `data/schemas/task.schema.json` (finished, version 1.0.0).
2. **Loader Implementation**: `src/loaders/taskLoader.js` with accompanying unit/integration tests.
3. **Documentation**: `docs/modding/authoring-planning-tasks.md` + `docs/goap/task-loading.md` for author guidance.
4. **Residual Scope**: Canonical task examples and cross-file validation (see new residual spec).

## Success Metrics

- AJV validation succeeds for every task file loaded by TaskLoader.
- Loader unit + integration suites remain green.
- Modder docs accurately describe the JSON structure.
- Canonical content + cross-validation will be measured under the residual spec once delivered.

## Notes

- Keep alignment with operation schema files—planning effects should always reuse those definitions.
- `planningScope` must remain knowledge-limited; scope existence checks are part of the residual work.
- `refinementMethods` only stores references; the actual method content lives in `.refinement.json` files loaded by the refinement-method loader.

## Scope Extraction & Next Actions (2025-11-18)

- **Done**: Schema + loader + documentation shipped; extensive unit/integration coverage exists.
- **Superseded**: The original per-task `parameters` object and bespoke structural gate keys were replaced by the Scope DSL + JSON Logic containers.
- **Delegated**: Canonical `.task.json` files, manifest wiring, and loader-level existence checks move to `specs/goapspecana__residual__task-schema-validation.md`.
- **Archive Recommendation**: Once the residual spec is delivered, move this ticket into `tickets/archive/` with the note "partially implemented; remaining scope tracked in residual spec".
