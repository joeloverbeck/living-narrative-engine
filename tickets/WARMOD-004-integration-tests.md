# Ticket: WARMOD-004 - Integration Tests

## Goal
Create integration tests to verify the Warding mod functionality, including action discovery and rule execution.

## Files to Create/Modify
- `tests/integration/mods/warding/draw_salt_boundary_action_discovery.test.js` (New)
- `tests/integration/mods/warding/draw_salt_boundary_rule.test.js` (New)

## Out of Scope
- Mod implementation (data files)

## Acceptance Criteria

### `draw_salt_boundary_action_discovery.test.js`
- **Test Case 1**: Action appears when actor has `warding_skill` and target has `corrupted`.
- **Test Case 2**: Action does NOT appear if actor lacks `warding_skill`.
- **Test Case 3**: Action does NOT appear if target lacks `corrupted`.
- **Mocking**: Mock scope resolution if necessary, similar to `restrain_target` tests.

### `draw_salt_boundary_rule.test.js`
- **Test Case 1**: Verify CRITICAL_SUCCESS outcome (message).
- **Test Case 2**: Verify SUCCESS outcome (message).
- **Test Case 3**: Verify FAILURE outcome (message).
- **Test Case 4**: Verify FUMBLE outcome:
    - Message is correct.
    - `positioning:fallen` is applied to actor.
    - Description regeneration is triggered (if testable/observable).

## Verification
- Run `npm run test:integration` to ensure all tests pass.
