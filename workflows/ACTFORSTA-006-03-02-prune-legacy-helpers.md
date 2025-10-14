# ACTFORSTA-006-03-02: Keep ActionFormattingStage lean after coordinator migration

## Summary
`ActionFormattingStage` already delegates execution to `ActionFormattingCoordinator`. This workflow ensures the stage
remains a thin wiring layer by removing any lingering references (documentation, mocks, or helper calls) that still
expect the pre-coordinator private helpers.

## Tasks
- Audit `ActionFormattingStage` usage (tests, fixtures, dependency wiring) for references to the removed helper methods
  such as `#executeWithTracing`, `#executeStandard`, or `#formatMultiTargetActions*`, and eliminate or update them.
- Confirm the stage only exposes the `#validateVisualProperties` helper and delegates all other work to the
  coordinator. If additional helpers are reintroduced, justify them or move their logic into the coordinator.
- Remove any constructor state, imports, or mocks that were exclusively supporting the old helper branches and are now
  unused after the coordinator takeover.

## Acceptance Criteria
- No references to the deleted helper methods remain anywhere in the codebase (stage, tests, or mocks).
- `ActionFormattingStage` retains only the wiring required for `ActionFormattingCoordinator`, with
  `#validateVisualProperties` passed through as the lone private helper.
- Linting the modified files reports no unused variables, imports, or class members stemming from the pre-coordinator
  helpers.
