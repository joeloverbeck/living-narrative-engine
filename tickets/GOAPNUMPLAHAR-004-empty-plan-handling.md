# GOAPNUMPLAHAR-004: Empty Plan Handling Guarantees

**Status**: Ready  
**Priority**: Medium  
**Spec Reference**: `specs/goap-numeric-planning-hardening.md`

## Summary

Ensure controllers keep treating zero-length plans as "goal already satisfied" so numeric planning never spins on already-complete goals. `GoapController.decideTurn` currently dispatches `PLANNING_COMPLETED` with `planLength: 0`, logs the completion, and returns `null`. Lock this behavior down with targeted tests and documentation to prevent future regressions that might throw, retry, or misinterpret empty plans.

## Requirements

1. Audit `src/goap/controllers/goapController.js` to confirm zero-length plan handling remains intact (dispatch + log + `null` return).
2. Strengthen controller tests to ensure `decideTurn` covers: (a) `GoapPlanner.plan` returns `[]`, (b) `PLANNING_COMPLETED` action payload includes `planLength: 0`, and (c) no follow-up task execution is attempted.
3. Update docs (GOAP debugging tools or controller reference) to reiterate the empty-plan behavior so tooling expectations stay in sync.
4. Verify telemetry/logging surfaces this scenario ("goal already satisfied") as described in the hardening spec; add regression assertions if logging is structured.

## Tasks

- [ ] Add or update a controller unit test fixture simulating empty plan returns and asserting the dispatch/log contract.
- [ ] Document the zero-length plan resolution path within relevant GOAP debugging or controller design docs.
- [ ] Confirm analytics dashboards (if any) still recognize planLength=0 completions; adjust event schemas if necessary.

## Dependencies / Related Work

- `src/goap/controllers/goapController.js`
- Controller test suites under `tests/unit/goap/controllers/`
- `docs/goap/debugging-tools.md`

## Acceptance Criteria

- Automated tests fail if empty plans trigger retries, throws, or omit the `PLANNING_COMPLETED` action.
- Documentation explicitly states the desired behavior and points to the spec for context.
- Logging/telemetry remains consistent with GOAPDebugger expectations.

