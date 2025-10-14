# ActionFormattingStage Stabilization Specification

**Version**: 1.0
**Date**: 2025-02-14
**Status**: Draft
**Authors**: AI Assistant

## Executive Summary

`ActionFormattingStage` (`src/actions/pipeline/stages/ActionFormattingStage.js`) has grown into a 2,100+ line monolith that mixes
formatting heuristics, fallback translation, instrumentation, validation, and error construction. Stage-level heuristics decide a
single execution path for every action in a batch, so touching one path routinely impacts unrelated actions (e.g., the
`adjust_clothing` regressions captured in the existing bug suites). This specification proposes a refactor that isolates decision
making and formatting logic per action, introduces strategy objects for the different formatting modes, and extracts telemetry and
fallback helpers into dedicated modules. The goal is to make the stage extensible and predictable while preserving all observable
behaviour verified by the current unit, integration, and performance tests.

## Problem Statement

### Observed Brittleness

1. **Batch-scoped heuristics** – `executeInternal` selects a single path (`per-action metadata`, `multi-target`, or `legacy`) for the
entire batch. Mixed batches force all actions through the same path, which is the root cause of the mixed-action regressions and
fallback bugs reproduced in `ActionFormattingStage.adjustClothingBug.*` tests.
2. **Duplicated execution flows** – Every path has two copies (`#format*Traced` vs. `#format*`) that must stay in sync. Behavioural
changes regularly land in only one branch and silently break action-aware traces (`ActionFormattingStage - Action Tracing Integration`).
3. **Entangled fallback construction** – Legacy fallback helpers (`#prepareLegacyFallback`, `#formatWithLegacyFallback`,
`#transformTemplateForLegacyFallback`, `#extractTargetsFromContexts`) live inside the stage, mixing template rewriting, context
sanitisation, and error mapping with orchestration logic.
4. **Implicit data contracts** – Formatting expects loosely typed structures (resolved targets, target definitions, per-action metadata).
Validations are scattered, increasing the chance of null/undefined issues and double-formatting errors.
5. **Instrumentation leakage** – Trace capture, logging, and statistics code is interwoven with formatting loops, making it difficult to
reason about ordering and to add new telemetry fields without risking behaviour changes.

### Goals

- Per-action decision making so one action’s metadata cannot change how other actions are formatted.
- Explicit, testable strategy objects for each formatting mode (per-action metadata, global multi-target, legacy fallback).
- Reusable helpers for legacy fallbacks, target extraction, error construction, and visual validation.
- Unified instrumentation adapter that can be toggled based on trace capabilities, eliminating traced/untraced method duplication.
- Preserve the external interface (`PipelineResult`, logging side effects, safe event dispatch options) to maintain compatibility with
pipeline orchestration and downstream consumers.

### Non-Goals

- Changing the `PipelineStage` contract or modifying other stages in the pipeline.
- Rewriting `IActionCommandFormatter` implementations (only the stage integration is in scope).
- Altering test data or broadening validation semantics beyond what current tests assert.

## Proposed Architecture

### 1. Stage Simplification

- Keep `ActionFormattingStage` as the public pipeline stage but reduce it to dependency wiring, trace capability detection, and
hand-off to a new `ActionFormattingCoordinator` (working name) located in
`src/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.js`.
- The coordinator accepts the pipeline context plus an `InstrumentationAdapter` instance (see below) and returns a
`PipelineResult`.

### 2. Explicit Formatting Strategies

Introduce a lightweight strategy interface:

```javascript
class FormattingStrategy {
  canFormat(actionTask);
  async format(actionTask, instrumentation, accumulator);
}
```

- **PerActionMetadataStrategy** – Handles actions that carry `resolvedTargets`, `targetDefinitions`, and `isMultiTarget` on each
`actionsWithTargets` entry. It invokes `commandFormatter.formatMultiTarget` when available and manages per-command fallbacks.
- **GlobalMultiTargetStrategy** – Processes actions when the stage receives batch-level `resolvedTargets`/`targetDefinitions` but
individual entries are legacy. It encapsulates the logic currently in `#formatMultiTargetActions*`.
- **LegacyStrategy** – Formats single-target actions via `commandFormatter.format`. It accepts injected helpers for target extraction
and legacy template preparation.

All strategies share a common `ActionFormattingTask` structure created per action:

```javascript
{
  actor,
  actionDef,
  targetContexts,
  perActionMetadata,
  batchResolvedTargets,
  batchTargetDefinitions,
  formatterOptions,
}
```

Strategies push results/errors into a shared `FormattingAccumulator` that owns success/failure statistics and provides helpers to
append formatted actions.

### 3. Decision Engine

- Replace the stage-level `some(...)` checks with an `ActionFormattingDecider` that evaluates each `ActionFormattingTask` against the
registered strategies. Strategies advertise priority/precedence so per-action metadata outranks batch multi-target, which outranks
legacy fallback.
- The decider also performs up-front validation (e.g., verifying per-action metadata has both `resolvedTargets` and
`targetDefinitions`) and normalises data by instantiating `TargetExtractionResult` objects where appropriate.

### 4. Instrumentation Adapter

- Create `ActionFormattingInstrumentation` to abstract trace, logging, and performance measurement. It exposes methods such as
`stageStarted`, `actionStarted`, `actionCompleted`, `actionFailed`, and `stageCompleted`.
- Provide two implementations:
  - `TraceAwareInstrumentation` – Wraps action-aware traces, collecting the current statistics and calling
    `trace.captureActionData`/`trace.step` exactly once per lifecycle event.
  - `NoopInstrumentation` – Minimal logging-only implementation used when traces are absent or not action-aware.
- Strategies call the instrumentation hooks but stay agnostic to trace capabilities. The coordinator updates statistics centrally and
feeds them back to the instrumentation on completion.

### 5. Legacy Fallback Service

- Extract legacy fallback helpers into `LegacyFallbackFormatter` that exposes:
  - `prepareFallback(actionDef, targetContext, targetDefinitions, resolvedTargets)`
  - `formatWithFallback(actionDef, targetContext, formatterOptions)`
- The service encapsulates template transformation, placeholder substitution, and context sanitisation. It returns a
`FormatActionCommandResult` or a typed error, enabling strategies to maintain cleaner flow control.

### 6. Target Data Normalisation

- Introduce `TargetNormalizationService` that converts arrays of `targetContexts` or resolved target maps into `TargetExtractionResult`
and consistent `{ targetIds, params }` payloads. The helper will replace `#extractTargetIds`, `#createTargetExtractionResult`, and
`#extractTargetsFromContexts` with a single tested utility.
- Share the helper across strategies to avoid divergence between traced/untraced paths.

### 7. Error Construction & Visual Validation

- Extract `ActionFormattingErrorFactory` responsible for translating formatter failures into calls to
`errorContextBuilder.buildErrorContext`, ensuring the same logic is used regardless of strategy.
- Move `#validateVisualProperties` into `ActionVisualValidator` so validation occurs once per action before formatting begins.

### 8. Dependency Diagram

```
ActionFormattingStage
  └── ActionFormattingCoordinator
        ├── ActionFormattingDecider
        ├── FormattingStrategy[]
        │     ├── PerActionMetadataStrategy
        │     ├── GlobalMultiTargetStrategy
        │     └── LegacyStrategy
        ├── LegacyFallbackFormatter
        ├── TargetNormalizationService
        ├── ActionFormattingErrorFactory
        └── ActionFormattingInstrumentation (TraceAware or Noop)
```

## Incremental Implementation Plan

1. **Introduce Infrastructure** – Add the instrumentation adapter, accumulator, and error factory with unit tests mirroring the
current behaviour (including statistics aggregation and error context contents).
2. **Port Legacy Strategy** – Move existing legacy formatting logic into `LegacyStrategy` + `LegacyFallbackFormatter`, guarded by tests
that mirror `ActionFormattingStage.visual`, `.rubOverClothesFallback`, and the legacy scenarios in
`ActionFormattingStage.test.js`.
3. **Port Multi-Target Strategies** – Implement `PerActionMetadataStrategy` and `GlobalMultiTargetStrategy`, reusing
`TargetNormalizationService`. Validate with the suites covering per-action metadata, multi-target fallbacks, and error propagation.
4. **Wire Coordinator** – Replace the internal methods in `ActionFormattingStage` with coordinator orchestration. Ensure the stage
retains the same constructor signature and returns `PipelineResult` exactly as before.
5. **Remove Dead Code** – Delete the old `#format*` and helper methods once the coordinator is in place and all tests pass.

Throughout the migration, maintain the exported class name and method signatures so callers (including mocks in orchestrator tests)
remain unchanged.

## Testing & Validation

All existing tests that exercise `ActionFormattingStage` must continue to pass without modification. This includes, at minimum:

- **Unit suites**:
  - `tests/unit/actions/pipeline/stages/ActionFormattingStage.test.js`
  - `tests/unit/actions/pipeline/stages/ActionFormattingStage.coverage.test.js`
  - `tests/unit/actions/pipeline/stages/ActionFormattingStage.adjustClothingBug.test.js`
  - `tests/unit/actions/pipeline/stages/ActionFormattingStage.multiTargetFix.test.js`
  - `tests/unit/actions/pipeline/stages/ActionFormattingStage.visual.test.js`
  - `tests/unit/actions/pipeline/stages/ActionFormattingStage.rubOverClothesFallback.test.js`
  - `tests/unit/actions/formatters/MultiTargetActionFormatter.mixedActionsBug.test.js`
- **Integration suites**:
  - `tests/integration/actions/ActionFormattingStage.adjustClothingBug.integration.test.js`
  - `tests/integration/actions/pipeline/stages/actionFormattingStage.integration.test.js`
  - `tests/integration/actions/pipeline/ActionFormattingStage.standardPath.integration.test.js`
  - `tests/integration/actions/pipeline/actionFormattingStageIntegration.test.js`
  - `tests/integration/actions/multiTargetActionFormatting.test.js`
  - `tests/integration/actions/multiTargetErrorPropagation.test.js`
  - `tests/integration/actions/pipeline/PipelineResult.integration.test.js`
  - `tests/integration/actions/pipeline/structuredTracePipeline.test.js`
- **Performance regression guard**:
  - `tests/performance/actions/pipelineStructuredTracePerformance.test.js`

Any new helper modules must be accompanied by targeted unit tests, and additional integration coverage should be added only if an
edge case lacks coverage in the suites above.

## Risks & Mitigations

- **Strategy selection mistakes** – Mitigated by comprehensive unit tests for the decider and by replaying existing mixed-action
fixtures from the bug regression tests.
- **Telemetry drift** – The instrumentation adapter must be validated against the action-aware trace expectations to ensure the
structured trace snapshots stay identical. Snapshot/spy assertions in the tracing integration suite will guard this.
- **Performance regressions** – The performance suite listed above must demonstrate parity with current timings; caching formatter
options and reusing normalised target structures will help maintain throughput.

## Success Criteria

- `ActionFormattingStage` shrinks to a coordination layer (<300 lines) while functionality remains unchanged.
- Adding a new formatting mode requires implementing a new strategy without modifying existing ones.
- All listed test suites pass unchanged, and no new regressions are reported in mixed-action scenarios.
