# TARCOMVAL-005: Expand Regression Harness and Benchmarks

**Phase:** TargetComponentValidation Hardening - Phase 5 (Testing & Verification)
**Priority:** High
**Estimated Effort:** 5 days

## Goal

Strengthen automated coverage by consolidating regression scenarios for the refactored target validation pipeline, ensuring the new collaborators stay aligned across legacy and multi-target flows.

## Context

`TargetComponentValidationStage` already composes the IO adapter, candidate pruner, config snapshot provider, telemetry reporter, and context emitter that Phase 5 introduced.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L8-L200】 The action discovery integration suite routes real pipelines through `MultiTargetResolutionStage` and the validation stage, so we have broad end-to-end smoke coverage.【F:tests/integration/actions/CoreActionTargetResolution.integration.test.js†L320-L414】【F:src/actions/actionPipelineOrchestrator.js†L64-L175】 We also landed configuration strictness/skip tests and reporter contract specs, exercising lenient overrides, disabled validation, and trace fallbacks.【F:tests/integration/actions/pipeline/targetValidationStage.additionalCoverage.integration.test.js†L129-L280】【F:tests/unit/actions/pipeline/stages/TargetValidationReporter.test.js†L45-L169】 Snapshot caching itself is unit-tested via `TargetValidationConfigProvider` so repeated lookups do not thrash configuration merges.【F:tests/unit/actions/pipeline/stages/TargetValidationConfigProvider.test.js†L10-L67】 What we still lack is a focused regression harness that checks the new shape-handling utilities together, validates emitter metadata in both input formats, and records a baseline performance profile for the hardened stage.

## Deliverables

1. Regression scenarios that execute `MultiTargetResolutionStage` followed by `TargetComponentValidationStage` for both `candidateActions` and `actionsWithTargets`, asserting that context mutations from `ContextUpdateEmitter` line up with adapter rebuild output (resolved targets, target contexts, stage updates).
2. Telemetry integration tests that wire `ActionAwareStructuredTrace` through the stage to confirm reporter payloads, skip notifications, and performance records surface end-to-end using the real reporter hooks.
3. Validation that a single `TargetComponentValidationStage` instance reuses the cached snapshot from `TargetValidationConfigProvider` across consecutive runs, preventing redundant config loads while still honoring toggles.
4. Performance benchmarks (or extended harness cases) establishing a baseline for the refactored stage under representative action volumes so future caching regressions can be detected.
5. Documentation of the new regression and benchmark coverage plus npm script updates so CI can exercise them.

## Tasks

1. **Cross-Format Regression Harness**
   - Build shared fixtures that flow through `MultiTargetResolutionStage` so both legacy (`candidateActions`) and modern (`actionsWithTargets`) payloads reach the validation stage.
   - Capture the context before/after `TargetComponentValidationStage.executeInternal` and assert that the emitter’s mutations (pruned targets, target contexts, shared resolved targets) mirror the adapter’s rebuilt payload.
   - Include expectations around `metadata.stageUpdates` so pruning reasons remain observable for downstream consumers.
2. **Trace Contract Verification**
   - Drive the stage with a real `ActionAwareStructuredTrace` instance (or high-fidelity test double) to ensure reporter hooks emit skip, start, completion, validation analysis, and performance data without bypassing reporter internals.
   - Cover failure/disabled scenarios to confirm logger fallbacks continue to trigger when trace capture rejects.
3. **Config Snapshot Reuse**
   - Instrument a stage instance with a spyable `TargetValidationConfigProvider` to prove repeated executions only fetch configuration once while still responding to updated toggles when the cache is cleared.
   - Add assertions that strict, lenient, and off modes drive validation as expected after successive runs.
4. **Performance Benchmarking**
   - Extend the performance harness (or create a new benchmark) that feeds large action sets through the resolution + validation combo, recording latency/throughput metrics for the current architecture.
   - Store baseline numbers and wire alerts or thresholds so future refactors surface regressions in caching or pruning throughput.
5. **Documentation & CI Integration**
   - Update `specs/` or the testing README with guidance for running the regression harness and benchmarks.
   - Ensure npm scripts and CI config execute the new suites and highlight where the baseline metrics live.

## Validation

- [ ] Regression harness verifies context mutations and adapter rebuild parity across both input formats.
- [ ] Trace integration tests exercise reporter hooks with real trace capture paths.
- [ ] Config snapshot reuse is demonstrated with targeted unit/integration coverage.
- [ ] Performance benchmarks capture and publish baseline metrics for the hardened stage.
- [ ] Documentation and CI updates describe how to run and monitor the suites.

## Dependencies

- Requires completion of TARCOMVAL-001 through TARCOMVAL-004 so the refactored components are available.
