# TARCOMVAL-001: Establish IO Adapter and Role Registry

**Phase:** TargetComponentValidation Hardening - Phase 1
**Priority:** High
**Estimated Effort:** 3 days

## Goal

Introduce a dedicated IO adapter and centralized role registry so `TargetComponentValidationStage` can operate on a canonical intermediate representation without relying on implicit mutations or scattered role arrays.

## Context

The current stage normalizes `actionsWithTargets` vs `candidateActions` inline and mirrors the original shape after validation, creating brittle coupling to upstream shape changes.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L78-L198】 It also mutates `actionDef.resolvedTargets`, rewrites `context.actionsWithTargets[*].resolvedTargets`, prunes `targetContexts` based on placeholder metadata sourced from `targetDefinitions`/`targets`, and falls back to `context.resolvedTargets` when per-action metadata is missing.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L350-L559】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L630-L694】 Role handling is currently hard-coded (`target`, `primary`, `secondary`, `tertiary`) even though the stage also injects the actor when reconstructing target maps, so adding or renaming roles requires broad edits.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L362-L365】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L727-L767】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L842-L850】 This ticket lays the foundation for later refactors by extracting explicit collaborators and locking in behavior with tests.

## Deliverables

1. `TargetValidationIOAdapter` module providing `normalize(pipelineContext)` and `rebuild(results)` APIs.
2. `TargetRoleRegistry` utility exporting canonical role definitions, placeholder semantics, and helpers to detect legacy vs multi-target payloads.
3. Unit and snapshot tests covering both legacy (`actionsWithTargets`) and multi-target (`candidateActions`) flows to ensure round-trip fidelity.
4. Stage updated to delegate normalization/rebuild to the adapter without changing validation logic yet.
5. Documentation of new modules within `specs/` or inline JSDoc comments.

## Tasks

1. **Extract IO Adapter**
   - Move branching logic from `executeInternal` that determines incoming data shape (including the `'empty'` sentinel) into `TargetValidationIOAdapter.normalize` so the stage no longer inspects both collections directly.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L78-L198】
   - Ensure adapter returns `{ format, items, metadata }` where each item captures the action definition, `resolvedTargets`, `targetDefinitions`, `targetContexts`, and placeholder sources needed for downstream filtering and context synchronization today.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L350-L559】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L630-L694】 Metadata should also expose shared structures (e.g. `context.resolvedTargets`, actor reference) so the stage can avoid re-running `#extractTargetEntities`.
   - Implement `rebuild(results)` to accept immutable validation results and restore the original structure (including action ordering, `continueProcessing` counts, and legacy mirroring requirements for `candidateActions` vs `actionsWithTargets`).【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L174-L198】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L478-L559】
2. **Create Role Registry**
   - Introduce `TargetRoleRegistry` with exported constants for the legacy `target` role, multi-target roles (`primary`, `secondary`, `tertiary`), and the implicit `actor` inclusion used when constructing resolved maps. Provide helper functions for placeholder lookups sourced from `targetDefinitions`/`targets`.
   - Replace hard-coded arrays in the stage and helpers like `#extractTargetEntities` with registry imports while keeping behavior intact.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L350-L372】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L727-L767】
3. **Testing**
   - Add golden tests that feed representative legacy and multi-target payloads (including placeholder-laden `targetContexts`) into the adapter, asserting round-trip equality after `rebuild` and that context metadata remains aligned for downstream mutation hooks.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L350-L559】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L630-L694】
   - Verify registry exposes existing roles, guards against unsupported ones, and mirrors the legacy-vs-multi-target detection that `#extractTargetEntities` performs.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L727-L767】
4. **Documentation**
   - Add JSDoc to new modules describing contracts and expected data shapes.
   - Update relevant spec or architecture notes summarizing the adapter/registry responsibilities.

## Validation

- [ ] Adapter round-trip tests cover both input formats and edge cases (empty targets, placeholder targets).
- [ ] Stage runs using the adapter without mutating behavior (snapshot test or regression harness).
- [ ] Registry fully replaces direct role arrays inside the stage.
- [ ] New modules documented with JSDoc and spec updates.

## Dependencies

- No prior TARCOMVAL tickets.
- Coordinate with teams touching `TargetComponentValidationStage` to avoid merge conflicts while extraction occurs.
