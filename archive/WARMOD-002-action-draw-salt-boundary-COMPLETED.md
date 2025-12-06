# Ticket: WARMOD-002 - Action: Draw Salt Boundary

**Status: ✅ COMPLETED**

## Goal

Implement the `draw_salt_boundary` action and its associated scope.

## Files to Create/Modify

- `data/mods/warding/actions/draw_salt_boundary.action.json` (New)
- `data/mods/warding/scopes/corrupted_actors.scope` (New - note: `.scope` extension, not `.scope.json`)
- `data/mods/warding/conditions/entity-has-corrupted-component.condition.json` (New)
- `data/mods/warding/mod-manifest.json` (Update - add new content entries)

## Out of Scope

- Component creation (verified: `warding:corrupted` and `skills:warding_skill` already exist)
- Rule creation (handling the outcome)

## Assumptions Validated

- ✅ `warding:corrupted` component exists at `data/mods/warding/components/corrupted.component.json`
- ✅ `skills:warding_skill` component exists at `data/mods/skills/components/warding_skill.component.json`
- ✅ Warding mod manifest exists at `data/mods/warding/mod-manifest.json`
- ⚠️ Scope files use `.scope` extension (not `.scope.json` as originally assumed)
- ⚠️ `chanceBased.actorSkill` requires object format with `component`, `property`, `default` fields

## Acceptance Criteria

### `entity-has-corrupted-component.condition.json`

- **Path**: `data/mods/warding/conditions/entity-has-corrupted-component.condition.json`
- **Logic**: Checks if the entity has the `warding:corrupted` component
- **ID**: `warding:entity-has-corrupted-component`

### `corrupted_actors.scope`

- **Path**: `data/mods/warding/scopes/corrupted_actors.scope`
- **Logic**: Selects actors in the current location who possess the `warding:corrupted` component.
- **ID**: `warding:corrupted_actors`

### `draw_salt_boundary.action.json`

- **Path**: `data/mods/warding/actions/draw_salt_boundary.action.json`
- **Template**: `draw salt boundary around {target} ({chance}% chance)`
- **Requirements**:
  - Actor must have `skills:warding_skill`.
  - Target must have `warding:corrupted` (enforced via scope).
- **Mechanics** (full schema-compliant format):
  ```json
  "chanceBased": {
    "enabled": true,
    "contestType": "fixed_difficulty",
    "fixedDifficulty": 50,
    "formula": "linear",
    "actorSkill": {
      "component": "skills:warding_skill",
      "property": "value",
      "default": 10
    },
    "bounds": {
      "min": 5,
      "max": 95
    },
    "outcomes": {
      "criticalSuccessThreshold": 5,
      "criticalFailureThreshold": 95
    }
  }
  ```
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

## Outcome

### What was changed vs originally planned

**Originally planned:**

- Create `corrupted_actors.scope.json` (assumed `.json` extension)
- Create `draw_salt_boundary.action.json` with simplified `actorSkill` format

**Actually implemented:**

- Created `corrupted_actors.scope` (corrected to `.scope` extension per codebase conventions)
- Created `entity-has-corrupted-component.condition.json` (new - required by scope for component check)
- Created `draw_salt_boundary.action.json` with full schema-compliant `actorSkill` object format
- Updated `mod-manifest.json` to register all new content

### Files created/modified:

1. `data/mods/warding/conditions/entity-has-corrupted-component.condition.json` - New condition for checking corrupted component
2. `data/mods/warding/scopes/corrupted_actors.scope` - New scope for finding corrupted actors in location
3. `data/mods/warding/actions/draw_salt_boundary.action.json` - New action with chance-based mechanics
4. `data/mods/warding/mod-manifest.json` - Updated to include new conditions, scopes, and actions

### Tests created:

- `tests/integration/mods/warding/draw_salt_boundary_action_discovery.test.js`
  - 10 passing tests covering action structure and discovery scenarios

### Validation:

- ✅ `npm run validate:ecosystem` - PASSED
- ✅ `npm run scope:lint` - 113 scope files valid
- ✅ All 10 integration tests pass
