# TARCOMVAL-006: Final Cleanup and Documentation Alignment

**Phase:** TargetComponentValidation Hardening - Phase 6 (Stabilization)
**Priority:** Medium
**Estimated Effort:** 3 days

## Goal

Complete the hardening initiative by removing dead code, consolidating role utilities, updating specs/documentation, and ensuring all stakeholders understand the new collaborator architecture.

## Context

After extraction of the adapter, pruner, reporter, and emitter, remaining technical debt includes redundant role arrays, outdated inline comments, and missing documentation for the new contracts. The spec calls for cleanup and documentation updates so future contributors can extend the pipeline confidently.【F:specs/target-component-validation-stage-hardening.spec.md†L120-L138】 This ticket wraps up the initiative.

## Deliverables

1. Replace the remaining hard-coded target role arrays (e.g., the `['primary', 'secondary', 'tertiary']` lists that still live in `TargetComponentValidator`, `TargetRequiredComponentsValidator`, `commandProcessor`, `entityRefUtils`, and `multiTargetValidationUtils`) with imports from `TargetRoleRegistry` so future role additions stay centralized.【F:src/actions/validation/TargetComponentValidator.js†L187-L210】【F:src/actions/validation/TargetRequiredComponentsValidator.js†L73-L85】【F:src/commands/commandProcessor.js†L532-L559】【F:src/utils/entityRefUtils.js†L53-L156】【F:src/utils/multiTargetValidationUtils.js†L56-L79】
2. Extend the spec and developer documentation to describe the finalized collaborator flow—update the hardening spec and pair it with guidance alongside the IO adapter write-up (e.g., within `specs/` or `docs/development/`) so engineers understand how the adapter, pruner, reporter, and emitter interact.【F:specs/target-component-validation-stage-hardening.spec.md†L120-L138】【F:specs/target-validation-io-adapter.md†L1-L32】
3. Tighten the dependency surface so the new collaborators can be injected or overridden: audit how `ActionPipelineOrchestrator` constructs the validation stage and how the stage currently `new`s its collaborators, updating DI/service registrations or exports as needed.【F:src/actions/actionPipelineOrchestrator.js†L158-L174】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L99-L158】
4. Final code hygiene across the validation stack: clear stale comments, align logging/metadata naming, and confirm the stage/emitter/adapter files carry the expected JSDoc coverage after the previous extractions.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L234-L615】【F:src/actions/pipeline/services/implementations/ContextUpdateEmitter.js†L41-L194】【F:src/actions/pipeline/adapters/TargetValidationIOAdapter.js†L65-L214】
5. Communication artifacts (summary changelog or ADR update) for the action discovery team.

## Tasks

1. **Role Registry Adoption**
   - Swap the validator loops in `TargetComponentValidator` and `TargetRequiredComponentsValidator` to iterate via `TargetRoleRegistry` exports instead of inline arrays.【F:src/actions/validation/TargetComponentValidator.js†L187-L210】【F:src/actions/validation/TargetRequiredComponentsValidator.js†L73-L85】
   - Update helper utilities (`commandProcessor`, `entityRefUtils`, `multiTargetValidationUtils`) to reference the registry constants so placeholder detection stays consistent with the pipeline.【F:src/commands/commandProcessor.js†L532-L559】【F:src/utils/entityRefUtils.js†L53-L156】【F:src/utils/multiTargetValidationUtils.js†L56-L79】
2. **Documentation Refresh**
   - Expand `specs/target-component-validation-stage-hardening.spec.md` to capture the stabilization outcomes and link to the supporting collaborators.【F:specs/target-component-validation-stage-hardening.spec.md†L120-L138】
   - Either extend `specs/target-validation-io-adapter.md` or add a sibling document under `docs/development/` that summarizes `TargetValidationIOAdapter`, `TargetCandidatePruner`, `TargetValidationReporter`, and `ContextUpdateEmitter` responsibilities for onboarding purposes.【F:specs/target-validation-io-adapter.md†L1-L32】
3. **Dependency Surface Review**
   - Determine where the orchestrator or DI container should supply the pruner, config provider, reporter, and emitter instead of relying on the stage’s fallback constructors, and register the necessary tokens/exports.【F:src/actions/actionPipelineOrchestrator.js†L158-L174】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L99-L158】
   - Ensure the dependency guards remain in place (or add new ones) so downstream refactors can detect when a collaborator is missing or misconfigured.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L99-L155】
4. **Code Hygiene**
   - Review the validation execution flow, emitter, and adapter for stale comments, redundant cloning, or inconsistent metadata naming left over from earlier phases, cleaning them up while keeping tests green.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L234-L615】【F:src/actions/pipeline/services/implementations/ContextUpdateEmitter.js†L41-L194】【F:src/actions/pipeline/adapters/TargetValidationIOAdapter.js†L174-L289】
   - Confirm each collaborator maintains the required JSDoc blocks after the cleanup so lint/type checks remain satisfied.【F:src/actions/pipeline/services/implementations/ContextUpdateEmitter.js†L1-L40】【F:src/actions/pipeline/stages/TargetValidationReporter.js†L1-L64】
5. **Stakeholder Communication**
   - Prepare a short summary or ADR update outlining behavioral parity, new extension points, and migration guidance for future stage refactors.

## Validation

- [ ] All role definitions sourced from `TargetRoleRegistry`.
- [ ] Documentation/spec updates merged and reviewed.
- [ ] Action pipeline wiring exposes the pruner/config provider/reporter/emitter through DI or module exports rather than relying solely on stage fallbacks.【F:src/actions/actionPipelineOrchestrator.js†L158-L174】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L99-L158】
- [ ] Linting and documentation checks pass.
- [ ] Stakeholders acknowledge receipt of final summary.

## Dependencies

- Requires completion of TARCOMVAL-001 through TARCOMVAL-005.
