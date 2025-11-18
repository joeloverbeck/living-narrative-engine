# PLASTAAUT-003: Harden stale planning state regression coverage and docs

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
- `npm run lint`
- `npm run test:integration -- --runInBand tests/integration/goap/numericGoalPlanning.integration.test.js`

### Invariants to preserve
- The “stale planning state” integration scenario continues to assert both `planLength > 0` and at least one `GOAP_EVENTS.STATE_MISS` emission; do not relax these expectations.
- Documentation in `docs/goap/debugging-tools.md` must continue to note that `planLength: 0` is only valid when the planning snapshot already satisfies the goal.
- `docs/testing/testing-matrix.md` still maps the `HasComponentOperator` and `PlanningStateView` contract suites to their CI commands without removing existing entries.
- `specs/goap-system-specs.md` keeps the Planning-State View contract language intact while clarifying stale-snapshot handling; do not change unrelated spec sections.

## Implementation notes
- Strengthen the targeted integration test to capture telemetry payloads from multiple component misses (e.g., `core:armed`, `core:needs`) so regressions require fewer manual repro steps.
- Document the expected `STATE_MISS` debug workflow in `docs/goap/debugging-tools.md` and call out that runtime fallback is prohibited for planning-mode lookups.
- Update the testing matrix to highlight the unit + integration suites covering this behavior so CI owners know which commands to run when diagnosing failures.
