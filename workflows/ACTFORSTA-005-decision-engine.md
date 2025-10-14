# ACTFORSTA-005: Introduce Action Formatting Decider

## Summary
Create the decision engine that evaluates each `ActionFormattingTask` against the available strategies, enforcing per-action decision making and explicit validation before formatting occurs.

## Background
- `ActionFormattingStage` still relies on batch-wide heuristics (`some(...)` checks) to choose a single formatting path before iterating, so mixed inputs cannot yet diverge per action. 【F:src/actions/pipeline/stages/ActionFormattingStage.js†L300-L346】
- When the "per-action metadata" branch is taken, the stage builds `ActionFormattingTask` objects but then re-implements the multi-target/legacy decision tree inline instead of delegating to the strategy classes. 【F:src/actions/pipeline/stages/ActionFormattingStage.js†L358-L897】
- The task factory already exposes the metadata flags (`metadata.source`, `metadata.hasPerActionMetadata`, inferred `isMultiTarget`) that the decider should consume when ranking strategies. 【F:src/actions/pipeline/stages/actionFormatting/ActionFormattingTaskFactory.js†L8-L88】
- `PerActionMetadataStrategy` and `GlobalMultiTargetStrategy` exist with `canFormat`/`format` contracts but are not wired into the stage, leaving their precedence undefined. 【F:src/actions/pipeline/stages/actionFormatting/strategies/PerActionMetadataStrategy.js†L63-L344】【F:src/actions/pipeline/stages/actionFormatting/strategies/GlobalMultiTargetStrategy.js†L63-L360】
- Shared infrastructure (`FormattingAccumulator`, `ActionFormattingErrorFactory`, trace-aware instrumentation) is available, yet the stage still calls its private `#createError` helper and manages arrays manually. 【F:src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js†L28-L158】【F:src/actions/pipeline/stages/actionFormatting/ActionFormattingErrorFactory.js†L30-L96】【F:src/actions/pipeline/stages/actionFormatting/TraceAwareInstrumentation.js†L31-L128】【F:src/actions/pipeline/stages/ActionFormattingStage.js†L1413-L1452】

## Tasks
- Implement `ActionFormattingDecider` under `src/actions/pipeline/stages/actionFormatting/ActionFormattingDecider.js`.
  - Accept an ordered collection of strategies that expose the existing `canFormat(task)`/`format({...})` API and provide hooks for future extensions (e.g., optional `priority` metadata or a comparator injected through the constructor). 【F:src/actions/pipeline/stages/actionFormatting/strategies/PerActionMetadataStrategy.js†L98-L344】【F:src/actions/pipeline/stages/actionFormatting/strategies/GlobalMultiTargetStrategy.js†L98-L360】
  - Surface a `decide(task)` (or equivalent) method that returns the selected strategy alongside diagnostic data (e.g., which condition matched) so callers can log or trace the decision.
  - Perform validation before selection: per-action tasks must include `resolvedTargets`, `targetDefinitions`, and an explicit `isMultiTarget`; batch-driven tasks must include the batch fallbacks exposed by the task factory. Produce structured errors through `ActionFormattingErrorFactory` when validation fails. 【F:src/actions/pipeline/stages/actionFormatting/ActionFormattingTaskFactory.js†L54-L87】【F:src/actions/pipeline/stages/actionFormatting/ActionFormattingErrorFactory.js†L49-L95】
  - Provide helpers for recording validation failures so the caller can feed them into the accumulator without duplicating error wiring.
- Encode precedence so that per-action metadata outranks batch multi-target, which outranks legacy fallback. Allow future strategies to declare custom priority without having to rewrite the decider (e.g., by respecting an optional `priority` property or comparator injection). The default ordering should match the currently implemented strategies: `PerActionMetadataStrategy` → `GlobalMultiTargetStrategy` → legacy fallback. 【F:src/actions/pipeline/stages/actionFormatting/strategies/PerActionMetadataStrategy.js†L98-L107】【F:src/actions/pipeline/stages/actionFormatting/strategies/GlobalMultiTargetStrategy.js†L98-L113】
- Update `ActionFormattingStage` to use the decider for per-action routing while keeping the existing helper methods in place for parity.
  - Instantiate `PerActionMetadataStrategy` and `GlobalMultiTargetStrategy` alongside the existing legacy dependencies, wiring through the same formatter, entity manager, dispatcher, fallback formatter, and normalization service instances. 【F:src/actions/pipeline/stages/ActionFormattingStage.js†L26-L123】【F:src/actions/pipeline/stages/actionFormatting/strategies/PerActionMetadataStrategy.js†L73-L91】【F:src/actions/pipeline/stages/actionFormatting/strategies/GlobalMultiTargetStrategy.js†L73-L91】
  - Construct a single `FormattingAccumulator` per execution and pass it, together with a bound `createError` callback backed by `ActionFormattingErrorFactory`, into strategies selected by the decider. Preserve the current `PipelineResult` shape by materialising it from the accumulator outputs. 【F:src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js†L28-L158】【F:src/actions/pipeline/stages/actionFormatting/ActionFormattingErrorFactory.js†L30-L96】
  - For actions that the decider cannot match to a strategy, continue to flow through the existing legacy helpers (`#formatMultiTargetActions*`, `#formatLegacyAction`, `LegacyStrategy.format`) so behaviour remains identical until the coordinator lands. 【F:src/actions/pipeline/stages/ActionFormattingStage.js†L320-L346】【F:src/actions/pipeline/stages/ActionFormattingStage.js†L670-L1180】【F:src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js†L26-L210】
  - Ensure both traced and untraced paths share the same decision logic so instrumentation can be swapped in later without duplicating code.
- Add unit tests covering:
  - Strategy selection order (per-action beats batch beats legacy) and validation error reporting in isolation within the decider.
  - Mixed batches that trigger different strategies per action, exercising both traced and non-traced execution paths to confirm accumulator totals and error propagation remain stable.
  - Regression checks that existing `ActionFormattingStage` suites (`visual`, `rubOverClothesFallback`, `multiTargetFix`, etc.) still pass without fixture updates.

## Acceptance Criteria
- `ActionFormattingDecider` deterministically chooses a strategy per task, surfaces validation issues via the error factory, and allows future strategies to participate without code churn.
- `ActionFormattingStage` delegates per-action routing to the decider while continuing to produce the same results and traces, including legacy fallbacks for unmatched tasks.
- All unit tests for the decider and affected stage paths pass, demonstrating correct prioritisation, validation, and parity with the previous behaviour.

## Dependencies
- Requires **ACTFORSTA-001** (instrumentation/error factory) and **ACTFORSTA-003** (task builder) to provide necessary inputs.
- Depends on **ACTFORSTA-002** and **ACTFORSTA-004** so that strategies and shared services are available for selection.
