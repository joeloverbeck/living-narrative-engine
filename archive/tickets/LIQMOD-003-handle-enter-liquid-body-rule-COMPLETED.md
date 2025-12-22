# LIQMOD-003: Handle Enter Liquid Body Rule

**Status**: Completed
**Priority**: High

## Summary

Implement the rule that handles `liquids:enter_liquid_body`, adds `liquids-states:in_liquid_body`, and dispatches sense-aware perceptible events plus action success messaging. Wire the new rule into the liquids mod manifest and cover it with an integration test (action discovery coverage already exists).

## File List

- `data/mods/liquids/rules/handle_enter_liquid_body.rule.json`
- `data/mods/liquids/mod-manifest.json`
- `tests/integration/mods/liquids/enter_liquid_body_action.test.js`

## Out of Scope

- No edits to action, scope, or condition files.
- No new macros or changes to shared macro libraries.
- No changes to dredgers entities or locations.
- No rules or tests outside the liquids mod scope and its integration coverage.

## Acceptance Criteria

### Specific Tests That Must Pass

- `npm run test:integration -- tests/integration/mods/liquids/enter_liquid_body_action_discovery.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/liquids/enter_liquid_body_action.test.js --runInBand`

### Invariants That Must Remain True

- Rule emits `core:display_successful_action_result`, `core:action_success`, and `END_TURN`.
- Sense-aware perceptible event includes `alternate_descriptions` for auditory perception.
- No changes outside `data/mods/liquids/` and `tests/integration/mods/liquids/`.

## Outcome

- Added the enter-liquid-body rule, wired it into the liquids mod manifest, and covered it with an integration test for action execution (discovery coverage already existed).
- Kept scope limited to the liquids mod and its integration tests; no other mod content or shared macros were touched.
