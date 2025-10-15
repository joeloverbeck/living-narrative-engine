# TARCOMVAL-005: Expand Regression Harness and Benchmarks

**Phase:** TargetComponentValidation Hardening - Phase 5 (Testing & Verification)
**Priority:** High
**Estimated Effort:** 5 days

## Goal

Strengthen automated coverage by adding integration, reporter, and performance tests that validate the refactored target validation pipeline under both legacy and multi-target scenarios.

## Context

The spec calls for integration tests combining `MultiTargetResolutionStage` with the hardened validation stage, reporter-focused tests that assert trace payloads without full pipeline coupling, and performance benchmarks to ensure caching improvements pay off.【F:specs/target-component-validation-stage-hardening.spec.md†L120-L170】 Existing tests do not exercise the new collaborators end-to-end, leaving regression risk after the refactor.

## Deliverables

1. Integration tests that run `MultiTargetResolutionStage` + `TargetComponentValidationStage` using both `actionsWithTargets` and `candidateActions` inputs, asserting identical outcomes pre/post refactor.
2. Reporter contract tests verifying payload shapes for success, partial failure, and skipped-validation cases without requiring live trace infrastructure.
3. Configuration snapshot tests covering strict, lenient, and skip-validation scenarios using injected snapshots.
4. Performance benchmark updates (or new harness cases) comparing throughput before vs after caching changes.
5. Documentation of test coverage and how to execute the new suites.

## Tasks

1. **Integration Harness**
   - Build fixture scenarios for legacy single-target and multi-target actions.
   - Execute `MultiTargetResolutionStage` followed by the refactored validation stage using the IO adapter, pruner, reporter, and emitter.
   - Assert on resulting action availability, target removals, and stage result metadata.
2. **Reporter Contract Tests**
   - Mock reporter dependencies to capture emitted payloads.
   - Validate payload structure for: full success, required-component failure, forbidden-component detection, and skip-validation paths.
   - Ensure reporter gracefully handles no-op mode when tracing disabled.
3. **Config Snapshot Tests**
   - Add tests that feed synthetic snapshots into the stage to ensure strict/lenient toggles and skip lists behave like legacy `shouldSkipValidation` semantics.
4. **Performance Benchmarking**
   - Update existing performance harness or create new measurement focusing on configuration caching and pruner throughput.
   - Record baseline metrics before refactor (if possible) and compare after implementation, flagging regressions over agreed thresholds.
5. **Documentation & CI Integration**
   - Update `specs/` or testing README with instructions for running the new suites.
   - Ensure relevant npm scripts (integration/performance) include the new test files.

## Validation

- [ ] Integration tests pass for both legacy and multi-target flows with deterministic outcomes.
- [ ] Reporter tests cover success/failure/skip scenarios and enforce payload contracts.
- [ ] Config snapshot tests confirm parity with legacy behavior.
- [ ] Performance benchmarks show no regression; improvements documented.
- [ ] Documentation updated and shared with QA/engineering.

## Dependencies

- Requires completion of TARCOMVAL-001 through TARCOMVAL-004 so the refactored components are available.
