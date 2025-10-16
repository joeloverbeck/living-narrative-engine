# Action Discovery Target Validation Stabilization Summary

## Audience

Action discovery engineers, gameplay designers integrating new target roles, and
QA partners validating multi-target behaviours.

## Highlights

- **Centralized Role Definitions** – All validators and utilities reference
  `TargetRoleRegistry`. Adding a new role now requires touching the registry and
  relevant content data only.
- **Configurable Collaborators** – `ActionPipelineOrchestrator` accepts injected
  implementations for the pruner, config provider, reporter, and context update
  emitter. This allows experimentation with alternative validation strategies
  without editing the stage source.
- **Documented Flow** – The collaborator guide in `docs/development/` outlines
  how the adapter, pruner, validators, reporter, and emitter cooperate across
  normalization, evaluation, and rebuild phases.

## Behavioural Parity

- Legacy single-target actions still resolve through `target_entity` and
  flattened `targetId` fields. The validator stack continues to short-circuit on
  forbidden component hits while logging per-role reasons.
- Multi-target actions maintain ordering and placeholder metadata; pruning only
  removes candidates that fail explicit required component checks.
- Trace payloads, performance metrics, and context updates mirror the structure
  introduced in earlier hardening phases.

## Extension Guidance

1. **Adding New Roles**
   - Update `TargetRoleRegistry` and provide placeholder definitions where
     applicable. Validators automatically include the new role in iteration.
2. **Custom Strictness Logic**
   - Extend or replace the injected `TargetValidationConfigProvider` to surface
     alternative `shouldSkipAction` predicates (e.g., mod-specific toggles).
3. **Alternate Reporting Pipelines**
   - Substitute a bespoke reporter to stream validation metrics into external
     observability tools while retaining the stage contract.

## Next Steps

- Monitor performance metrics using the existing benchmark harness (`npm run
test:performance`).
- Schedule a knowledge-share session to walk through the collaborator guide and
  capture feedback for future automation.

_Prepared for distribution via the action discovery channel on 2025-03-02._
