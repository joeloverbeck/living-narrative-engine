# NONDETACTSYS-013: Create swing_at_target Action Definition

## Summary

Create the `swing_at_target` action definition that uses the non-deterministic action system. This action allows an actor to swing a cutting weapon at a target, with success probability based on melee skill vs defense skill.

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/weapons/actions/swing_at_target.action.json` | Action definition |
| `data/mods/weapons/conditions/event-is-action-swing-at-target.condition.json` | Event matching condition |

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
      "scope": "core:other_actors_in_location",
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

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "weapons:event-is-action-swing-at-target",
  "description": "Checks if the event is a swing_at_target action attempt",
  "operator": "and",
  "conditions": [
    {
      "operator": "equals",
      "value_a": { "source": "event", "path": "type" },
      "value_b": "core:attempt_action"
    },
    {
      "operator": "equals",
      "value_a": { "source": "event", "path": "payload.actionId" },
      "value_b": "weapons:swing_at_target"
    }
  ]
}
```

### Action Properties Explanation

| Property | Value | Explanation |
|----------|-------|-------------|
| `id` | `weapons:swing_at_target` | Namespaced action ID |
| `template` | `swing {weapon} at {target} ({chance}%)` | Display template with chance |
| `generateCombinations` | `true` | Creates action for each weapon+target combo |
| `required_components.actor` | `positioning:wielding` | Actor must be wielding something |
| `required_components.primary` | `weapons:weapon, damage-types:can_cut` | Weapon must be cutting |
| `targets.primary.scope` | `weapons:wielded_cutting_weapons` | Cutting weapons actor is wielding |
| `targets.secondary.scope` | `core:other_actors_in_location` | Other actors in same location |
| `chanceBased.actorSkill.default` | `10` | Base skill for untrained actors |
| `chanceBased.targetSkill.default` | `0` | Targets without defense have no bonus |

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

- [ ] Action JSON passes schema validation
- [ ] Condition JSON passes schema validation
- [ ] All referenced scopes exist
- [ ] All referenced components exist
- [ ] Action ID follows namespace convention
- [ ] Template placeholders match target definitions
- [ ] No modifications to existing files

## Dependencies

- **Depends on**:
  - NONDETACTSYS-001 (skills mod for skill components)
  - NONDETACTSYS-002 (damage-types mod for can_cut)
  - NONDETACTSYS-009 (action schema with chanceBased)
  - NONDETACTSYS-012 (wielded_cutting_weapons scope)
- **Blocked by**: NONDETACTSYS-001, 002, 009, 012
- **Blocks**: NONDETACTSYS-014 (rule needs action to handle)

## Reference Files

| File | Purpose |
|------|---------|
| `data/mods/weapons/actions/wield_weapon.action.json` | Multi-target action pattern |
| `data/mods/positioning/actions/turn_around.action.json` | Simple action pattern |
| `data/mods/weapons/conditions/event-is-action-wield-weapon.condition.json` | Condition pattern |
