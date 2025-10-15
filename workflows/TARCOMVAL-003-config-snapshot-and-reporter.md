# TARCOMVAL-003: Inject Config Snapshot and Introduce Validation Reporter

**Phase:** TargetComponentValidation Hardening - Phase 3
**Priority:** High
**Estimated Effort:** 5 days

## Goal

Refactor `TargetComponentValidationStage` to consume a pre-resolved configuration snapshot and delegate trace/performance logging to a dedicated `TargetValidationReporter`, reducing repeated deep merges and trace coupling.

## Context

The stage currently re-fetches configuration through `getActionPipelineConfig()` for each call and even inside per-action loops, incurring heavy overhead and making strictness testing brittle.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L125-L305】【F:src/config/actionPipelineConfig.js†L165-L233】 Trace capture logic is embedded in the stage, duplicating per-role analysis and complicating no-trace scenarios.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L309-L883】 Centralizing these concerns will improve performance and observability isolation.

## Deliverables

1. Config provider interface (factory or dependency injection parameter) that exposes a cached snapshot containing `strictness`, `skipValidation`, logging toggles, and other required fields.
2. Stage updates to rely exclusively on the injected snapshot within execution, removing redundant config recomputations.
3. `TargetValidationReporter` module with methods for validation outcomes, performance metrics, and optional no-op behavior when tracing is disabled.
4. Unit tests verifying config snapshot consumption (strict vs lenient paths) and reporter invocations.
5. Updated stage tests that mock reporter interactions instead of asserting on inline trace side effects.

## Tasks

1. **Config Snapshot Extraction**
   - Define an interface (e.g., `TargetValidationConfigSnapshot`) capturing the fields consumed by the stage.
   - Implement a provider that resolves the snapshot once per stage instance, caching deep-merge results.
   - Adjust stage construction to accept the provider/snapshot, removing direct calls to `getActionPipelineConfig()` and `shouldSkipValidation`.
2. **Reporter Implementation**
   - Move logic from `#captureValidationAnalysis` and `#capturePerformanceData` into `TargetValidationReporter`.
   - Provide a default reporter implementation and a no-op fallback.
   - Ensure reporter handles role-aware payload formatting using data from the IO adapter/pruner outputs.
3. **Stage Refactor**
   - Replace inline trace/config code with reporter calls and snapshot reads.
   - Adapt existing metrics (timings, counts) to be assembled into summary objects passed to the reporter.
4. **Testing**
   - Add focused unit tests for the provider to ensure snapshot caching and correct toggling behavior.
   - Create reporter tests that assert emitted payload shapes for success/failure cases without invoking the full pipeline.
   - Update stage unit tests to use mocks/spies verifying reporter methods are called with expected data in strict and lenient modes.

## Validation

- [ ] Stage no longer re-fetches configuration inside per-action loops.
- [ ] Reporter encapsulates all trace/perf logic, with stage tests mocking reporter interactions.
- [ ] Snapshot provider tests confirm strictness toggles and skip lists match previous semantics.
- [ ] Performance benchmark (micro or existing harness) shows no regression compared to baseline.

## Dependencies

- Requires TARCOMVAL-001 (IO adapter/role registry) and TARCOMVAL-002 (pruner extraction) to ensure stage API surfaces the necessary data for reporter inputs.
