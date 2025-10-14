# ACTFORSTA-002: Implement Legacy Formatting Strategy & Fallback Service

## Summary
Refactor the existing single-target/legacy formatting path into a dedicated strategy that exposes the legacy helpers as a focused service. The current `ActionFormattingStage` implementation still handles trace emission directly (the instrumentation abstraction created in **ACTFORSTA-001** is not wired yet), so this ticket must keep parity with the existing trace/legacy flow while extracting the reusable pieces.

## Tasks
- Create `LegacyFallbackFormatter` encapsulating template preparation, placeholder substitution, context sanitisation, and fallback command construction (`prepareFallback`, `formatWithFallback`).
- Introduce `LegacyStrategy` that consumes `LegacyFallbackFormatter` and coordinates legacy formatting for the existing stage inputs (actor, action definition, target contexts, resolved targets, formatter options). Until `ActionFormattingTask` is introduced in **ACTFORSTA-003**, the strategy should accept the raw parameters currently passed through the legacy path but be structured so the task object can be dropped in later.
- Port legacy-specific helper methods (`#extractTargetsFromContexts`, `#formatWithLegacyFallback`, `#prepareLegacyFallback`, etc.) from `ActionFormattingStage` into the new modules, ensuring functional equivalence.
- Add focused unit tests covering `LegacyFallbackFormatter` edge cases (e.g., missing targets, sanitisation rules) and `LegacyStrategy` flows, including successful formatting and error propagation.
- Update `ActionFormattingStage` to instantiate and delegate to `LegacyStrategy` for the legacy branch while preserving the current trace-capture behaviour (`trace.captureActionData`, logger warnings, error payloads).
- Validate the new modules against the existing visual and fallback regression suites (`ActionFormattingStage.visual`, `.rubOverClothesFallback`, etc.) without altering the tests.

## Acceptance Criteria
- `LegacyStrategy` exists and can format legacy actions via the new fallback service, emitting identical formatted commands, trace payloads, and logger output compared to the current implementation.
- All legacy regression tests listed in the specification remain green without modification.
- Legacy helper logic is removed or marked for removal from `ActionFormattingStage`, with comments indicating the new source of truth pending coordinator wiring.

## Dependencies
- Depends on **ACTFORSTA-001** for instrumentation, accumulator, and error factory foundations.
