# ACTFORSTA-007: Remove Legacy Code Paths & Reconfirm Performance Baseline

## Summary
After coordinator integration, remove obsolete methods from `ActionFormattingStage`, ensure all helper references point to the new modules, and rerun performance validation to confirm parity.

## Tasks
- Delete redundant `#format*` and helper methods from `ActionFormattingStage`, replacing lingering references with calls to the coordinator or shared services.
- Update imports and exports to ensure the new modules are the single source of truth for formatting logic, fallback handling, and target normalisation.
- Perform a repository-wide search to confirm no code references the removed internals (including tests and debugging scripts).
- Run the full suite of tests enumerated in the specification (unit, integration, performance) to verify behaviour stability.
- Document the new architecture in relevant developer docs (`docs/` or README sections) summarising the coordinator/strategy layout.

## Acceptance Criteria
- `ActionFormattingStage` contains only the minimal orchestration logic defined in the spec; legacy helper implementations are fully removed.
- All required tests, including `tests/performance/actions/pipelineStructuredTracePerformance.test.js`, pass without regressions.
- Documentation updates clearly describe the new module responsibilities and extension points.

## Dependencies
- Requires completion of **ACTFORSTA-006** so the new architecture is fully wired before cleanup.
