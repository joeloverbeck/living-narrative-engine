# ACTFORSTA-006-03: Refactor ActionFormattingStage to delegate to the coordinator

## Objective
Slim down `ActionFormattingStage` so it constructs dependencies and defers execution entirely to `ActionFormattingCoordinator`, removing the bespoke traced/untraced branches that currently live in the stage.

## Current State
- `ActionFormattingStage` still owns the full orchestration flow. It chooses between `#executeWithTracing` and `#executeStandard` based on the presence of `trace.captureActionData`, and each branch calls large helpers such as `#formatActionsWithDecider`, `#formatMultiTargetActionsTraced`, `#formatMultiTargetActions`, and `#formatLegacyFallbackTask`.
- The stage keeps private utilities for multi-target fallbacks and normalization (`#createTargetExtractionResult`, `#extractTargetIds`, `#getPrimaryTargetContext`) and also wraps error creation with `#createError`.
- `ActionFormattingCoordinator` already exists and mirrors the modern decider/strategy orchestration (including instrumentation, accumulator wiring, legacy fallback handling, and target normalization when supplied with the existing collaborators), but the stage never instantiates or delegates to it.

## Tasks
- Replace the current `executeInternal` implementation so it only:
  - Detects whether the provided `trace` supports action-aware instrumentation and selects either `TraceAwareInstrumentation` or `NoopInstrumentation` accordingly.
  - Constructs an `ActionFormattingCoordinator` with the pipeline context, the chosen instrumentation, the existing decider, strategies, formatter helpers, and factories. The dependency list should include at minimum the accumulator factory (`() => new FormattingAccumulator()`), `errorFactory`, `legacyFallbackFormatter`, `targetNormalizationService`, `commandFormatter`, `entityManager`, `safeEventDispatcher`, `getEntityDisplayNameFn`, `logger`, and the stage's `#validateVisualProperties` helper so that coordinator behaviour matches today's stage semantics.
  - Invokes `coordinator.run()` and returns its `PipelineResult`, ensuring trace logging that currently occurs outside the instrumentation (e.g., `trace.step` calls) is preserved if still required.
- Remove the bespoke helper methods that become redundant once delegation is in place: `#executeWithTracing`, `#executeStandard`, `#formatActionsWithDecider`, both `#formatMultiTargetActions*` variants, `#formatLegacyFallbackTask`, and the normalization/error wrappers (`#createTargetExtractionResult`, `#extractTargetIds`, `#getPrimaryTargetContext`, `#createError`). Update any remaining references so strategies and the coordinator provide the same behaviour.
- Ensure the constructor continues to instantiate the decider, strategies, error factory, and normalization service, but drop any state that was only used by the removed helpers.
- Update or add unit/integration tests so `ActionFormattingStage` is exercised with traced and untraced contexts, confirming the coordinator is constructed with the expected dependencies and that instrumentation hooks are still triggered when tracing is disabled.

## Acceptance Criteria
- `ActionFormattingStage` becomes a thin adapter (target size <300 lines) that primarily wires dependencies before delegating to `ActionFormattingCoordinator` for execution.
- No references to the removed legacy helper branches remain; all formatting logic is exercised via the coordinator while preserving the stage's logging and safe dispatch side effects.
- Stage-level tests pass, with mocks/fakes confirming the coordinator receives the correct parameters and instrumentation behaves correctly for both traced and untraced invocations.
