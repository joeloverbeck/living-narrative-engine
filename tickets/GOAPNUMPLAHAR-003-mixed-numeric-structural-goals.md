# GOAPNUMPLAHAR-003: Mixed Numeric + Structural Goal Handling

**Status**: Ready  
**Priority**: Medium  
**Spec Reference**: `specs/goap-numeric-planning-hardening.md`

## Summary

Preserve the constraint that the numeric distance heuristic (`#taskReducesDistance`) only applies to pure numeric goals (root operators `<=`, `<`, `>=`, `>`). Composite JSON Logic expressions (`and`, `or`, structural + numeric mixes) must bypass numeric guards and be evaluated as straight booleans. Document this modeling rule for content authors so they keep numeric thresholds at the root whenever they want heuristic-driven pruning.

## Requirements

1. Reconfirm `GoapPlanner.#hasNumericConstraints` only returns `true` for single-root numeric expressions. Guard the method against future refactors that might treat any mixed expression as numeric.
2. Add or update unit regression tests that feed multiple JSON Logic goal structures (single comparator, nested `and`, nested `or`, structural + numeric mixes) and assert the method's behavior.
3. Ensure integration coverage exists (or is expanded) so goals containing numeric sub-expressions inside `and/or` do not trigger numeric distance heuristics during planning.
4. Update authoring docs—`docs/goap/multi-action-planning.md` and related goal authoring guides—to explicitly describe the "numeric root operator only" heuristic requirement and advise on modeling patterns.
5. If GOAPDebugger or Plan Inspector surfaces heuristics, update their messaging/tooltips to clarify when numeric heuristics are active vs. intentionally bypassed.

## Tasks

- [ ] Strengthen `#hasNumericConstraints` implementation with clear guard clauses + inline comments referencing the hardening spec.
- [ ] Create dedicated unit tests (e.g., `goapPlanner.hasNumericConstraints.test.js`) enumerating supported vs. unsupported goal trees.
- [ ] Add integration fixture(s) demonstrating a mixed structural + numeric goal executing without numeric heuristic pruning.
- [ ] Document the rule in the goal authoring guide and add a troubleshooting entry for "numeric guard not triggering" scenarios.
- [ ] Review debugging tool strings to confirm they accurately describe heuristics activation.

## Dependencies / Related Work

- `src/goap/planner/goapPlanner.js` (`#hasNumericConstraints`, `#taskReducesDistance`)
- `tests/integration/goap/numericGoalPlanning.integration.test.js`
- Authoring docs under `docs/goap/multi-action-planning.md`
- Tooling docs in `docs/goap/debugging-tools.md`

## Acceptance Criteria

- Unit and integration tests break if numeric heuristics re-activate for composite goals.
- Documentation clearly states the modeling constraint and provides examples for both pure numeric and mixed goals.
- Debugging tooling communicates heuristic scope so content authors are not surprised.
- PR references the spec and links relevant doc/test diffs.

