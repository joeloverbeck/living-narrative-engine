# GRA001CHABASGRANECACT-005: Create grab_neck_target Action

## Summary
Create the new chance-based `grab_neck_target.action.json` file. This introduces the opposed contest mechanics, prerequisite checking, and conditional modifiers; the legacy `grab_neck` action remains registered until its removal ticket lands.

## Status
Completed

## File List (Files to Touch)

### Files to Create
- `data/mods/grabbing/actions/grab_neck_target.action.json`

### Files to Modify
- `data/mods/grabbing/mod-manifest.json` (register new action to keep validation green)

## Out of Scope

**DO NOT modify or touch:**
- `data/mods/grabbing/actions/grab_neck.action.json` (deleted in separate ticket)
- `data/mods/grabbing/actions/squeeze_neck_with_both_hands.action.json`
- Any rule files
- Any condition files
- Any test files (separate ticket)
- Any files in `data/mods/grabbing-states/`
- Any source code in `src/`

## Implementation Details

### grab_neck_target.action.json Content

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "grabbing:grab_neck_target",
  "name": "Grab Neck",
  "description": "Attempt to grab someone's neck to physically control them",
  "template": "grab {target}'s neck ({chance}% chance)",
  "required_components": {
    "actor": ["personal-space-states:closeness", "skills:melee_skill"]
  },
  "forbidden_components": {
    "actor": [
      "hugging-states:hugging",
      "physical-control-states:being_restrained",
      "physical-control-states:restraining",
      "grabbing-states:grabbing_neck",
      "recovery-states:fallen"
    ],
    "target": [
      "grabbing-states:neck_grabbed",
      "core:dead"
    ]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to grab someone's neck."
    }
  ],
  "targets": "personal-space:close_actors_facing_each_other_or_behind_target",
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": {
      "component": "skills:melee_skill",
      "property": "value",
      "default": 10
    },
    "targetSkill": {
      "component": "skills:mobility_skill",
      "property": "value",
      "default": 0,
      "targetRole": "primary"
    },
    "formula": "ratio",
    "bounds": { "min": 5, "max": 95 },
    "outcomes": {
      "criticalSuccessThreshold": 5,
      "criticalFailureThreshold": 95
    },
    "modifiers": [
      {
        "condition": {
          "logic": {
            "!!": [{ "var": "entity.primary.components.recovery-states:fallen" }]
          }
        },
        "type": "flat",
        "value": 20,
        "tag": "target downed",
        "targetRole": "primary",
        "description": "Bonus for grabbing a fallen target"
      },
      {
        "condition": {
          "logic": {
            "!!": [
              {
                "var": "entity.primary.components.physical-control-states:being_restrained"
              }
            ]
          }
        },
        "type": "flat",
        "value": 15,
        "tag": "target restrained",
        "targetRole": "primary",
        "description": "Bonus for grabbing a restrained target"
      }
    ]
  },
  "visual": {
    "backgroundColor": "#4a4a4a",
    "textColor": "#f5f5f5",
    "hoverBackgroundColor": "#5a5a5a",
    "hoverTextColor": "#ffffff"
  }
}
```

### Key Design Decisions

1. **Action ID**: `grabbing:grab_neck_target` (follows `_target` suffix convention for targeted actions)
2. **Template**: Uses `{chance}%` placeholder for displaying success probability
3. **Prerequisites**: Uses existing `anatomy:actor-has-free-grabbing-appendage` condition
4. **Required Components**: `skills:melee_skill` is required to satisfy dependency validation
5. **Opposed Contest**: `melee_skill` (attack) vs `mobility_skill` (defense)
6. **Target Role**: Uses `primary` target role for opposed skill lookup in legacy single-target actions
7. **Modifiers**: Situational bonuses for downed (+20) or restrained (+15) targets using `entity.primary`
8. **Forbidden Components**: Prevents double-grabbing and invalid states

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` completes without errors
- Action schema validation passes (valid against action.schema.json)
- Action structure matches established chance-based patterns (see `striking:punch_target`)
- Mod manifest registers `grab_neck_target.action.json` to avoid unregistered file warnings

### Invariants That Must Remain True
- Action ID follows `modId:action_name` pattern
- `contestType` is `"opposed"` (not `"simple"`)
- `formula` is `"ratio"` (skill comparison)
- Bounds are 5-95% (never auto-fail or auto-succeed)
- Critical thresholds use 5% and 95%
- Visual styling matches existing grabbing palette
- Prerequisites reference existing anatomy condition (not inline logic)
- Modifier conditions use `entity.primary` paths (schema-compliant)
- Target skill explicitly uses `targetRole: "primary"`
- Old `grab_neck.action.json` is NOT modified (separate deletion ticket)

## Verification Steps

1. File exists: `data/mods/grabbing/actions/grab_neck_target.action.json`
2. JSON is syntactically valid
3. `npm run validate` passes
4. All component references exist (`personal-space-states:closeness`, etc.)
5. All scope references exist (`personal-space:close_actors_facing_each_other_or_behind_target`)
6. Condition reference exists (`anatomy:actor-has-free-grabbing-appendage`)

## Dependencies
- GRA001CHABASGRANECACT-002 (grabbing_neck component must exist for forbidden_components)
- GRA001CHABASGRANECACT-003 (neck_grabbed component must exist for forbidden_components)
- GRA001CHABASGRANECACT-004 (grabbing mod dependencies must include anatomy, skills, recovery-states)

## Blocked By
- GRA001CHABASGRANECACT-002
- GRA001CHABASGRANECACT-003
- GRA001CHABASGRANECACT-004

## Blocks
- GRA001CHABASGRANECACT-006 (condition references this action)
- GRA001CHABASGRANECACT-007 (rule handles this action)
- GRA001CHABASGRANECACT-010 (action discovery tests)

## Outcome
- Added `grab_neck_target.action.json` with schema-compliant modifier paths and explicit target role configuration.
- Registered the new action in `data/mods/grabbing/mod-manifest.json` to satisfy validation while keeping the legacy action listed.
- Required `skills:melee_skill` on the actor to keep the skills dependency discoverable by validation tooling.
