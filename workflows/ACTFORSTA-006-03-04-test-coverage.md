# ACTFORSTA-006-03-04: Update tests for delegated ActionFormattingStage

## Summary
Expand and adjust automated tests so the refactored `ActionFormattingStage` is covered for both traced and untraced
pipelines, verifying it builds `ActionFormattingCoordinator` with the correct instrumentation and dependencies.

## Tasks
- Review existing unit and integration tests around `ActionFormattingStage` and `ActionFormattingCoordinator` to locate
  coverage that validates traced/untraced execution.
- Add or update tests to:
  - Mock `ActionFormattingCoordinator` and assert `executeInternal` constructs it with expected collaborators and
    instrumentation implementations for both trace-aware and noop cases.
  - Confirm `trace.step` or other logging hooks still fire when instrumentation is disabled.
  - Exercise the success and error paths returned by `coordinator.run()` to ensure pipeline results propagate intact.
- Adjust fixtures or helper builders to reflect the new stage shape (e.g., removing dependencies on deleted helper methods).

## Acceptance Criteria
- Automated tests fail if `ActionFormattingStage` stops delegating correctly or omits required collaborators.
- Both traced and untraced scenarios are explicitly asserted.
- Test suite passes locally after updates.
