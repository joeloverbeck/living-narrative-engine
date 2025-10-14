# ACTFORSTA-006-01: Establish ActionFormattingCoordinator module

## Objective
Create the initial `ActionFormattingCoordinator` implementation that centralises orchestration for action formatting while remaining API-compatible with the existing stage dependencies.

## Tasks
- Add `ActionFormattingCoordinator.js` under `src/actions/pipeline/stages/actionFormatting/` with a constructor that accepts the full set of collaborators currently instantiated inside `ActionFormattingStage` (pipeline context, instrumentation adapter, decider, strategies, accumulator factory, error factory, fallback formatter, target normalization service, and statistics helpers).
- Port the instrumentation lifecycle triggers (`stageStarted`, `stageCompleted`, `actionStarted`, `actionCompleted`, `actionFailed`) from the stage into coordinator methods, ensuring the coordinator emits identical payload shapes.
- Introduce a `run()` entry point that accepts the batch of actions and invokes `createActionFormattingTask` for each action, executing tasks sequentially using the provided instrumentation hooks.
- Preserve existing error propagation semantics: failed tasks must surface via thrown errors after recording instrumentation failure events.

## Acceptance Criteria
- Coordinator module exposes a default export/class or factory consistent with neighbouring pipeline modules and is fully covered by unit tests mirroring current instrumentation expectations.
- No behavioural divergence in instrumentation payloads compared to current `ActionFormattingStage` logging.
- Coordinator `run()` accepts the same inputs the stage currently processes and delegates task creation without modifying strategy selection logic yet.

## Dependencies
- Requires availability of helpers and factories introduced in ACTFORSTA-001 through ACTFORSTA-005.
