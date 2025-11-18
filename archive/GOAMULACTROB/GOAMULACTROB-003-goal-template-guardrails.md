# GOAMULACTROB-003 Goal template guardrails

**Status:** ✅ Completed – 2025-11-18

## Summary
- Guard GOAP goal templates from hardcoding literal actor IDs by extending the existing `goalPathValidator`/`validate:goals` tooling (consumed by `GoapPlanner`) to flag `has_component` clauses that reference `'actor_*'` style entity IDs instead of the `'actor'` alias.
- Update the shared `createTestGoal` helpers so every generated goal uses the `'actor'` alias in `has_component` clauses and emits a test-only warning whenever an override passes a literal ID like `'actor_alpha'`.
- Document the constraint for content authors inside `docs/goap/debugging-tools.md` under the debugging workflow so they understand why `'actor'` is required for actor-scoped goals and how to lint their mods with `npm run validate:goals`.

- Extend `src/goap/planner/goalPathValidator.js` (and therefore the planner + `npm run validate:goals`) with a pass that walks JSON Logic trees, detects `has_component: ['actor_alpha', ...]` style literals, and reports violations with remediation guidance referencing `specs/goap-system-specs.md#Planning-State View Contract`.
- Add unit coverage in `tests/unit/goap/planner/goalPathValidator.test.js` proving that compliant templates pass while hardcoded IDs throw and surface clear remediation hints.
- Update `GoapPlanner`'s failure handling so the new validator output is surfaced through `GOAP_PLANNER_FAILURES.INVALID_GOAL_PATH` and reflected inside CI logs.
- Keep `scripts/validateGoals.js` as the CLI entry point but wire the new rule into its output (no brand-new executable, just reuse the existing command) so `npm run validate:goals` catches bad mods and can be chained into `validate:ecosystem`.
- Update `tests/integration/goap/testFixtures/testGoalFactory.js` (and any `createTestGoal` exports) to default the first `has_component` entry to `'actor'` unless a caller explicitly opts out; emit a console warning (suppressed outside tests) when a literal actor ID slips through.
- Normalize existing GOAP test fixtures (especially `tests/integration/goap/aStarPlanning.integration.test.js` and any helper that still references `actorId` inside a goal template) so they rely on `'actor'` instead of hardcoded IDs.
- Add a short subsection to `docs/goap/debugging-tools.md` under "Empty plan completions" clarifying that `'actor'` must be used in actor-scoped templates and referencing `npm run validate:goals` as the lint command.

## File list
- `src/goap/planner/goalPathValidator.js`
- `src/goap/planner/goapPlanner.js`
- `tests/unit/goap/planner/goalPathValidator.test.js`
- `tests/integration/goap/testFixtures/testGoalFactory.js`
- `tests/integration/goap/aStarPlanning.integration.test.js` (plus any other GOAP suites with hardcoded actor IDs in goal templates)
- `scripts/validateGoals.js`
- `docs/goap/debugging-tools.md`

## Out of scope
- Editing goal data/lore inside `data/mods/` beyond what is necessary to satisfy the new validator (that cleanup belongs on follow-up tickets).
- Changing the overall GOAP schema, task serialization format, or how component scopes are declared.
- Adding brand-new CI workflows; this ticket only wires the validator into existing `npm run validate:*` chains.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- goalPathValidator`
- `npm run validate:goals`
- `npm run validate:ecosystem` (to ensure the stricter validation integrates cleanly)

## Outcome
- Hardened `goalPathValidator`/`GoapPlanner` so `has_component` clauses that reference literal actor IDs fail both planner runs and `npm run validate:goals`, with actionable diagnostics tied to the Planning-State View contract instead of touching `ContextAssemblyService`.
- Reused the existing `scripts/validateGoals.js` entry point (no extra CLI) while updating `createTestGoal`, planning/integration tests, and docs to default to the `'actor'` alias and surface dev-only warnings when suites override it.

### Invariants that must remain true
- Goals that already use `'actor'` continue to compile/run without extra warnings.
- Validator errors must clearly cite the offending goal/task ID and explain how to migrate to `'actor'` so content authors can remediate without code changes.
- The warning emitted by `createTestGoal` stays confined to test/dev builds and never pollutes production bundles.
