# Ticket: WARMOD-003 - Rule: Handle Draw Salt Boundary

## Goal
Implement the rule that handles the outcome of the `draw_salt_boundary` action.

## Files to Create/Modify
- `data/mods/warding/rules/handle_draw_salt_boundary.rule.json` (New)

## Out of Scope
- Action definition
- Component creation

## Acceptance Criteria

### `handle_draw_salt_boundary.rule.json`
- **Path**: `data/mods/warding/rules/handle_draw_salt_boundary.rule.json`
- **Event**: `core:attempt_action`
- **Condition**: Event type is `warding:draw_salt_boundary`

### Outcomes
1.  **CRITICAL_SUCCESS**:
    - Message: `{actor} draws a perfect salt boundary around the corrupted target {target}.`
    - Log: Same as message.
2.  **SUCCESS**:
    - Message: `{actor} draws a correct salt boundary around the corrupted target {target}.`
    - Log: Same as message.
3.  **FAILURE**:
    - Message: `{actor} fails at drawing a salt boundary around the corrupted target {target}. The boundary will need to be redone.`
    - Log: Same as message.
4.  **FUMBLE**:
    - Message: `{actor} tries to draw a salt boundary around the corrupted target {target} in a hurry, but slips and falls to the ground.`
    - Log: Same as message.
    - **Effects**:
        - Add `positioning:fallen` component to actor.
        - Trigger `REGENERATE_DESCRIPTION` for actor.

## Verification
- Run `npm run validate:ecosystem` to ensure the rule is valid.
