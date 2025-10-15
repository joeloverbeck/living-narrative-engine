# TARCOMVAL-006: Final Cleanup and Documentation Alignment

**Phase:** TargetComponentValidation Hardening - Phase 6 (Stabilization)
**Priority:** Medium
**Estimated Effort:** 3 days

## Goal

Complete the hardening initiative by removing dead code, consolidating role utilities, updating specs/documentation, and ensuring all stakeholders understand the new collaborator architecture.

## Context

After extraction of the adapter, pruner, reporter, and emitter, remaining technical debt includes redundant role arrays, outdated inline comments, and missing documentation for the new contracts. The spec calls for cleanup and documentation updates so future contributors can extend the pipeline confidently.【F:specs/target-component-validation-stage-hardening.spec.md†L171-L210】 This ticket wraps up the initiative.

## Deliverables

1. Removal of legacy role array definitions and replacement with `TargetRoleRegistry` imports across validators and related modules.
2. Updated documentation in `specs/` (and potentially `docs/architecture` if present) detailing the new data flow and collaborators.
3. Dependency validation updates (e.g., DI container, module exports) to expose the new services where needed.
4. Final code hygiene: delete unused private methods, ensure JSDoc coverage, and align naming conventions.
5. Communication artifacts (summary changelog or ADR update) for the action discovery team.

## Tasks

1. **Role Registry Adoption**
   - Replace any remaining hard-coded role arrays or placeholder logic in validators or helpers with registry references.
   - Ensure validators export/consume registry constants where applicable.
2. **Documentation Refresh**
   - Update `specs/target-component-validation-stage-hardening.spec.md` (or add companion document) to reflect implementation details and lessons learned.
   - Document `TargetValidationIOAdapter`, `TargetCandidatePruner`, `TargetValidationReporter`, and `ContextUpdateEmitter` responsibilities.
3. **Dependency Surface Review**
   - Verify DI container or module exports expose new collaborators for testing and production.
   - Add dependency validation checks if required to prevent accidental removal.
4. **Code Hygiene**
   - Remove obsolete private methods within `TargetComponentValidationStage` and related modules.
   - Ensure all new modules include required JSDoc annotations and lint rules are satisfied.
5. **Stakeholder Communication**
   - Prepare a short summary or ADR update outlining behavioral parity, new extension points, and migration guidance for future stage refactors.

## Validation

- [ ] All role definitions sourced from `TargetRoleRegistry`.
- [ ] Documentation/spec updates merged and reviewed.
- [ ] No unused legacy methods remain in the stage module.
- [ ] Linting and documentation checks pass.
- [ ] Stakeholders acknowledge receipt of final summary.

## Dependencies

- Requires completion of TARCOMVAL-001 through TARCOMVAL-005.
