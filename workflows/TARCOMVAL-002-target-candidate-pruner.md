# TARCOMVAL-002: Extract Target Candidate Pruner Service

**Phase:** TargetComponentValidation Hardening - Phase 2
**Priority:** High
**Estimated Effort:** 4 days

## Goal

Create a standalone `TargetCandidatePruner` that encapsulates required-component filtering and returns immutable results, enabling `TargetRequiredComponentsValidator` to consume consistent inputs without in-place mutations.

## Context

`TargetComponentValidationStage` currently mutates `actionDef.resolvedTargets` and `context.actionsWithTargets` while pruning, duplicating logic already present in `TargetRequiredComponentsValidator` and making failure reasons diverge.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L350-L417】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L630-L694】【F:src/actions/validation/TargetRequiredComponentsValidator.js†L90-L199】 Extracting a pruner service will consolidate filtering, surface explicit removal metadata, and prepare the stage for immutable result handling. Note that the existing strict vs. lenient configuration only alters how forbidden-component failures are treated; required-component filtering always runs, so the pruner must remain configuration-agnostic.

## Deliverables

1. `TargetCandidatePruner` module with API `prune({ actionDef, resolvedTargets, targetContexts, registry, config })` returning `{ keptTargets, removedTargets, removalReasons }`.
2. Stage updated to consume pruner output instead of mutating `actionDef`/context directly.
3. `TargetRequiredComponentsValidator` updated (if necessary) to accept pruner output, ensuring single source of truth for required-component checks.
4. Unit tests comparing pruner results with existing stage behavior, confirming placeholder rules and that strict vs. lenient configuration toggles do not change pruning outcomes (since strictness only affects forbidden-component validation today).
5. Transitional integration tests to ensure discovery still honors required-component constraints.

## Tasks

1. **Implement Pruner Service**
   - Translate `#filterTargetsByRequiredComponents` and `#candidateHasRequiredComponents` into pure functions within the new service.
   - Support role-aware filtering via `TargetRoleRegistry`, including placeholder substitutions and whitelist logic.
   - Collect detailed metadata for each removal (role, targetId, reason code) for downstream reporting.
2. **Refactor Stage Usage**
   - Replace inline filtering with calls to the pruner.
   - Accumulate pruner outputs into a `StageUpdate` or interim data structure (to be consumed by later tickets) without mutating the original context.
   - Ensure the stage still respects its lenient-mode overrides for forbidden-component validation while the pruner enforces required-component pruning consistently regardless of strictness settings.
3. **Validator Alignment**
   - Review `TargetRequiredComponentsValidator` expectations; adjust to accept already-pruned targets or to leverage pruner metadata to avoid double iteration.
   - Synchronize failure reason strings/codes so both components emit consistent messaging.
4. **Testing**
   - Add unit tests for the pruner covering: full role satisfaction, missing required components, placeholder targets, and verifying that lenient strictness toggles leave pruning results unchanged.
   - Create regression tests that execute the stage with mocked validators to confirm no change in allowed/forbidden actions.

## Validation

- [ ] Pruner unit tests pass and cover edge cases enumerated in the spec.
- [ ] Stage no longer mutates `actionDef.resolvedTargets` or context structures directly during pruning.
- [ ] Validator integration produces identical failure reasons compared to pre-refactor snapshots.
- [ ] Regression tests confirm no behavioral drift in action discovery outcomes.

## Dependencies

- Requires completion of TARCOMVAL-001 (adapter + role registry) to avoid duplicated extraction work.
