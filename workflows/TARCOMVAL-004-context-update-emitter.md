# TARCOMVAL-004: Isolate Context Updates via Stage Results Emitter

**Phase:** TargetComponentValidation Hardening - Phase 4
**Priority:** Medium-High
**Estimated Effort:** 4 days

## Goal

Introduce a `ContextUpdateEmitter` (or equivalent collaborator) that applies immutable validation results back to pipeline context, eliminating implicit mutations and clarifying downstream contracts.

## Context

`TargetComponentValidationStage` currently mutates `context.actionsWithTargets`, `context.resolvedTargets`, and `actionDef.resolvedTargets` in-place via `#updateActionTargetsInContext`, making it difficult for downstream stages to rely on consistent data shapes.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L630-L694】 With the IO adapter and pruner producing explicit result sets, we need a controlled mechanism to synchronize context updates and expose removal metadata for testing.

## Deliverables

1. `ContextUpdateEmitter` (or similarly named collaborator) that accepts `TargetValidationResult[]` and applies changes to pipeline context in a deterministic manner.
2. Definition of `TargetValidationResult` / `StageUpdate` structure capturing kept targets, removals, and role metadata for each action.
3. Stage refactored to return results instead of mutating context directly, delegating application to the emitter.
4. Unit tests for the emitter covering legacy and multi-target contexts, ensuring `resolvedTargets`, `actionsWithTargets`, and any mirrored data stay synchronized.
5. Adjustments (if needed) to downstream consumers to rely on emitter-applied results rather than implicit mutations.

## Tasks

1. **Define Result Contracts**
   - Formalize the data shape produced by the stage/pruner/validators, including action identifiers, role-to-target mappings, and removal metadata.
   - Update IO adapter to pass necessary context (e.g., indexes, references) so emitter can patch structures without guesswork.
2. **Implement ContextUpdateEmitter**
   - Move logic from `#updateActionTargetsInContext` into the new collaborator, ensuring no direct mutation occurs inside the stage.
   - Provide methods like `applyToContext({ context, results, format })` to handle both `actionsWithTargets` and `candidateActions` flows.
3. **Refactor Stage Return Value**
   - Modify `TargetComponentValidationStage.executeInternal` to collect results and return them (or pass to emitter) instead of mutating context inline.
   - Ensure compatibility with the IO adapter’s `rebuild` step and maintain existing public API expectations.
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
