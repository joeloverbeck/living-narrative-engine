# TARCOMVAL-004: Isolate Context Updates via Stage Results Emitter

**Phase:** TargetComponentValidation Hardening - Phase 4
**Priority:** Medium-High
**Estimated Effort:** 4 days

## Goal

Introduce a `ContextUpdateEmitter` (or equivalent collaborator) that applies immutable validation results back to pipeline context, eliminating the remaining implicit mutations that still happen inside the IO adapter’s rebuild step and clarifying downstream contracts.

## Context

`TargetComponentValidationStage` already relies on `TargetValidationIOAdapter` to normalize the pipeline context and rebuild the response payload, so the stage itself no longer calls a dedicated `#updateActionTargetsInContext` helper.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L154-L253】【F:src/actions/pipeline/adapters/TargetValidationIOAdapter.js†L65-L214】 The remaining context mutations happen inside `TargetValidationIOAdapter.rebuild` where the legacy `candidateActions` path rewrites `actionDef.resolvedTargets` objects in-place and also mutates the shared `context.resolvedTargets` reference captured in `metadata.sharedResolvedTargetsRef`.【F:src/actions/pipeline/adapters/TargetValidationIOAdapter.js†L174-L213】 During validation the stage records pruner metadata in `metadata.stageUpdates`, but nothing consumes that data yet, so downstream synchronization is still implicit.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L407-L599】 With the IO adapter and pruner already producing explicit structures, we need a controlled mechanism to apply context updates, remove the rebuild-time mutations, and surface pruning metadata for testing.

## Deliverables

1. `ContextUpdateEmitter` (or similarly named collaborator) that accepts normalized validation results plus recorded stage updates and applies changes to the pipeline context in a deterministic manner, replacing the mutable logic currently embedded in `TargetValidationIOAdapter.rebuild`.
2. Definition of a `TargetValidationResult` / `StageUpdate` contract capturing kept targets, removals, role metadata, and any context-level deltas required to keep `resolvedTargets`, `actionsWithTargets`, and legacy `candidateActions` in sync.
3. `TargetComponentValidationStage.executeInternal` refactored so it collects immutable results from the validation loop and delegates all context mirroring to the new emitter (the IO adapter should only shape return data, not mutate `actionDef` or shared context references).
4. Unit tests for the emitter covering legacy and multi-target contexts, ensuring `resolvedTargets`, `actionsWithTargets`, and mirrored structures stay synchronized without relying on incidental object identity.
5. Adjustments (if needed) to downstream consumers to rely on emitter-applied results rather than the adapter’s implicit mutations, including updates to any integration tests that currently observe mutated `ActionDefinition` objects.

## Tasks

1. **Define Result Contracts**
   - Formalize the immutable data produced by the stage/pruner/validators (e.g., `{ actionId, keptTargets, removedTargets, targetContexts, stageUpdates }`).
   - Ensure `TargetValidationIOAdapter.normalize` exposes enough metadata (original indexes, references, shared context handles) for the emitter to operate without guessing.【F:src/actions/pipeline/adapters/TargetValidationIOAdapter.js†L72-L132】
2. **Implement ContextUpdateEmitter**
   - Relocate the mutation logic from `TargetValidationIOAdapter.rebuild` into the emitter so context synchronization happens in one place.【F:src/actions/pipeline/adapters/TargetValidationIOAdapter.js†L174-L213】
   - Provide methods like `applyToContext({ context, results, format, metadata })` to cover both `actionsWithTargets` and `candidateActions` flows, leveraging `metadata.stageUpdates` recorded during validation.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L407-L599】
3. **Refactor Stage Return Value**
   - Modify `TargetComponentValidationStage.executeInternal` to gather `TargetValidationResult[]`, pass them to the emitter, and keep the IO adapter focused on shaping return payloads (no more writes to `actionDef.resolvedTargets` or shared context references inside `rebuild`).【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L200-L253】
   - Maintain compatibility with the `PipelineResult` contract so existing pipeline orchestration continues to function.
4. **Testing & Regression**
   - Add unit tests for the emitter that validate context synchronization for: full retention, partial removals, and all targets removed.
   - Update integration tests (from prior tickets) to assert that downstream stages observe the correct pruned targets without relying on implicit mutations.

## Validation

- [ ] Stage no longer mutates `context` structures directly; all updates flow through the emitter.
- [ ] Result contract documented and covered by unit tests.
- [ ] Downstream stages continue to receive expected `resolvedTargets` data post-emitter application.
- [ ] Regression tests confirm parity with pre-refactor behavior.

## Dependencies

- Requires TARCOMVAL-001 through TARCOMVAL-003 to ensure adapter, pruner, and reporter provide necessary data and structure.
