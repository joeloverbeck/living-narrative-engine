# Ticket: WARMOD-002 - Action: Draw Salt Boundary

## Goal
Implement the `draw_salt_boundary` action and its associated scope.

## Files to Create/Modify
- `data/mods/warding/actions/draw_salt_boundary.action.json` (New)
- `data/mods/warding/scopes/corrupted_actors.scope.json` (New)

## Out of Scope
- Component creation (assumed to exist)
- Rule creation (handling the outcome)

## Acceptance Criteria

### `corrupted_actors.scope.json`
- **Path**: `data/mods/warding/scopes/corrupted_actors.scope.json`
- **Logic**: Selects actors in the current location who possess the `warding:corrupted` component.
- **ID**: `warding:corrupted_actors`

### `draw_salt_boundary.action.json`
- **Path**: `data/mods/warding/actions/draw_salt_boundary.action.json`
- **Template**: `draw salt boundary around {target} ({chance}% chance)`
- **Requirements**:
    - Actor must have `skills:warding_skill`.
    - Target must have `warding:corrupted` (enforced via scope).
- **Mechanics**:
    - `enabled`: true
    - `contestType`: `fixed_difficulty`
    - `fixedDifficulty`: 50
    - `formula`: `linear`
    - `actorSkill`: `skills:warding_skill`
- **Visual**:
    - Use "Cool Grey Modern" color scheme:
      ```json
      {
        "backgroundColor": "#424242",
        "textColor": "#fafafa",
        "hoverBackgroundColor": "#616161",
        "hoverTextColor": "#ffffff"
      }
      ```

## Verification
- Run `npm run validate:ecosystem` to ensure the action and scope are valid.
