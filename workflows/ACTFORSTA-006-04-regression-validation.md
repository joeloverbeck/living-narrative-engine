# ACTFORSTA-006-04: Validate coordinator integration and trace regressions

## Objective
Verify the end-to-end behaviour after delegating to `ActionFormattingCoordinator`, ensuring trace payloads, statistics, and mixed batch handling remain backward compatible.

## Tasks
- Review the existing integration suites in `tests/integration/actions/pipeline/stages/ActionFormattingStage.integration.test.js` and `tests/integration/actions/pipeline/stages/ActionFormattingCoordinator.integration.test.js` (plus their tracing-focused companions) to ensure they exercise coordinator-driven flows for both traced and untraced executions. Update inline assertions or helper builders as needed—no snapshot or fixture files are involved.
- Confirm that those suites cover batches with per-action metadata, multi-target metadata, and legacy fallback formatting so every scenario routes through the coordinator. Extend the current tests only if a gap is discovered.
- Validate telemetry and trace instrumentation by relying on the explicit assertions already present in the tracing integration tests (e.g. verifying instrumentation counters and emitted payloads) and tighten them where behaviour changes.
- Run the targeted unit, integration, and performance suites for the coordinator work: `npm run test:unit -- ActionFormattingStage`, `npm run test:unit -- ActionFormattingCoordinator`, `npm run test:integration -- ActionFormattingStage`, `npm run test:integration -- ActionFormattingCoordinator`, and `npm run test:performance -- pipelineStructuredTracePerformance`.

## Acceptance Criteria
- Existing integration and unit assertions around trace instrumentation continue to pass (document any expectation changes made to those assertions).
- Integration tests demonstrate that mixed batches are processed action-by-action without falling back to the removed stage helpers.
- The targeted test commands above succeed, providing confidence that the coordinator behaves identically across execution modes.
