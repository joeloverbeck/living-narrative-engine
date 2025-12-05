# BEAATTCAP-004: Create peck_target Action and Condition Definition

## Summary

Create the `violence:peck_target` action definition and its corresponding `violence:event-is-action-peck-target` condition. This enables creatures with beaks to perform peck attacks.

## Motivation

This ticket defines the peck attack action following the established patterns from `weapons:strike_target` and `weapons:thrust_at_target`, adapted for natural weapons (beaks).

## Files to Touch

| File | Change Type |
|------|-------------|
| `data/mods/violence/actions/peck_target.action.json` | **Create** |
| `data/mods/violence/conditions/event-is-action-peck-target.condition.json` | **Create** |

## Out of Scope

- **DO NOT** modify existing action files
- **DO NOT** change existing condition files
- **DO NOT** modify schema files
- **DO NOT** create rule or macro files (separate tickets)
- **DO NOT** add new skills (skill system is separate concern)

## Implementation Details

### 1. Action Definition

**File**: `data/mods/violence/actions/peck_target.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "violence:peck_target",
  "name": "Peck Target",
  "description": "Peck at a target with your beak",
  "template": "peck {target} with {weapon} ({chance}% chance)",
  "generateCombinations": true,
  "required_components": {
    "primary": ["damage-types:damage_capabilities"]
  },
  "forbidden_components": {
    "actor": [
      "positioning:hugging",
      "positioning:giving_blowjob",
      "positioning:doing_complex_performance",
      "positioning:bending_over",
      "positioning:being_restrained",
      "positioning:restraining",
      "positioning:fallen"
    ],
    "secondary": ["core:dead"]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "violence:actor-has-beak"
      },
      "failure_message": "You need a beak to peck."
    }
  ],
  "targets": {
    "primary": {
      "scope": "violence:actor_beak_body_parts",
      "placeholder": "weapon",
      "description": "Beak to peck with"
    },
    "secondary": {
      "scope": "core:actors_in_location",
      "placeholder": "target",
      "description": "Target to attack"
    }
  },
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": {
      "component": "skills:melee_skill",
      "property": "value",
      "default": 10
    },
    "targetSkill": {
      "component": "skills:defense_skill",
      "property": "value",
      "default": 0,
      "targetRole": "secondary"
    },
    "formula": "ratio",
    "bounds": { "min": 5, "max": 95 },
    "outcomes": {
      "criticalSuccessThreshold": 5,
      "criticalFailureThreshold": 95
    }
  },
  "visual": {
    "backgroundColor": "#8b0000",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#b71c1c",
    "hoverTextColor": "#ffebee"
  }
}
```

**Key Design Decisions**:
- Uses `skills:melee_skill` as fallback (no dedicated beak skill yet)
- Same visual scheme as other violence actions (dark red)
- Requires `damage-types:damage_capabilities` on primary (the beak)
- Forbids dead targets
- Template matches existing weapon attack patterns

### 2. Condition Definition

**File**: `data/mods/violence/conditions/event-is-action-peck-target.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "violence:event-is-action-peck-target",
  "description": "Checks if the event is a peck_target action attempt",
  "condition": {
    "and": [
      { "==": [{ "var": "event.type" }, "core:attempt_action"] },
      { "==": [{ "var": "event.payload.actionId" }, "violence:peck_target"] }
    ]
  }
}
```

### 3. Actor Has Beak Condition (Prerequisite)

**File**: `data/mods/violence/conditions/actor-has-beak.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "violence:actor-has-beak",
  "description": "Checks if actor has a body part with subType containing 'beak'",
  "condition": {
    "hasPartSubTypeContaining": ["actor", "beak"]
  }
}
```

**Note**: This condition uses the operator from BEAATTCAP-002.

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**:
   ```bash
   npm run validate:mod:violence
   ```

2. **Action Schema Compliance**:
   - Action has all required fields
   - `targets.primary.scope` references valid scope
   - `targets.secondary.scope` references valid scope
   - `chanceBased` structure matches schema
   - `visual` structure matches schema

3. **Condition Schema Compliance**:
   - Condition has valid JSON Logic structure
   - References correct event type

4. **Unit Tests** (create `tests/unit/mods/violence/peckTargetAction.test.js`):
   ```javascript
   describe('violence:peck_target action definition', () => {
     it('should have valid schema structure');
     it('should require damage_capabilities on primary target');
     it('should forbid dead secondary targets');
     it('should use actor_beak_body_parts scope for primary');
     it('should use actors_in_location scope for secondary');
   });
   ```

### Invariants That Must Remain True

1. **No Schema Changes**: Action/condition schemas remain unchanged
2. **Existing Actions Unaffected**: Other violence actions continue to work
3. **Event Type Consistency**: Uses standard `core:attempt_action` event type
4. **Visual Consistency**: Matches violence mod color scheme

## Verification Commands

```bash
# Validate violence mod
npm run validate:mod:violence

# Validate all mods
npm run validate

# Run action-related tests
npm run test:unit -- --testPathPattern="violence" --silent

# Lint ESLint on any JS test files created
npx eslint tests/unit/mods/violence/
```

## Dependencies

- BEAATTCAP-002 (operator for actor-has-beak condition)
- BEAATTCAP-003 (scope for primary target resolution)

## Blocked By

- BEAATTCAP-003 (needs `violence:actor_beak_body_parts` scope to exist)

## Blocks

- BEAATTCAP-006 (rule needs action and condition)
- BEAATTCAP-007 (tests need action to exist)

## Notes

The action uses existing skill components (`skills:melee_skill`, `skills:defense_skill`) as the spec notes that a dedicated `combat:beak_fighting` skill may be created separately. This is intentional - the skill system is outside the scope of beak attack capability.
