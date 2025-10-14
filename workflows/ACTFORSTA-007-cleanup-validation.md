# ACTFORSTA-007: Remove Legacy Code Paths & Reconfirm Performance Baseline

## Summary
After coordinator integration, harden `ActionFormattingStage` as the thin orchestration layer around `ActionFormattingCoordinator`, scrub lingering documentation that references the legacy helper flows, and reconfirm the performance baseline.

## Tasks
- Audit `ActionFormattingStage` to confirm it only wires dependencies, selects instrumentation, and performs `#validateVisualProperties` checks—no legacy `#format*` helpers should exist.
- Update imports/exports and any shared helper wiring so the coordinator, strategies, and services remain the single source of truth for formatting logic, fallback handling, and target normalisation.
- Perform a repository-wide search for references to the removed helper methods (e.g. `formatActions`, `formatAction`, `formatWithFallback`) in code, tests, and debugging scripts; replace or delete anything that still references them.
- Run the specification's required suites (unit, integration, performance) to verify behaviour stability and parity of the structured trace benchmarks.
- Refresh developer documentation (`docs/` or README sections) to describe the coordinator-focused architecture and call out the remaining stage responsibilities (dependency wiring + validation hook).

## Acceptance Criteria
- `ActionFormattingStage` contains only orchestration logic plus `#validateVisualProperties`; no legacy helper implementations or stray formatter logic remain.
- All required tests, including `tests/performance/actions/pipelineStructuredTracePerformance.test.js`, pass without regressions.
- Documentation updates clearly describe the new module responsibilities, note that the coordinator drives formatting, and outline the extension points for strategies/services.

## Dependencies
- Requires completion of **ACTFORSTA-006** so the new architecture is fully wired before cleanup.
