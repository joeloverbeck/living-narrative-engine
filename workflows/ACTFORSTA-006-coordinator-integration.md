# ACTFORSTA-006: Wire ActionFormattingCoordinator and Update Stage

## Summary
Replace the monolithic internals of `ActionFormattingStage` with a streamlined coordinator that orchestrates task construction, decision making, strategy execution, and instrumentation.

## Tasks
- Implement `ActionFormattingCoordinator` that accepts the pipeline context, instrumentation adapter, decider, strategies, and helper services, executing actions sequentially while collecting results via the accumulator.
- Update `ActionFormattingStage.executeInternal` (and related entry points) to instantiate the coordinator, instrumentation, and helper services, delegating formatting work to the coordinator while preserving the public interface (`PipelineResult`, logging, safe event dispatch options).
- Ensure per-action processing is independent, avoiding batch-wide heuristics, and leverage the decider to choose the correct strategy for each task.
- Maintain backwards-compatible trace behaviour, ensuring traced and untraced executions use the same coordinator path.
- Add integration tests or extend existing ones to validate that the coordinator-driven stage still satisfies all regression suites listed in the specification.

## Acceptance Criteria
- `ActionFormattingStage` shrinks to a thin orchestration layer (<300 lines) delegating work to `ActionFormattingCoordinator`.
- All existing unit, integration, and performance suites targeting `ActionFormattingStage` pass without modification.
- Tracing behaviour (including structured trace snapshots) remains unchanged when compared against baseline fixtures.

## Dependencies
- Requires completion of **ACTFORSTA-001** through **ACTFORSTA-005** to supply coordinator dependencies.
