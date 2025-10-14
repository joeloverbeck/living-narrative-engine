# ACTFORSTA-006-04: Validate coordinator integration and trace regressions

## Objective
Confirm that delegating formatting work to `ActionFormattingCoordinator` preserves behaviour across traced and
untraced pipelines, including the emitted trace payloads, computed statistics, and mixed batch routing logic.

## Context
`ActionFormattingStage` no longer performs formatting directly; it constructs `ActionFormattingCoordinator` and
hands off execution. The surrounding refactors already tightened constructor wiring and coverage. This workflow
re-validates the observable behaviour by leaning on existing integration suites and the explicit tracing
assertions that live beside them. Treat the effort as a guard-rail pass rather than a rewrite—only extend coverage
if a gap becomes obvious while auditing the suites below.

Keep a reference copy of the coordinator internals nearby while auditing—`ActionFormattingCoordinator#run`,
`#emitStageStarted`, `#emitStageCompleted`, and `#formatLegacyFallbackTask` describe the instrumentation and
statistics boundaries that the tests must continue to observe. The goal is to demonstrate that:

- `ActionFormattingStage.executeInternal` still calls `trace.step` with the batch summary even though the heavy
  lifting moves out of the stage.
- `ActionFormattingCoordinator` remains the single place emitting `stageStarted`, `stageCompleted`,
  `actionStarted`, and `actionFailed` instrumentation events.
- Accumulated statistics, legacy fallback routing, and validation failure propagation are indistinguishable from
  the pre-coordinator implementation when viewed through the existing integration expectations.

## Preparation
- [ ] Familiarise yourself with the coordinator flow by reading
      `src/actions/pipeline/stages/ActionFormattingCoordinator.js` and the updated stage entry point at
      `src/actions/pipeline/stages/actionFormattingStage.js`.
- [ ] Review helper builders in `tests/integration/actions/pipeline/__helpers__` so you can adjust payloads without
      introducing new fixtures.
- [ ] Have the targeted test commands ready (listed under **Test Execution**) so regressions are caught immediately
      after each edit.

## Validation Plan
### 1. Audit integration coverage
- Start with `tests/integration/actions/pipeline/stages/actionFormattingStage.integration.test.js` and
  `tests/integration/actions/pipeline/stages/ActionFormattingCoordinator.integration.test.js`.
  - Ensure both traced and untraced execution paths are covered and that the assertions now reflect the coordinator
    being instantiated once per batch. Update any lingering references to per-action coordinator construction or
    to stage-local helper invocations.
  - Verify that the expectations still observe `stageStarted`/`stageCompleted` payloads, including the
    `formattingPath: 'per-action'` field and the statistics gathered via `FormattingAccumulator#getStatistics()`.
  - Fold in the neighbouring legacy coverage from
    `tests/integration/actions/pipeline/ActionFormattingStage.standardPath.integration.test.js` to confirm there is
    no remaining dependency on deleted helper methods or direct calls into the legacy formatter from the stage.
- Sweep the broader pipeline suites—`tests/integration/actions/pipeline/actionFormattingStageIntegration.test.js`
  and `tests/integration/actions/pipeline/TraceAwareInstrumentation.integration.test.js`—and tighten any
  expectation that still assumes the stage performs formatting itself. Replace outdated mocks with coordinator
  aware versions if necessary so the tests assert the new orchestration boundary.

### 2. Verify mixed batch handling
- Use the builders to craft batches that combine:
  - Per-action metadata (e.g., individual rendering hints) so `PerActionMetadataStrategy` remains selectable.
  - Multi-target metadata (shared attachments for several actions) so `GlobalMultiTargetStrategy` stays active.
  - Legacy fallback formatting (actions that still rely on the minimal formatter) to exercise
    `#formatLegacyFallbackTask`.
- Confirm via assertions that each scenario routes through `ActionFormattingCoordinator` and that fallbacks are
  reported per action instead of short-circuiting the batch. Inspect the accumulator expectations—`registerAction`,
  `recordFailure`, and the resulting `PipelineResult` actions array should reflect every branch taken.
- Update or add inline expectations only when the existing ones do not demonstrate the coordinator behaviour. When
  new assertions are required, assert the resulting instrumentation payloads (e.g., failure codes, metadata source,
  `targetContextCount`) so future regressions are visible.

### 3. Validate trace instrumentation
- Rely on the explicit assertions inside the tracing suites to confirm:
  - Instrumentation counters increment for every action the coordinator touches (stage level and per-action hooks).
  - Emitted trace payloads still include the structured metadata and annotations that downstream consumers expect—
    double check `trace.step` messaging, structured annotations, and the hand-off to
    `TraceAwareInstrumentation#actionStarted`/`#actionCompleted`.
  - No-op instrumentation is used in untraced mode while still stepping the trace when available. The tests should
    continue asserting the noop class type or behaviour rather than weakening expectations.
- Tighten the assertions if you notice behaviour changes (for example, adding checks for the new coordinator span
  names or verifying statistics now originate from the coordinator). Add inline comments explaining *why* the
  assertion changed so the next maintainer understands the coordinator-specific nuance.

### 4. Test Execution
Run the following targeted suites after updating assertions or builders:

```bash
npm run test:unit -- ActionFormattingStage
npm run test:unit -- ActionFormattingCoordinator
npm run test:integration -- ActionFormattingStage
npm run test:integration -- ActionFormattingCoordinator
npm run test:performance -- pipelineStructuredTracePerformance
```

Re-run the relevant command whenever you touch a test within its scope to maintain quick feedback.

## Exit Criteria
- Unit and integration assertions around trace instrumentation pass without loosening expectations, or any changes
  are documented inline with comments explaining the new behaviour (reference the relevant coordinator method so
  the trace between code and test is obvious).
- Integration suites prove that mixed batches are processed action-by-action through the coordinator with no
  reliance on the removed stage helpers. Each assertion should point to coordinator responsibilities (decider,
  accumulator, instrumentation) instead of historical stage utilities.
- All targeted test commands listed above succeed, demonstrating parity between the refactored coordinator flow
  and the previous stage implementation. Capture the final command outputs in the PR description to make the
  regression guard-rail explicit for reviewers.
