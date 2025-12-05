# DATDRIMODSYS-008: Add Modifiers to Example Action

## Summary

Migrate the `restrain_target` action to use the new data-driven modifier system. This serves as the reference implementation and validates the complete system works end-to-end.

## File List

Files to modify:
- `data/mods/physical-control/actions/restrain_target.action.json`

## Out of Scope

- **DO NOT** modify any source files
- **DO NOT** modify other action files (those can be migrated later)
- **DO NOT** modify any schema files
- **DO NOT** create new test files (covered in DATDRIMODSYS-006/007)

## Detailed Implementation

### Current State

The `restrain_target.action.json` currently has a basic `chanceBased` configuration without modifiers:

```json
{
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": {
      "component": "skills:grappling_skill",
      "property": "value",
      "default": 10
    },
    "targetSkill": {
      "component": "skills:defense_skill",
      "property": "value",
      "default": 0,
      "targetRole": "primary"
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

### Target State

Add a `modifiers` array to the `chanceBased` configuration:

```json
{
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": {
      "component": "skills:grappling_skill",
      "property": "value",
      "default": 10
    },
    "targetSkill": {
      "component": "skills:defense_skill",
      "property": "value",
      "default": 0,
      "targetRole": "primary"
    },
    "formula": "ratio",
    "bounds": {
      "min": 5,
      "max": 95
    },
    "outcomes": {
      "criticalSuccessThreshold": 5,
      "criticalFailureThreshold": 95
    },
    "modifiers": [
      {
        "condition": {
          "logic": {
            "!!": [{ "var": "entity.primary.components.positioning:prone" }]
          }
        },
        "value": 15,
        "type": "flat",
        "tag": "target prone",
        "targetRole": "primary",
        "description": "Easier to restrain a prone target"
      },
      {
        "condition": {
          "logic": {
            "!!": [{ "var": "entity.primary.components.positioning:being_restrained" }]
          }
        },
        "value": 25,
        "type": "flat",
        "tag": "already restrained",
        "targetRole": "primary",
        "description": "Much easier to fully restrain an already partially restrained target"
      },
      {
        "condition": {
          "logic": {
            ">": [
              { "var": "entity.actor.components.skills:grappling_skill.value" },
              { "var": "entity.primary.components.skills:defense_skill.value" }
            ]
          }
        },
        "value": 10,
        "type": "flat",
        "tag": "skill advantage",
        "description": "Bonus when actor's grappling exceeds target's defense"
      },
      {
        "condition": {
          "logic": {
            "==": [
              { "var": "entity.location.components.environment:lighting.level" },
              "dark"
            ]
          }
        },
        "value": -15,
        "type": "flat",
        "tag": "darkness",
        "targetRole": "location",
        "description": "Harder to grapple in complete darkness"
      }
    ]
  }
}
```

### Complete Updated File

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "physical-control:restrain_target",
  "name": "Restrain Target",
  "description": "Attempt to physically restrain a target, preventing free movement.",
  "template": "restrain {target} ({chance}% chance)",
  "generateCombinations": true,
  "required_components": {
    "actor": [
      "skills:grappling_skill"
    ]
  },
  "forbidden_components": {
    "actor": [
      "positioning:being_restrained",
      "positioning:fallen"
    ],
    "primary": [
      "positioning:being_restrained"
    ]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-two-free-grabbing-appendages"
      },
      "failure_message": "You need two free grabbing appendages to restrain someone."
    }
  ],
  "targets": {
    "primary": {
      "scope": "core:actors_in_location",
      "placeholder": "target",
      "description": "Actor to restrain"
    }
  },
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": {
      "component": "skills:grappling_skill",
      "property": "value",
      "default": 10
    },
    "targetSkill": {
      "component": "skills:defense_skill",
      "property": "value",
      "default": 0,
      "targetRole": "primary"
    },
    "formula": "ratio",
    "bounds": {
      "min": 5,
      "max": 95
    },
    "outcomes": {
      "criticalSuccessThreshold": 5,
      "criticalFailureThreshold": 95
    },
    "modifiers": [
      {
        "condition": {
          "logic": {
            "!!": [{ "var": "entity.primary.components.positioning:prone" }]
          }
        },
        "value": 15,
        "type": "flat",
        "tag": "target prone",
        "targetRole": "primary",
        "description": "Easier to restrain a prone target"
      },
      {
        "condition": {
          "logic": {
            "!!": [{ "var": "entity.primary.components.positioning:being_restrained" }]
          }
        },
        "value": 25,
        "type": "flat",
        "tag": "already restrained",
        "targetRole": "primary",
        "description": "Much easier to fully restrain an already partially restrained target"
      },
      {
        "condition": {
          "logic": {
            ">": [
              { "var": "entity.actor.components.skills:grappling_skill.value" },
              { "var": "entity.primary.components.skills:defense_skill.value" }
            ]
          }
        },
        "value": 10,
        "type": "flat",
        "tag": "skill advantage",
        "description": "Bonus when actor's grappling exceeds target's defense"
      },
      {
        "condition": {
          "logic": {
            "==": [
              { "var": "entity.location.components.environment:lighting.level" },
              "dark"
            ]
          }
        },
        "value": -15,
        "type": "flat",
        "tag": "darkness",
        "targetRole": "location",
        "description": "Harder to grapple in complete darkness"
      }
    ]
  },
  "visual": {
    "backgroundColor": "#2f2f2f",
    "textColor": "#f8f9fa",
    "hoverBackgroundColor": "#3f3d56",
    "hoverTextColor": "#f8f9ff"
  }
}
```

## Modifier Design Rationale

| Modifier | Value | Type | Rationale |
|----------|-------|------|-----------|
| Target prone | +15 | flat | Prone targets are significantly easier to grapple |
| Already restrained | +25 | flat | Completing a restraint on partial grip is much easier |
| Skill advantage | +10 | flat | Skilled grapplers get a bonus vs weaker defenders |
| Darkness | -15 | flat | Hard to grapple what you can't see |

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**:
   - `npm run validate` must pass
   - `npm run validate:mod:physical-control` must pass (if available)

2. **Action Loading**:
   - Action must load without errors at game startup
   - Action must appear in available actions for qualified actors

3. **Functional Tests**:
   - Manual test: Verify tags appear when conditions are met
   - Manual test: Verify chance changes based on modifiers
   - Integration tests from DATDRIMODSYS-007 must pass

### Invariants That Must Remain True

1. **Backward Compatibility**:
   - Action must continue to work if no modifiers apply
   - Base chance calculation must be unchanged when no modifiers active
   - Existing rules referencing this action must continue to work

2. **Display Format**:
   - Tags must appear in square brackets after chance percentage
   - Multiple tags must be space-separated
   - Tags must not exceed 30 characters each

3. **Balance**:
   - Combined modifiers should not push chance outside bounds (5-95%)
   - Modifiers should be reasonable and playtested

## Verification Commands

```bash
# Validate schemas
npm run validate

# Validate specific mod
npm run validate:mod:physical-control

# Run integration tests
npm run test:integration -- --testPathPattern="physical-control" --silent

# Start game and manually verify
npm run dev
```

## Manual Testing Checklist

1. [ ] Start game with test character having `skills:grappling_skill`
2. [ ] Verify `restrain target` action appears for valid targets
3. [ ] Test with standing target - verify no modifier tags shown
4. [ ] Test with prone target - verify `[target prone]` tag appears
5. [ ] Verify chance percentage is higher for prone target
6. [ ] Test in dark location - verify `[darkness]` tag appears
7. [ ] Verify chance percentage is lower in darkness
8. [ ] Test with multiple modifiers - verify all applicable tags shown

## Dependencies

- **Depends on**: DATDRIMODSYS-001 through DATDRIMODSYS-005 (all implementation must be complete)
- **Blocks**: None (this completes the implementation)

## Future Migration Candidates

After this reference implementation is validated, similar modifiers can be added to:

- `physical-control:break_free_from_restraint` - add modifiers for restrainer distracted, ally helping
- `weapons:swing_at_target` - add modifiers for flanking, high ground, target prone
- `weapons:thrust_at_target` - similar weapon modifiers
- `ranged:throw_item_at_target` - add modifiers for range, visibility, moving target

## Notes

- The `positioning:prone` and `positioning:being_restrained` components must exist in the schema
- The `environment:lighting` component must exist for the darkness modifier to work
- If components don't exist, those modifiers simply won't activate (graceful degradation)
- The `forbidden_components.primary` already prevents using on fully restrained targets, so the "already restrained" modifier applies to partial restraint scenarios
