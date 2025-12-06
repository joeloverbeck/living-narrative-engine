# NONDETACTSYS-013: Create swing_at_target Action Definition

**Status**: ✅ COMPLETED

## Summary

Create the `swing_at_target` action definition that uses the non-deterministic action system. This action allows an actor to swing a cutting weapon at a target, with success probability based on melee skill vs defense skill.

## Files to Create

| File                                                                          | Purpose                  |
| ----------------------------------------------------------------------------- | ------------------------ |
| `data/mods/weapons/actions/swing_at_target.action.json`                       | Action definition        |
| `data/mods/weapons/conditions/event-is-action-swing-at-target.condition.json` | Event matching condition |

## Files to Modify

| File                                  | Change                                                     |
| ------------------------------------- | ---------------------------------------------------------- |
| `data/mods/weapons/mod-manifest.json` | Add action, condition, fix missing scope, add dependencies |

## Implementation Details

### swing_at_target.action.json

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:swing_at_target",
  "name": "Swing at Target",
  "description": "Swing a cutting weapon at a target",
  "template": "swing {weapon} at {target} ({chance}%)",
  "generateCombinations": true,
  "required_components": {
    "actor": ["positioning:wielding"],
    "primary": ["weapons:weapon", "damage-types:can_cut"]
  },
  "targets": {
    "primary": {
      "scope": "weapons:wielded_cutting_weapons",
      "placeholder": "weapon",
      "description": "Weapon to swing"
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
      "default": 0
    },
    "formula": "ratio",
    "bounds": {
      "min": 5,
      "max": 95
    },
    "outcomes": {
      "criticalSuccessThreshold": 5,
      "criticalFailureThreshold": 95
    }
  }
}
```

### event-is-action-swing-at-target.condition.json

Uses the correct JSON Logic format (matching existing pattern from `event-is-action-wield-threateningly.condition.json`):

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "weapons:event-is-action-swing-at-target",
  "description": "Checks if the event is a swing_at_target action attempt",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "weapons:swing_at_target"]
  }
}
```

### Action Properties Explanation

| Property                          | Value                                    | Explanation                                 |
| --------------------------------- | ---------------------------------------- | ------------------------------------------- |
| `id`                              | `weapons:swing_at_target`                | Namespaced action ID                        |
| `template`                        | `swing {weapon} at {target} ({chance}%)` | Display template with chance                |
| `generateCombinations`            | `true`                                   | Creates action for each weapon+target combo |
| `required_components.actor`       | `positioning:wielding`                   | Actor must be wielding something            |
| `required_components.primary`     | `weapons:weapon, damage-types:can_cut`   | Weapon must be cutting                      |
| `targets.primary.scope`           | `weapons:wielded_cutting_weapons`        | Cutting weapons actor is wielding           |
| `targets.secondary.scope`         | `core:actors_in_location`                | Other actors in same location               |
| `chanceBased.actorSkill.default`  | `10`                                     | Base skill for untrained actors             |
| `chanceBased.targetSkill.default` | `0`                                      | Targets without defense have no bonus       |

## Out of Scope

- **DO NOT** create the rule file (NONDETACTSYS-014)
- **DO NOT** modify weapon entities (NONDETACTSYS-015)
- **DO NOT** modify any schemas
- **DO NOT** modify any services

## Acceptance Criteria

### Tests That Must Pass

```bash
# Validate action schema
npm run validate

# Validate specific action
npm run validate:mod:weapons

# Full validation
npm run test:ci
```

### Manual Verification Checklist

1. [ ] Action appears in action list when actor wields a cutting weapon
2. [ ] Action shows `{weapon}` replaced with weapon name
3. [ ] Action shows `{target}` replaced with target name
4. [ ] Action shows `({chance}%)` with calculated probability
5. [ ] Action does NOT appear when wielding non-cutting weapon
6. [ ] Action does NOT appear when not wielding anything

### Invariants That Must Remain True

- [x] Action JSON passes schema validation
- [x] Condition JSON passes schema validation
- [x] All referenced scopes exist
- [x] All referenced components exist
- [x] Action ID follows namespace convention
- [x] Template placeholders match target definitions
- [x] Mod manifest updated with new files

## Dependencies

- **Depends on**:
  - NONDETACTSYS-001 (skills mod for skill components)
  - NONDETACTSYS-002 (damage-types mod for can_cut)
  - NONDETACTSYS-009 (action schema with chanceBased)
  - NONDETACTSYS-012 (wielded_cutting_weapons scope)
- **Blocked by**: NONDETACTSYS-001, 002, 009, 012
- **Blocks**: NONDETACTSYS-014 (rule needs action to handle)

## Reference Files

| File                                                                              | Purpose                               |
| --------------------------------------------------------------------------------- | ------------------------------------- |
| `data/mods/weapons/actions/wield_threateningly.action.json`                       | Action pattern reference              |
| `data/mods/weapons/conditions/event-is-action-wield-threateningly.condition.json` | Condition pattern (JSON Logic format) |

## Corrections Made During Implementation

The following discrepancies were found and corrected:

1. **Scope name**: Changed `core:other_actors_in_location` → `core:actors_in_location` (actual scope name)
2. **Condition format**: Changed `operator`/`conditions` format → `logic` JSON Logic format (matches existing patterns)
3. **Mod manifest**: Added missing `wielded_cutting_weapons.scope` registration (bug from NONDETACTSYS-012)
4. **Dependencies**: Added `skills` and `damage-types` mod dependencies to weapons manifest

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**

- Create action file with `core:other_actors_in_location` scope
- Create condition file with `operator`/`conditions` format
- Update mod-manifest.json with action and condition

**Actual Changes:**

- Created action file with correct `core:actors_in_location` scope
- Created condition file using JSON Logic format (matching existing patterns)
- Updated mod-manifest.json:
  - Added `skills` and `damage-types` dependencies (were missing)
  - Added `wielded_cutting_weapons.scope` registration (was missing from NONDETACTSYS-012)
  - Added action and condition files

**New Tests Added:**

- `tests/integration/mods/weapons/swing_at_target_action_discovery.test.js` (33 tests)
  - Tests action structure (6 tests)
  - Tests required components (3 tests)
  - Tests target configuration (8 tests)
  - Tests chanceBased configuration (9 tests)
  - Tests schema compliance (2 tests)
  - Tests condition structure (5 tests)

**Test Results:**

- All 33 new tests pass
- All 160 weapons mod tests pass (14 test suites)
