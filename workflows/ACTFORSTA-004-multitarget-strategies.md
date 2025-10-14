# ACTFORSTA-004: Implement Per-Action Metadata & Global Multi-Target Strategies

## Summary
Introduce explicit strategy classes for the per-action metadata and batch-level multi-target formatting paths, leveraging the shared task and normalization utilities to avoid batch-wide heuristics.

## Tasks
- Implement `PerActionMetadataStrategy` that recognises actions with per-action `resolvedTargets` and `targetDefinitions`, preferring `commandFormatter.formatMultiTarget` when available and handling per-command fallbacks through the accumulator/error factory.
- Implement `GlobalMultiTargetStrategy` that processes actions when only batch-level target data is provided, encapsulating logic currently in the `#formatMultiTargetActions*` methods.
- Ensure both strategies call the instrumentation hooks at action start/completion/failure and push results into the shared accumulator.
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
