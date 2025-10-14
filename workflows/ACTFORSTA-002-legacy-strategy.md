# ACTFORSTA-002: Implement Legacy Formatting Strategy & Fallback Service

## Summary
Refactor the existing single-target/legacy formatting path into a dedicated strategy that leverages an extracted fallback service while preserving legacy behaviour and tests.

## Tasks
- Create `LegacyFallbackFormatter` encapsulating template preparation, placeholder substitution, context sanitisation, and fallback command construction (`prepareFallback`, `formatWithFallback`).
- Introduce `LegacyStrategy` that consumes `LegacyFallbackFormatter`, the accumulator, instrumentation hooks, and the error factory to process `ActionFormattingTask` instances representing legacy actions.
- Port legacy-specific helper methods (`#extractTargetsFromContexts`, `#formatWithLegacyFallback`, `#prepareLegacyFallback`, etc.) from `ActionFormattingStage` into the new modules, ensuring functional equivalence.
- Add focused unit tests covering `LegacyFallbackFormatter` edge cases (e.g., missing targets, sanitisation rules) and `LegacyStrategy` flows, including successful formatting and error propagation.
- Validate the new modules against the existing visual and fallback regression suites (`ActionFormattingStage.visual`, `.rubOverClothesFallback`, etc.) without altering the tests.

## Acceptance Criteria
- `LegacyStrategy` exists and can format legacy actions via the new fallback service, emitting identical results and instrumentation signals compared to the current implementation.
- All legacy regression tests listed in the specification remain green without modification.
- Legacy helper logic is removed or marked for removal from `ActionFormattingStage`, with comments indicating the new source of truth pending coordinator wiring.

## Dependencies
- Depends on **ACTFORSTA-001** for instrumentation, accumulator, and error factory foundations.
