# ACTFORSTA-001: Establish Action Formatting Infrastructure Layer

## Summary
Create the foundational modules required to decouple instrumentation, error construction, and result aggregation from `ActionFormattingStage` before moving formatting logic into strategies.

## Tasks
- Add an `ActionFormattingInstrumentation` interface plus `TraceAwareInstrumentation` and `NoopInstrumentation` implementations under `src/actions/pipeline/stages/actionFormatting/` that expose lifecycle hooks (`stageStarted`, `actionStarted`, `actionCompleted`, `actionFailed`, `stageCompleted`).
- Implement a `FormattingAccumulator` utility responsible for tracking per-action successes/failures, collecting formatted commands, and surfacing aggregated statistics consumed by instrumentation and the stage result builder.
- Extract error creation logic into an `ActionFormattingErrorFactory` that wraps the existing `errorContextBuilder` expectations and returns typed errors matching today’s behaviour.
- Mirror existing trace/logging and error payload expectations with unit tests that snapshot lifecycle ordering, captured statistics, and error payload shapes.
- Update dependency wiring (without yet modifying `ActionFormattingStage` behaviour) to allow these components to be instantiated from a central coordinator in future tickets.

## Acceptance Criteria
- New instrumentation, accumulator, and error factory modules exist with comprehensive unit tests covering lifecycle hook invocation, statistics aggregation, and error context data.
- Tests demonstrate parity with the current instrumentation/trace side effects observed in existing `ActionFormattingStage` suites (use spies/mocks as needed).
- No changes to the public behaviour or size of `ActionFormattingStage` yet; all current tests continue to pass.

## Dependencies
- None. This ticket must land before strategy extraction work begins.
