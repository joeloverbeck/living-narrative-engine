# TARCOMVAL-001: Establish IO Adapter and Role Registry

**Phase:** TargetComponentValidation Hardening - Phase 1
**Priority:** High
**Estimated Effort:** 3 days

## Goal

Introduce a dedicated IO adapter and centralized role registry so `TargetComponentValidationStage` can operate on a canonical intermediate representation without relying on implicit mutations or scattered role arrays.

## Context

The current stage normalizes `actionsWithTargets` vs `candidateActions` inline and mirrors the original shape after validation, creating brittle coupling to upstream shape changes.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L78-L198】 Additionally, hard-coded role lists make it risky to add or rename target roles.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L362-L365】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L842-L850】 This ticket lays the foundation for later refactors by extracting explicit collaborators and locking in behavior with tests.

## Deliverables

1. `TargetValidationIOAdapter` module providing `normalize(pipelineContext)` and `rebuild(results)` APIs.
2. `TargetRoleRegistry` utility exporting canonical role definitions, placeholder semantics, and helpers to detect legacy vs multi-target payloads.
3. Unit and snapshot tests covering both legacy (`actionsWithTargets`) and multi-target (`candidateActions`) flows to ensure round-trip fidelity.
4. Stage updated to delegate normalization/rebuild to the adapter without changing validation logic yet.
5. Documentation of new modules within `specs/` or inline JSDoc comments.

## Tasks

1. **Extract IO Adapter**
   - Move branching logic from `executeInternal` that determines incoming data shape into `TargetValidationIOAdapter.normalize`.
   - Ensure adapter returns `{ format, items, metadata }` where each item captures the action definition, resolved targets, and any per-action context currently relied on by the stage.
   - Implement `rebuild(results)` to accept immutable validation results and restore the original structure (including action ordering and legacy mirroring requirements).
2. **Create Role Registry**
   - Introduce `TargetRoleRegistry` with exported constants for primary/secondary/tertiary/etc. roles and helper functions for placeholder lookups.
   - Replace hard-coded arrays in the stage with registry imports while keeping behavior intact.
3. **Testing**
   - Add golden tests that feed representative legacy and multi-target payloads into the adapter, asserting round-trip equality after `rebuild`.
   - Verify registry exposes existing roles and guards against unsupported ones.
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
