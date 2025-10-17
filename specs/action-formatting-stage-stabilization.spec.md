# ActionFormattingStage Stabilization Specification

**Version**: 2.0  
**Date**: 2025-03-21  
**Status**: Adopted  
**Authors**: AI Assistant

## Executive Summary

`ActionFormattingStage` (`src/actions/pipeline/stages/ActionFormattingStage.js`) now operates as a thin orchestration layer that delegates formatting responsibilities to `ActionFormattingCoordinator`. This document captures the stabilized architecture that emerged from the ACTFORSTA initiatives. The stage focuses on dependency wiring, instrumentation selection, and a single validation hook, while the coordinator and its collaborators own the actionable formatting logic. The refactor eliminates the duplicated helper flows that previously lived in the stage and restores predictable behaviour across traced and non-traced executions.

## Historical Context

Earlier iterations of `ActionFormattingStage` mixed batch-wide heuristics, tracing, fallback construction, and template transformation inside a single 2,000+ line module. Divergent code paths for traced versus non-traced runs made regressions easy to introduce and hard to diagnose. ACTFORSTA-006 introduced `ActionFormattingCoordinator` along with explicit strategies and services; ACTFORSTA-007 completed the cleanup by retiring the legacy helpers and revalidating performance expectations. The resulting architecture keeps the existing stage API while isolating the complex behaviour inside dedicated collaborators.

## Current Architecture

### Stage Responsibilities

The stage is intentionally small and limited to:

- Accepting pipeline dependencies through the constructor and instantiating the collaborators required by the coordinator (strategies, services, factories, and error helpers).
- Choosing the correct instrumentation implementation (`TraceAwareInstrumentation` when `trace.captureActionData` is available, otherwise `NoopInstrumentation`).
- Emitting a single `trace.step` summary before delegating to the coordinator.
- Providing the `#validateVisualProperties` hook that surfaces soft validation warnings without blocking execution.

All formatting, fallback, and statistics logic live outside of the stage. Any new behaviour should be implemented inside the coordinator, a strategy, or one of the dedicated services so the stage remains below the 300 line budget.

### Coordinator Overview

`ActionFormattingCoordinator` receives the pipeline context, the instrumentation adapter selected by the stage, and the collaborators listed below. For each action it:

1. Builds an `ActionFormattingTask` via `ActionFormattingTaskFactory` so strategies receive a consistent payload.
2. Invokes `ActionFormattingDecider.decide` to select the most appropriate strategy while collecting validation failures.
3. Executes the chosen strategy or, when validation fails, invokes the legacy fallback formatter as a safety net.
4. Aggregates successes and failures inside `FormattingAccumulator`, updating instrumentation statistics on completion.

The coordinator is the single entry point for formatting execution and must remain the exclusive location for statistics, structured trace emission, and fallback orchestration.

### Strategies and Services

- **Strategies**: `PerActionMetadataStrategy`, `GlobalMultiTargetStrategy`, and `LegacyStrategy` encapsulate the formatting rules for their respective scenarios. They operate on tasks provided by the coordinator and rely on the shared services below.
- **LegacyFallbackFormatter**: Handles template rewriting and placeholder substitution when modern strategies cannot produce a valid command.
- **TargetNormalizationService**: Normalises target metadata into a canonical structure consumed by the strategies and the fallback formatter.
- **ActionFormattingErrorFactory**: Builds structured error payloads using `ActionErrorContextBuilder`, guaranteeing parity across all formatting flows.
- **FormattingAccumulator**: Tracks success and failure counts, collects formatted commands, and mirrors the telemetry previously emitted by the stage.

### Instrumentation

Two instrumentation adapters maintain compatibility with the existing tracing surface:

- `TraceAwareInstrumentation` mirrors the behaviour of the action-aware structured trace implementation by calling `trace.captureActionData` and `trace.step` at the same lifecycle points as the legacy stage.
- `NoopInstrumentation` provides a lightweight drop-in that preserves statistics and logging calls without depending on tracing APIs.

The stage selects the correct adapter; strategies and the coordinator treat instrumentation as an opaque collaborator.

### Visual Validation Hook

`ActionFormattingStage#validateVisualProperties` performs minimal structural validation on `actionDef.visual`. It warns when the property is missing, malformed, or contains unexpected types for known keys. The hook returns `true` in all cases to preserve the lenient behaviour relied upon by downstream systems while still surfacing actionable diagnostics.

## Dependency Diagram

```
ActionFormattingStage
  └── ActionFormattingCoordinator
        ├── ActionFormattingDecider
        ├── FormattingStrategy[]
        │     ├── PerActionMetadataStrategy
        │     ├── GlobalMultiTargetStrategy
        │     └── LegacyStrategy
        ├── FormattingAccumulator
        ├── LegacyFallbackFormatter
        ├── TargetNormalizationService
        ├── ActionFormattingErrorFactory
        └── ActionFormattingInstrumentation (TraceAware or Noop)
```

## Removed Legacy Helpers

The coordinator now owns the single execution path for formatting. Legacy helper methods that previously lived on the stage—such as bespoke traced/untraced formatting branches and fallback preparation utilities—have been removed. Any future enhancements must integrate with the coordinator abstractions rather than reintroducing stage-level logic.

## Testing & Validation

Stability is verified through the existing automated suites:

- **Unit**
  - `tests/unit/actions/pipeline/stages/ActionFormattingStage.test.js`
  - `tests/unit/actions/pipeline/stages/ActionFormattingStage.coverage.test.js`
  - `tests/unit/actions/pipeline/stages/ActionFormattingStage.adjustClothingBug.test.js`
  - `tests/unit/actions/pipeline/stages/ActionFormattingStage.multiTargetFix.test.js`
  - `tests/unit/actions/pipeline/stages/ActionFormattingStage.visual.test.js`
  - `tests/unit/actions/pipeline/stages/ActionFormattingStage.rubOverClothesFallback.test.js`
  - `tests/unit/actions/formatters/MultiTargetActionFormatter.mixedActionsBug.test.js`
  - `tests/unit/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.test.js`
- **Integration**
  - `tests/integration/actions/ActionFormattingStage.adjustClothingBug.integration.test.js`
  - `tests/integration/actions/pipeline/stages/actionFormattingStage.integration.test.js`
  - `tests/integration/actions/pipeline/ActionFormattingStage.standardPath.integration.test.js`
  - `tests/integration/actions/pipeline/stages/ActionFormattingCoordinator.integration.test.js`
  - `tests/integration/actions/multiTargetActionFormatting.test.js`
  - `tests/integration/actions/multiTargetErrorPropagation.test.js`
  - `tests/integration/actions/pipeline/PipelineResult.integration.test.js`
  - `tests/integration/actions/pipeline/structuredTracePipeline.test.js`
- **Performance**
  - `tests/performance/actions/pipelineStructuredTracePerformance.test.js`

All changes to the formatting pipeline must keep these suites green. Performance regressions are evaluated against the structured trace benchmark to ensure parity with the refactored baseline.

## Operational Guidance

- Treat the stage constructor as the authoritative list of collaborators required by the coordinator. New dependencies should be introduced there and passed straight through.
- Prefer extending or adding strategies when introducing new formatting behaviour. The stage should remain free from branching logic beyond instrumentation selection.
- Keep documentation (README, specs, and debugging guides) aligned with the coordinator-centric architecture to prevent reintroduction of the legacy helper flows.
- When investigating bugs, instrument the coordinator or strategies rather than the stage to maintain the clean separation of concerns established here.

## Future Considerations

- Evaluate whether visual validation warrants a dedicated shared utility if other stages adopt similar semantics.
- Continue monitoring performance and trace payload sizes as new formatting features land; the coordinator centralises these concerns and is the ideal location for optimisations.

