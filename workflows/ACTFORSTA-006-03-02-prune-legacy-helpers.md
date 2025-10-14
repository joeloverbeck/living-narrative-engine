# ACTFORSTA-006-03-02: Remove legacy helper branches from ActionFormattingStage

## Summary
Eliminate the private helper methods and state in `ActionFormattingStage` that are no longer needed once the coordinator
handles orchestration, keeping only the dependencies that must be constructed for delegation.

## Tasks
- Identify private methods within `ActionFormattingStage` that were exclusively used by the old traced/untraced flows
  (`#executeWithTracing`, `#executeStandard`, `#formatActionsWithDecider`, both `#formatMultiTargetActions*`,
  `#formatLegacyFallbackTask`, and normalization/error helpers).
- Remove these helpers and inline any residual logic that still needs to be exposed to the coordinator (e.g.,
  pass `#validateVisualProperties` directly as a function reference).
- Audit constructor state and class properties, deleting anything that no longer has references after helper removal.
- Update imports or mocks impacted by the removed helpers to prevent dead code or lint errors.

## Acceptance Criteria
- `ActionFormattingStage` contains no unused helper methods or state tied to the pre-delegation orchestration.
- Source control history shows all obsolete private methods removed and no remaining references compile.
- Linting the modified file does not report unused variables, imports, or class members related to the legacy helpers.
