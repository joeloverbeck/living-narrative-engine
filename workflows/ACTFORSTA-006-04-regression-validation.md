# ACTFORSTA-006-04: Validate coordinator integration and trace regressions

## Objective
Verify the end-to-end behaviour after delegating to `ActionFormattingCoordinator`, ensuring trace payloads, statistics, and mixed batch handling remain backward compatible.

## Tasks
- Update existing regression fixtures or snapshots that cover `ActionFormattingStage` to exercise coordinator-driven flows for traced and untraced executions.
- Add integration coverage for batches containing per-action metadata, multi-target metadata, and legacy entries to confirm all actions are routed through the coordinator without stage-level heuristics.
- Confirm telemetry/trace payloads (including statistics counters) match pre-refactor expectations by comparing against stored baselines or by augmenting tests with strict assertions.
- Execute the relevant unit, integration, and performance suites touching `ActionFormattingStage`; address any discrepancies surfaced by the coordinator refactor.

## Acceptance Criteria
- All trace and telemetry fixtures remain unchanged or are updated with documented justifications if adjustments are required.
- Integration tests demonstrate that mixed batches are processed action-by-action without falling back to the removed stage helpers.
- Root `npm run test` (or the targeted suites) passes, providing confidence that the coordinator behaves identically across execution modes.
