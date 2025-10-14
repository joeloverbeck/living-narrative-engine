# ACTFORSTA-006: Wire ActionFormattingCoordinator and Update Stage

## Current State
- `ActionFormattingStage` already instantiates `ActionFormattingDecider`, `PerActionMetadataStrategy`, `GlobalMultiTargetStrategy`, `LegacyStrategy`, and the various helper services (`FormattingAccumulator`, `ActionFormattingErrorFactory`, `LegacyFallbackFormatter`, `TargetNormalizationService`).
- The stage only routes actions through the decider when **any** action in the batch exposes per-action metadata. When the batch relies on multi-target batch metadata or pure legacy formatting, the stage still executes the old traced/untraced helpers (`#formatMultiTargetActions*`, `#formatLegacyFallbackTask`, etc.).
- `TraceAwareInstrumentation` and `NoopInstrumentation` exist, but they are orchestrated directly from the stage instead of via a coordinator.
- There is no `ActionFormattingCoordinator` module yet; the stage remains the monolithic orchestrator for tracing, statistics, and fallback handling.

## Summary
Extract the shared orchestration logic into a new `ActionFormattingCoordinator` so every execution path (per-action metadata, batch multi-target, legacy fallback) flows through the same code path. The stage should shrink to wiring dependencies and delegating to the coordinator regardless of trace capabilities.

## Tasks
- Implement `ActionFormattingCoordinator` in `src/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.js`. It should:
  - Accept the pipeline context, instrumentation adapter, decider, strategies array, and helper services (accumulator factory, error factory, fallback formatter, target normalisation, etc.).
  - Create per-action tasks via the existing `createActionFormattingTask` helper and run them sequentially.
  - Use the decider outcome for **every** task. When no strategy matches, delegate to the legacy fallback behaviour (today handled by `#formatLegacyFallbackTask`).
  - Drive instrumentation hooks (`stageStarted`, `actionStarted`, `actionCompleted`, `actionFailed`, `stageCompleted`) and statistics updates in one place.
- Update `ActionFormattingStage.executeInternal` to:
  - Instantiate the correct instrumentation (`TraceAwareInstrumentation` or `NoopInstrumentation`).
  - Build the coordinator with the existing strategies and helper services and delegate execution to it.
  - Remove the bespoke traced/untraced branches (`#executeWithTracing`, `#executeStandard`, `#formatMultiTargetActions*`, `#formatLegacyFallbackTask`, etc.) in favour of the coordinator.
  - Preserve the public interface, logging, and safe event dispatch side effects expected by downstream stages.
- Ensure the coordinator path handles batches that mix per-action metadata and legacy entries without falling back to stage-level heuristics. All actions must be processed independently via the decider/strategy pipeline.
- Keep instrumentation output, trace payloads, and error reporting compatible with the existing expectations so that regression suites continue to pass unchanged.

## Acceptance Criteria
- `ActionFormattingStage` becomes a thin adapter (<300 lines) that wires dependencies and invokes the coordinator.
- Traced and untraced executions share the same coordinator-driven flow while still emitting the existing trace/telemetry payloads.
- Multi-target and legacy formatting go through strategies selected by the decider instead of bespoke stage branches.
- All existing unit, integration, and performance suites that cover `ActionFormattingStage` continue to pass without modification.
- Backwards-compatible trace behaviour is verified against current fixtures and snapshot expectations.

## Dependencies
- Requires completion of **ACTFORSTA-001** through **ACTFORSTA-005** to supply coordinator dependencies.
