# ACTFORSTA-003: Build Target Normalization Service & Shared Task Model

## Summary
Create shared data structures that allow each action to be evaluated independently, normalising target information and constructing the per-action task payload consumed by all strategies.

## Tasks
- Define an `ActionFormattingTask` factory that assembles actor, action definition, target contexts, per-action metadata, batch-level targets, and formatter options for each action item processed by the stage.
- Implement `TargetNormalizationService` that accepts both the per-action `resolvedTargets` metadata and legacy batch-level maps, producing a `TargetExtractionResult` via the existing `TargetExtractionResult.fromResolvedParameters` helper **and** the normalized `targetIds`/`params` payloads consumed by `ActionFormattingStage`. The service should detect when it receives an existing `TargetExtractionResult` instance and subsume the current `#extractTargetIds`, `#createTargetExtractionResult`, and `#getPrimaryTargetContext` utilities so the stage can drop those private helpers.
- Ensure the service handles both per-action metadata and batch-scoped target structures, returning clear error objects when required inputs are missing.
- Add unit tests covering legacy, multi-target, and malformed target scenarios to guarantee deterministic outputs and error handling.
- Update existing code paths (temporarily within `ActionFormattingStage` if needed) to use the new normalization service without changing observable behaviour.

## Acceptance Criteria
- `ActionFormattingTask` creation logic exists and produces per-action payloads suitable for strategy evaluation.
- `TargetNormalizationService` replaces the legacy helper functions, with tests demonstrating parity and improved validation.
- Stage behaviour remains unchanged; all current unit and integration suites continue to pass.

## Dependencies
- Depends on **ACTFORSTA-001** for accumulator/error handling scaffolding.
- May proceed in parallel with **ACTFORSTA-002**, but final wiring should coordinate with the legacy strategy implementation.
