# ACTFORSTA-006-03: Refactor ActionFormattingStage to delegate to the coordinator

## Objective
Slim down `ActionFormattingStage` so it constructs dependencies and defers execution entirely to `ActionFormattingCoordinator`, removing bespoke traced/untraced branches.

## Tasks
- Replace the current `executeInternal` implementation in `ActionFormattingStage` with logic that selects the correct instrumentation adapter (`TraceAwareInstrumentation` vs `NoopInstrumentation`) and instantiates `ActionFormattingCoordinator` with all required collaborators.
- Remove helper methods that previously differentiated traced/untraced flows (`#executeWithTracing`, `#executeStandard`, `#formatMultiTargetActions*`, `#formatLegacyFallbackTask`, etc.) and update any remaining references to rely on the coordinator.
- Ensure the stage maintains its public API, logging side effects, and safe event dispatch semantics expected by downstream pipeline stages.
- Update or add tests validating that the stage delegates work to the coordinator and that instrumentation wiring still occurs even when tracing is disabled.

## Acceptance Criteria
- `ActionFormattingStage` file size falls below 300 lines and primarily contains dependency wiring.
- No references to legacy helper branches remain; all formatting logic is exercised via the coordinator.
- Stage-level tests pass, with mocks/fakes confirming the coordinator receives the correct parameters for traced and untraced invocations.
