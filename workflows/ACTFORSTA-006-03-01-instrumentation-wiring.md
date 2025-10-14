# ACTFORSTA-006-03-01: Wire ActionFormattingStage delegation to the coordinator

## Summary
Rework `ActionFormattingStage#executeInternal` so it stops running bespoke traced/untraced flows and instead instantiates
`ActionFormattingCoordinator` with the correct collaborators before delegating execution.

## Tasks
- Inspect `ActionFormattingStage` to confirm all collaborators currently constructed or passed into `executeInternal`, including
  instrumentation selection, decider, strategies, command formatter, accumulator factory, legacy fallback formatter,
  target normalization service, entity manager, safe dispatcher, entity display name resolver, logger, and visual validation helper.
- Update `executeInternal` to:
  - Detect the appropriate instrumentation implementation based on whether the incoming pipeline `trace` supports
    `trace.captureActionData` / `trace.step` semantics.
  - Instantiate `ActionFormattingCoordinator` with the pipeline context, instrumentation, and all required collaborators,
    ensuring the accumulator factory is passed as a thunk (`() => new FormattingAccumulator()`).
  - Delegate execution via `coordinator.run()` and return the resulting `PipelineResult`, preserving existing trace logging that
    must occur outside instrumentation.
- Confirm any stage-level side effects (e.g., logging or trace steps) remain intact after delegation.

## Acceptance Criteria
- `executeInternal` contains only instrumentation selection, coordinator instantiation, and delegation logic.
- Coordinator receives the expected collaborators and returns the same `PipelineResult` semantics as before.
- Manual inspection shows no remaining bespoke traced/untraced branches inside the stage.
