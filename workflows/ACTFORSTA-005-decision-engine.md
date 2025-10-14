# ACTFORSTA-005: Introduce Action Formatting Decider

## Summary
Create the decision engine that evaluates each `ActionFormattingTask` against the available strategies, enforcing per-action decision making and explicit validation before formatting occurs.

## Tasks
- Implement `ActionFormattingDecider` that accepts the list of registered strategies and evaluates each `ActionFormattingTask`, selecting the highest-priority strategy that reports it can handle the task.
- Encode precedence rules so that per-action metadata outranks batch multi-target, which outranks legacy fallback, with configuration allowing future strategies to declare priority.
- Integrate up-front validation to ensure tasks contain required data (e.g., both `resolvedTargets` and `targetDefinitions` for metadata-driven actions) and produce actionable errors via the error factory when inputs are invalid.
- Add unit tests covering strategy selection order, validation failure handling, and scenarios with mixed batches where different strategies are chosen per action.
- Update the existing stage logic (temporarily) to use the decider for action routing without yet removing old formatting methods, ensuring behaviour parity.

## Acceptance Criteria
- `ActionFormattingDecider` can deterministically choose a strategy per action and report validation issues clearly.
- All unit tests for the decider pass, demonstrating correct prioritisation and error propagation.
- Existing `ActionFormattingStage` tests remain green after integrating the decider.

## Dependencies
- Requires **ACTFORSTA-001** (instrumentation/error factory) and **ACTFORSTA-003** (task builder) to provide necessary inputs.
- Depends on **ACTFORSTA-002** and **ACTFORSTA-004** so that strategies are available for selection.
