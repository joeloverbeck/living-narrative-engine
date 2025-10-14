# ACTFORSTA-006-02: Route every action through the strategy pipeline

## Current State
- `ActionFormattingCoordinator.run()` already iterates over each `ActionFormattingTask`, calls `ActionFormattingDecider.decide()` for every task, and executes the selected strategy or the legacy formatter fallback as appropriate.
- Sequential execution is preserved via a `for...of` loop with `await`, so asynchronous work emitted by strategies keeps batch ordering intact.
- Instrumentation hooks (`stageStarted`, `actionStarted`, `actionCompleted`, `actionFailed`, `stageCompleted`) and accumulator/statistics updates mirror the behaviour previously implemented directly inside `ActionFormattingStage`.
- Unit coverage exists in `tests/unit/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.test.js` for per-action strategy execution and legacy fallback handling, confirming instrumentation, accumulator updates, and decider delegation.
- `ActionFormattingStage` still contains legacy orchestration logic; delegating to the coordinator is tracked separately in **ACTFORSTA-006-03**.

## Objective
Validate and harden the coordinator-centric strategy pipeline now that the implementation exists, ensuring it remains the single source of truth for decision routing and fallback handling.

## Tasks
- Review the coordinator implementation for any drift from stage parity (decision metadata propagation, validation failure handling, accumulator usage) and adjust as needed to keep behaviour aligned.
- Extend or update unit tests to cover multi-target metadata routing (e.g., ensuring strategies receive normalized targets and emit `actionCompleted` payloads) in addition to the existing per-action and legacy-only scenarios.
- Confirm validation failures coming from `ActionFormattingDecider` are surfaced through the accumulator and instrumentation once per action and add regression coverage if gaps are discovered.
- Document in commit or PR notes any intentional deviations from the original stage behaviour so downstream tasks (particularly ACTFORSTA-006-03) can rely on the coordinator contract.

## Acceptance Criteria
- Coordinator remains responsible for calling the decider for every action and executing either the chosen strategy or the legacy fallback while emitting the expected instrumentation payloads.
- Mixed batches (metadata-driven and legacy entries) are processed entirely through the coordinator without skipping the decider for any action.
- Validation failures from the decider are collected in the accumulator exactly once per action and reflected in statistics/instrumentation, with automated tests covering both success and failure flows.
