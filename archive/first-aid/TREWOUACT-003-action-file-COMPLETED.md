# TREWOUACT-003: Create Treat Wounded Part Action Definition

## Status: ✅ COMPLETED

## Summary
Create the action definition file for `treat_wounded_part` - a chance-based action that allows actors with medicine skill to treat wounds on other actors.

## Files to Touch
- `data/mods/first-aid/actions/treat_wounded_part.action.json` (CREATE)

## Out of Scope
- DO NOT modify any existing action files
- DO NOT modify the scope file (that's TREWOUACT-001)
- DO NOT modify the condition file (that's TREWOUACT-002)
- DO NOT modify the rule file (that's TREWOUACT-004)
- DO NOT create any test files in this ticket
- DO NOT modify any schema files

## Implementation Details

### IMPORTANT: Schema Format Correction
The spec uses `"target"` (singular) but the existing codebase uses `"targets"` (plural). Use the **actual codebase pattern** (`"targets"`), not the spec's format.

### File Content
Create `data/mods/first-aid/actions/treat_wounded_part.action.json`:

**IMPORTANT CORRECTION**: The original spec used `"var": "secondary.components..."` but the codebase pattern (verified in `weapons/actions/strike_target.action.json` and `ModifierContextBuilder.js`) is `"var": "entity.secondary.components..."` with the `entity.` prefix. The context object structure is:
```javascript
{
  entity: {
    actor: { id, components },
    primary: { id, components },
    secondary: { id, components },
    ...
  }
}
```

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "first-aid:treat_wounded_part",
  "name": "Treat Wounded Part",
  "description": "Treat a wound on another actor's body part using medicine skill.",
  "template": "treat {target}'s wound in {woundedBodyPart} ({chance}% chance)",
  "generateCombinations": true,
  "required_components": {
    "actor": ["skills:medicine_skill"]
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
    ]
  },
  "targets": {
    "primary": {
      "scope": "core:actors_in_location",
      "placeholder": "target",
      "description": "Actor whose wound you are treating"
    },
    "secondary": {
      "scope": "first-aid:treatable_target_body_parts",
      "placeholder": "woundedBodyPart",
      "description": "Wounded body part to treat",
      "contextFrom": "primary"
    }
  },
  "visual": {
    "backgroundColor": "#1b5e20",
    "textColor": "#e8f5e9",
    "hoverBackgroundColor": "#2e7d32",
    "hoverTextColor": "#ffffff"
  },
  "chanceBased": {
    "enabled": true,
    "contestType": "fixed_difficulty",
    "fixedDifficulty": 50,
    "formula": "linear",
    "actorSkill": {
      "component": "skills:medicine_skill",
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
    },
    "modifiers": [
      {
        "condition": {
          "logic": {
            "and": [
              { "var": "entity.secondary.components.anatomy:visibility_rules.clothingSlotId" },
              { "!": { "isSlotExposed": ["entity.primary", { "var": "entity.secondary.components.anatomy:visibility_rules.clothingSlotId" }, ["base", "outer", "armor"]] } }
            ]
          }
        },
        "type": "flat",
        "value": -20,
        "tag": "wound is covered by clothing",
        "targetRole": "secondary"
      },
      {
        "condition": {
          "logic": { "!!": { "var": "entity.secondary.components.first-aid:rinsed" } }
        },
        "type": "flat",
        "value": 10,
        "tag": "wound has been rinsed",
        "targetRole": "secondary"
      },
      {
        "condition": {
          "logic": { "!": { "var": "entity.secondary.components.first-aid:rinsed" } }
        },
        "type": "flat",
        "value": -10,
        "tag": "wound has not been rinsed",
        "targetRole": "secondary"
      },
      {
        "condition": {
          "logic": { "!!": { "var": "entity.secondary.components.first-aid:disinfected" } }
        },
        "type": "flat",
        "value": 10,
        "tag": "wound has been disinfected",
        "targetRole": "secondary"
      },
      {
        "condition": {
          "logic": { "!": { "var": "entity.secondary.components.first-aid:disinfected" } }
        },
        "type": "flat",
        "value": -5,
        "tag": "wound has not been disinfected",
        "targetRole": "secondary"
      }
    ]
  }
}
```

### Key Features
1. **Chance-based action** with `fixed_difficulty` contest type (50 base difficulty)
2. **5 modifiers** affecting success chance:
   - -20 if wound covered by clothing
   - +10 if rinsed, -10 if not rinsed
   - +10 if disinfected, -5 if not disinfected
3. **No tertiary target** - unlike disinfect/rinse, this doesn't consume an item
4. Uses `treatable_target_body_parts` scope (created in TREWOUACT-001)
5. Green medical visual theme matching other first-aid actions

## Acceptance Criteria

### Specific Tests That Must Pass
- `npm run validate` must pass with no schema validation errors
- JSON must be valid and parseable
- Action schema validation must pass

### Invariants That Must Remain True
- Existing action files remain unchanged
- No modifications to action.schema.json
- The `isSlotExposed` JSON Logic operator behavior remains unchanged
- The chance-based system behavior remains unchanged

## Verification Steps
1. Run `npm run validate` to check schema validity
2. Run `node -e "JSON.parse(require('fs').readFileSync('./data/mods/first-aid/actions/treat_wounded_part.action.json'))"` to verify JSON parsing
3. Compare structure with `data/mods/weapons/actions/strike_target.action.json` for chance-based pattern
4. Compare structure with `data/mods/first-aid/actions/disinfect_wounded_part.action.json` for first-aid pattern

## Dependencies
- TREWOUACT-001 (scope file must exist for action to reference)

## Estimated Complexity
Medium - complex JSON structure with chance-based modifiers

## Outcome

### What Was Actually Changed vs Originally Planned

**Discrepancy Found & Corrected:**
The original ticket/spec used `"var": "secondary.components..."` for modifier condition paths, but codebase analysis revealed the actual pattern is `"var": "entity.secondary.components..."` (with the `entity.` prefix). This was verified by examining:
- `weapons/actions/strike_target.action.json` - uses `entity.secondary.components.positioning:fallen`
- `src/combat/services/ModifierContextBuilder.js` - builds context with `entity.actor`, `entity.primary`, `entity.secondary`, etc.

**Corrections Applied:**
1. Updated all `var` paths in modifiers from `secondary.components.*` to `entity.secondary.components.*`
2. Updated `isSlotExposed` first parameter from `"primary"` to `"entity.primary"` to match entity path resolution

**Files Created:**
- `data/mods/first-aid/actions/treat_wounded_part.action.json` (100 lines)

**Validation Results:**
- ✅ `npm run validate` passed (first-aid mod has 0 violations)
- ✅ `npm run scope:lint` passed (136 scope files valid)
- ✅ JSON syntax validated
- ✅ All existing first-aid integration tests pass (9 tests)
