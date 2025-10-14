# ACTFORSTA-006-02: Route every action through the strategy pipeline

## Objective
Ensure the coordinator always defers to the decider/strategy pipeline for each action, with legacy fallback handled as a final resort.

## Tasks
- Update `ActionFormattingCoordinator.run()` to request a decision from `ActionFormattingDecider` for every action task before execution.
- Execute the selected strategy (per-action metadata, multi-target metadata, or other registered strategies) returned by the decider, passing in the accumulator, context, and helper services the strategy expects.
- When no strategy is returned, call the legacy fallback formatter path that the stage previously executed (`#formatLegacyFallbackTask` behaviour) while ensuring instrumentation and statistics events remain consistent.
- Guarantee sequential execution of tasks so batch ordering is preserved, even when strategies emit asynchronous work.
- Add targeted tests (unit or integration) that cover per-action metadata, multi-target metadata, and legacy-only actions to confirm all paths execute via the coordinator.

## Acceptance Criteria
- Strategy resolution occurs exclusively inside the coordinator; the stage no longer handles decision branches.
- Mixed batches (metadata and legacy entries) are processed without skipping the decider for any action.
- Existing statistics and instrumentation hooks fire once per action regardless of strategy type.
