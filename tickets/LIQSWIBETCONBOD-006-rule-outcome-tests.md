# LIQSWIBETCONBOD-006: Swim Rule Outcome Tests

## Goal
Add tests that validate outcome handling, state updates, and UI/perceptible events for the swim rule.

## File list (expected to touch)
- tests/ (new or updated suites for swim rule outcomes)
- tests/__snapshots__/ (only if snapshot-based expectations are required)

## Out of scope
- Action/scopes/condition definitions.
- Any changes to mod data or core engine code.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --runInBand`
- Any new test files introduced in this ticket

### Invariants that must remain true
- `CRITICAL_SUCCESS` and `SUCCESS` update `liquids-states:in_liquid_body.liquid_body_id` and `core:position.locationId` and invoke `REGENERATE_DESCRIPTION`.
- `FAILURE` and `FUMBLE` leave components unchanged.
- Perceptible event payloads include sense-aware fields and outcome-specific text.
- UI events (`core:display_successful_action_result` / `core:display_failed_action_result`) match the outcome.
- `END_TURN` success flag aligns with the outcome.
