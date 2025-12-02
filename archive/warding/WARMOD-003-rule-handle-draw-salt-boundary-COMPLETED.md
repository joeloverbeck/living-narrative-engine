# Ticket: WARMOD-003 - Rule: Handle Draw Salt Boundary

## Goal
Implement the rule that handles the outcome of the `draw_salt_boundary` action.

## Files to Create/Modify
- `data/mods/warding/conditions/event-is-action-draw-salt-boundary.condition.json` (New) - Required for rule condition_ref
- `data/mods/warding/rules/handle_draw_salt_boundary.rule.json` (New)
- `data/mods/warding/mod-manifest.json` (Modify) - Add rule and condition references

## Out of Scope
- Action definition (already exists)
- Component creation (already exists)

## Assumptions (Reassessed)
- The warding mod exists at `data/mods/warding/`
- The action `warding:draw_salt_boundary` already exists
- The skill component `skills:warding_skill` already exists
- The `positioning:fallen` component already exists in the positioning mod
- The `rules` directory does NOT exist yet - will be created
- A condition file `event-is-action-draw-salt-boundary.condition.json` must be created (following the pattern from physical-control mod)

## Acceptance Criteria

### `event-is-action-draw-salt-boundary.condition.json`
- **Path**: `data/mods/warding/conditions/event-is-action-draw-salt-boundary.condition.json`
- **ID**: `warding:event-is-action-draw-salt-boundary`
- **Logic**: Check if `event.payload.actionId == "warding:draw_salt_boundary"`

### `handle_draw_salt_boundary.rule.json`
- **Path**: `data/mods/warding/rules/handle_draw_salt_boundary.rule.json`
- **Rule ID**: `handle_draw_salt_boundary`
- **Event**: `core:attempt_action`
- **Condition**: Reference to `warding:event-is-action-draw-salt-boundary`
- **Skill Check**: Uses `skills:warding_skill` with `formula: "linear"` (per action definition)
- **Note**: This action uses `fixed_difficulty` contest type with no target skill (difficulty = 50)

### Outcomes
1.  **CRITICAL_SUCCESS**:
    - Message: `{context.actorName} draws a perfect salt boundary around the corrupted target {context.targetName}.`
    - Log: Same as message.
2.  **SUCCESS**:
    - Message: `{context.actorName} draws a correct salt boundary around the corrupted target {context.targetName}.`
    - Log: Same as message.
3.  **FAILURE**:
    - Message: `{context.actorName} fails at drawing a salt boundary around the corrupted target {context.targetName}. The boundary will need to be redone.`
    - Log: Same as message.
4.  **FUMBLE**:
    - Message: `{context.actorName} tries to draw a salt boundary around the corrupted target {context.targetName} in a hurry, but slips and falls to the ground.`
    - Log: Same as message.
    - **Effects**:
        - Add `positioning:fallen` component to actor.
        - Trigger `REGENERATE_DESCRIPTION` for actor.

### `mod-manifest.json` Updates
- Add `"conditions": ["event-is-action-draw-salt-boundary.condition.json"]` to existing conditions array
- Add `"rules": ["handle_draw_salt_boundary.rule.json"]` to content

## Testing Requirements
- Create `tests/integration/mods/warding/draw_salt_boundary_rule.test.js` following the pattern from `restrain_target_rule_validation.test.js`
- Test all 4 outcomes (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE)
- Verify FUMBLE applies `positioning:fallen` and triggers `REGENERATE_DESCRIPTION`
- Verify correct messages are set

## Verification
- Run `npm run validate:ecosystem` to ensure the rule is valid.
- Run integration tests with `NODE_ENV=test npx jest tests/integration/mods/warding/ --no-coverage`

## Status: COMPLETE ✅

## Outcome

### Originally Planned
- Create 1 rule file (`handle_draw_salt_boundary.rule.json`)

### Actually Implemented
1. **Created condition file** `data/mods/warding/conditions/event-is-action-draw-salt-boundary.condition.json`
   - Required for rule's `condition_ref` (discovered during assumption reassessment)

2. **Created rules directory** `data/mods/warding/rules/`
   - Directory did not exist previously

3. **Created rule file** `data/mods/warding/rules/handle_draw_salt_boundary.rule.json`
   - All 4 outcomes: CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE
   - Fixed difficulty contest type (difficulty_modifier: 50, no target skill)
   - FUMBLE adds `positioning:fallen` component and triggers `REGENERATE_DESCRIPTION`

4. **Updated mod-manifest.json**
   - Added condition to conditions array
   - Added rules array with rule file
   - **Added positioning dependency** (fix for cross-reference validation error)

### Discrepancies Found and Corrected
- Original ticket assumed only 1 file needed; actually required:
  - 2 new files (condition + rule)
  - 1 new directory (rules/)
  - 1 modified file (mod-manifest.json)
  - 1 new dependency (positioning mod for `positioning:fallen` component)

### Tests Added
- `tests/integration/mods/warding/draw_salt_boundary_rule.test.js` (9 tests)
  - Rule and condition registration
  - Setup operations (GET_NAME, QUERY_COMPONENT, RESOLVE_OUTCOME)
  - Shared variables for perception/logging
  - All 4 outcome branches with message validation
  - FUMBLE state changes (fallen component, regenerate description)
  - Positioning dependency verification

### Verification
- ✅ All 43 warding tests pass (9 new + 34 existing)
- ✅ Ecosystem validation passes (0 violations)
- ✅ ESLint passes
