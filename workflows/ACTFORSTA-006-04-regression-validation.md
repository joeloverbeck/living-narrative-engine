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
    being instantiated once per batch.
  - Fold in the neighbouring legacy coverage from
    `tests/integration/actions/pipeline/ActionFormattingStage.standardPath.integration.test.js` to confirm there is
    no remaining dependency on deleted helper methods.
- Sweep the broader pipeline suites—`tests/integration/actions/pipeline/actionFormattingStageIntegration.test.js`
  and `tests/integration/actions/pipeline/TraceAwareInstrumentation.integration.test.js`—and tighten any
  expectation that still assumes the stage performs formatting itself.

### 2. Verify mixed batch handling
- Use the builders to craft batches that combine:
  - Per-action metadata (e.g., individual rendering hints).
  - Multi-target metadata (shared attachments for several actions).
  - Legacy fallback formatting (actions that still rely on the minimal formatter).
- Confirm via assertions that each scenario routes through `ActionFormattingCoordinator` and that fallbacks are
  reported per action instead of short-circuiting the batch.
- Update or add inline expectations only when the existing ones do not demonstrate the coordinator behaviour.

### 3. Validate trace instrumentation
- Rely on the explicit assertions inside the tracing suites to confirm:
  - Instrumentation counters increment for every action the coordinator touches.
  - Emitted trace payloads still include the structured metadata and annotations that downstream consumers expect.
  - No-op instrumentation is used in untraced mode while still stepping the trace when available.
- Tighten the assertions if you notice behaviour changes (for example, adding checks for the new coordinator span
  names or verifying statistics now originate from the coordinator).

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
  are documented inline with comments explaining the new behaviour.
- Integration suites prove that mixed batches are processed action-by-action through the coordinator with no
  reliance on the removed stage helpers.
- All targeted test commands listed above succeed, demonstrating parity between the refactored coordinator flow
  and the previous stage implementation.
