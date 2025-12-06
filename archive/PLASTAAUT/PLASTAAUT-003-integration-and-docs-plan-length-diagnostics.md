# PLASTAAUT-003: Harden stale planning state regression coverage and docs

_Status: Completed_

## File list

- tests/integration/goap/numericGoalPlanning.integration.test.js
- docs/goap/debugging-tools.md
- docs/testing/testing-matrix.md
- specs/goap-system-specs.md

## Out of scope

- Implementing fixes inside runtime operators or PlanningStateView (handled by other tickets).
- Adding new GOAP goals, components, or mod data—use existing fixtures for regression coverage.
- Expanding unrelated documentation sections outside of planning-state diagnostics.

## Acceptance criteria

### Required tests

- `npm run lint` on the modified files only
- `npm run test:integration -- --runInBand tests/integration/goap/numericGoalPlanning.integration.test.js`

## Current reality check

- The stale planning state integration test currently asserts only a single `GOAP_EVENTS.STATE_MISS` payload (`core:armed`). Strengthen it to collect multiple component misses per run (e.g., `core:armed` + `core:needs`) so telemetry captures the real regression blast radius.
- `docs/goap/debugging-tools.md` still claims `HasComponentOperator` falls back to the runtime entity manager during planning. Update it to document the enforced planning-state-only lookup workflow and how to respond to the emitted `STATE_MISS` telemetry.
- `docs/testing/testing-matrix.md` currently lists only the PlanningStateView and HasComponent unit contracts. Add an explicit entry for the GOAP numeric planning integration harness (stale snapshot scenario) with the exact `npm run test:integration -- --runInBand tests/integration/goap/numericGoalPlanning.integration.test.js` command.
- `specs/goap-system-specs.md` lacks any mention of stale planning snapshots or `GOAP_STATE_ASSERT` enforcement under the Planning-State View contract. Expand that section to describe the diagnostics expectations without editing unrelated spec content.

### Invariants to preserve

- The “stale planning state” integration scenario continues to assert both `planLength > 0` and at least one `GOAP_EVENTS.STATE_MISS` emission; do not relax these expectations.
- Documentation in `docs/goap/debugging-tools.md` must continue to note that `planLength: 0` is only valid when the planning snapshot already satisfies the goal.
- `docs/testing/testing-matrix.md` still maps the `HasComponentOperator` and `PlanningStateView` contract suites to their CI commands without removing existing entries.
- `specs/goap-system-specs.md` keeps the Planning-State View contract language intact while clarifying stale-snapshot handling; do not change unrelated spec sections.

## Implementation notes

- Strengthen the targeted integration test to capture telemetry payloads from multiple component misses (e.g., `core:armed`, `core:needs`) so regressions require fewer manual repro steps.
- Document the expected `STATE_MISS` debug workflow in `docs/goap/debugging-tools.md` and call out that runtime fallback is prohibited for planning-mode lookups.
- Update the testing matrix to highlight the unit + integration suites covering this behavior so CI owners know which commands to run when diagnosing failures.

## Outcome

- Updated the stale planning-state integration test to assert both `core:armed` and `core:needs` misses alongside a nonzero `planLength` so stale snapshots now break CI immediately.
- Clarified the GOAP debugging docs, testing matrix, and Planning-State View spec to codify the planning-only `STATE_MISS` workflow plus the lack of runtime fallbacks when `context.state` exists.
