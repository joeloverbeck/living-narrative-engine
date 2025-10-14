# ACTFORSTA-006-03-04: Update tests for delegated ActionFormattingStage

## Summary
Keep the automated tests aligned with the refactored `ActionFormattingStage` so both traced and untraced pipelines
verify that it builds `ActionFormattingCoordinator` with the correct instrumentation and dependencies that now exist
in the codebase.

## Tasks
- Review existing unit and integration tests around `ActionFormattingStage` and `ActionFormattingCoordinator` to locate
  coverage that validates traced/untraced execution.
- Add or update tests to:
  - Mock `ActionFormattingCoordinator` and assert `executeInternal` constructs it with expected collaborators and
    instrumentation implementations for both trace-aware and noop cases (reflecting the current constructor wiring).
  - Confirm `trace.step` is still invoked when a trace object is provided even if instrumentation falls back to the noop
    implementation (there is no trace logging when no trace object is supplied).
  - Exercise the success path returned by `coordinator.run()` and ensure promise rejections from the coordinator bubble
    through `executeInternal`, since the coordinator does not currently surface a separate error `PipelineResult`.
- Adjust fixtures or helper builders to reflect the new stage shape (e.g., removing dependencies on deleted helper methods).

## Acceptance Criteria
- Automated tests fail if `ActionFormattingStage` stops delegating correctly or omits required collaborators.
- Both traced and untraced scenarios are explicitly asserted (with and without action-aware capture support).
- Test suite passes locally after updates.
