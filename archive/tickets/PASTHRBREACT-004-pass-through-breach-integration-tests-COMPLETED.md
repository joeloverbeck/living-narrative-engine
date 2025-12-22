# PASTHRBREACT-004: Add Pass-Through-Breach Integration Tests

**Status**: Completed
**Priority**: Medium

## Overview
Add integration coverage for the existing pass-through-breach action/rule: action discovery, target pairing (contextFrom), and rule outcomes (position update, perceptible events, UI success message). Use existing movement and breaching tests as patterns.

## Reassessed Assumptions
- The action (`movement:pass_through_breach`), rule (`handle_pass_through_breach`), condition, and scopes already exist in `data/mods/` and are wired in the movement manifest.
- The success UI message is authored in the rule (not a verbatim echo of the action template); tests should assert the rule’s message, which includes the actor’s name.
- Action discovery in ModTestFixture uses the simple scope resolver; movement/breaching scopes that depend on location exits require test-local resolvers to reflect exits/blockers.

## File List
- `tests/integration/mods/movement/pass_through_breach_action_discovery.test.js`
- `tests/integration/mods/movement/pass_through_breach_rule_execution.test.js`

## Out of Scope
- Do not change any movement or breaching mod content beyond what tests require for fixtures.
- Do not update unrelated action discovery tests or snapshots.
- Do not modify production rules or actions.

## Acceptance Criteria
### Specific tests that must pass
- `npm run test:integration -- tests/integration/mods/movement/pass_through_breach_action_discovery.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/movement/pass_through_breach_rule_execution.test.js --runInBand`

### Invariants that must remain true
- Existing integration tests remain deterministic and do not require new global test hooks.
- Test fixtures only add minimal data needed to exercise breached blockers.
- Success message text matches the rule’s expected wording (actor name + pass-through-breach phrasing).

## Outcome
- Added integration coverage for action discovery, target pairing, and rule execution in the movement mod using local scope resolvers plus real scope resolution for pairing.
- Updated test fixtures to satisfy `anatomy:actor-can-move` prerequisite by adding a minimal anatomy body/part setup.
