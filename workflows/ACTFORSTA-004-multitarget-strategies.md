# ACTFORSTA-004: Implement Per-Action Metadata & Global Multi-Target Strategies

## Summary
Introduce explicit strategy classes for the per-action metadata and batch-level multi-target formatting paths, leveraging the shared task and normalization utilities to avoid batch-wide heuristics.

## Background
- `ActionFormattingStage` still executes the per-action and batch multi-target branches inline via the `#formatActionsWithPerActionMetadata*` and `#formatMultiTargetActions*` helpers, choosing a single pathway for the whole batch before iterating the actions. 【F:src/actions/pipeline/stages/ActionFormattingStage.js†L120-L339】【F:src/actions/pipeline/stages/ActionFormattingStage.js†L904-L1180】
- The legacy flow has already been extracted into `LegacyStrategy`/`LegacyFallbackFormatter`, both of which are instantiated from the stage constructor today and expose a reference `format` API to mirror. 【F:src/actions/pipeline/stages/ActionFormattingStage.js†L26-L123】【F:src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js†L1-L112】
- Shared infrastructure from earlier tickets exists (`ActionFormattingTaskFactory`, `TargetNormalizationService`, `FormattingAccumulator`, `ActionFormattingInstrumentation`, `ActionFormattingErrorFactory`), but the stage still calls traces directly and builds errors through its private `#createError` helper. Strategies introduced here should therefore accept explicit dependencies (instrumentation, accumulator, error factory callback) rather than assuming the stage already wires them. 【F:src/actions/pipeline/stages/actionFormatting/ActionFormattingTaskFactory.js†L1-L78】【F:src/actions/pipeline/stages/actionFormatting/TargetNormalizationService.js†L20-L241】【F:src/actions/pipeline/stages/ActionFormattingStage.js†L904-L1180】【F:src/actions/pipeline/stages/actionFormatting/ActionFormattingErrorFactory.js†L1-L100】

## Tasks
- Implement `PerActionMetadataStrategy` under `src/actions/pipeline/stages/actionFormatting/strategies/PerActionMetadataStrategy.js` that exposes `canFormat(task)`/`format({ task, instrumentation, accumulator, createError })`. Use the `ActionFormattingTaskFactory` output (including `task.metadata.hasPerActionMetadata`) to detect eligibility, call `commandFormatter.formatMultiTarget` when available, and fall back through `LegacyFallbackFormatter`/`commandFormatter.format` for per-command failures while recording errors via the provided `createError` callback.
- Implement `GlobalMultiTargetStrategy` under `src/actions/pipeline/stages/actionFormatting/strategies/GlobalMultiTargetStrategy.js` that activates when tasks rely on batch-level `resolvedTargets`/`targetDefinitions`. Mirror the behaviour of `#formatMultiTargetActions*`, including instrumentation payloads, per-command target-id construction through `TargetNormalizationService`, and fallback handling when multi-target formatting is unsupported or fails.
- Ensure both strategies interact with `ActionFormattingInstrumentation` (when supplied) for `stageStarted`/`actionStarted`/`actionCompleted`/`actionFailed`, push successes and failures into a shared `FormattingAccumulator`, and surface structured errors by delegating to the injected `createError` helper (currently bound to `ActionFormattingStage.#createError`, later to `ActionFormattingErrorFactory`).
- Write unit tests covering success and error paths for each strategy, including mixed batches where some actions fall back to legacy handling.
- Validate compatibility with existing multi-target regression tests (`ActionFormattingStage.multiTargetFix`, `MultiTargetActionFormatter.mixedActionsBug`, etc.) without modifying those suites.

## Acceptance Criteria
- Both strategies exist and are selectable independently per action based on task metadata.
- Multi-target formatting behaviour matches current outputs, including fallbacks and error propagation, as confirmed by relevant unit/integration suites.
- No regressions introduced to legacy formatting paths.

## Dependencies
- Requires **ACTFORSTA-001** for instrumentation and error handling.
- Requires **ACTFORSTA-003** for the shared task structure and target normalization.
- Should land after or alongside **ACTFORSTA-002** to ensure fallback behaviours remain coherent.
