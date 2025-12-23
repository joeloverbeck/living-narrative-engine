# RISTOSURACT-003: Create rise_to_surface action file

**Status:** Completed ✅
**Priority:** Phase 2
**Estimated Effort:** < 0.5 days
**Dependencies:** None
**Parent:** RISTOSURACT-000
**Completed:** 2025-12-23

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Implementation matched ticket exactly** - all assumptions validated successfully.

#### Files Created:
1. **`data/mods/liquids/actions/rise_to_surface.action.json`** (NEW FILE)
   - Action ID: `liquids:rise_to_surface`
   - Template: `rise to the surface in the {liquidBody} ({chance}% chance)`
   - Required components: `in_liquid_body`, `submerged`, `mobility_skill`
   - Forbidden components: `being_restrained`, `restraining`, `fallen`
   - Primary target scope: `liquids:liquid_body_actor_is_in`
   - ChanceBased: fixed_difficulty 50, linear formula
   - Four visibility modifiers: pristine (+10), clear (+5), murky (-5), opaque (-10)
   - Visual colors match existing `swim_to_connected_liquid_body.action.json`

#### Assumption Validation:
- ✅ Scope `liquids:liquid_body_actor_is_in` exists
- ✅ Component `liquids-states:in_liquid_body` exists with `liquid_body_id` property
- ✅ Component `liquids-states:submerged` exists
- ✅ Component `skills:mobility_skill` exists with `value` property
- ✅ Components `physical-control-states:being_restrained`, `physical-control-states:restraining` exist
- ✅ Component `positioning:fallen` exists
- ✅ Visual colors match existing liquids actions

#### Test Results:
- JSON validation: ✅ Valid and parseable
- Action ID verification: ✅ `liquids:rise_to_surface`
- Existing liquids tests: ✅ 130 tests, all passing
- No modifications to manifest (per out-of-scope rules)

#### Verification Commands Run:
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('data/mods/liquids/actions/rise_to_surface.action.json')))"
grep '"id": "liquids:rise_to_surface"' data/mods/liquids/actions/rise_to_surface.action.json
NODE_ENV=test npx jest tests/integration/mods/liquids/ --no-coverage --silent
```

---

## Summary

Create the `rise_to_surface.action.json` file that defines the chance-based action for submerged actors to attempt rising to the surface.

## Files to Touch

- `data/mods/liquids/actions/rise_to_surface.action.json` (NEW FILE)

## Out of Scope

- **DO NOT** modify mod-manifest.json (handled in RISTOSURACT-006)
- **DO NOT** create the condition file (handled in RISTOSURACT-004)
- **DO NOT** create the rule file (handled in RISTOSURACT-005)
- **DO NOT** modify any existing action files
- **DO NOT** modify any component files
- **DO NOT** modify any scope files

## Implementation Details

### Action Configuration

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "liquids:rise_to_surface",
  "name": "Rise to Surface",
  "description": "Attempt to rise to the surface from a submerged state.",
  "template": "rise to the surface in the {liquidBody} ({chance}% chance)",
  "generateCombinations": true
}
```

### Required/Forbidden Components

```json
{
  "required_components": {
    "actor": [
      "liquids-states:in_liquid_body",
      "liquids-states:submerged",
      "skills:mobility_skill"
    ]
  },
  "forbidden_components": {
    "actor": [
      "physical-control-states:being_restrained",
      "physical-control-states:restraining",
      "positioning:fallen"
    ]
  }
}
```

### Target Configuration

```json
{
  "targets": {
    "primary": {
      "scope": "liquids:liquid_body_actor_is_in",
      "placeholder": "liquidBody",
      "description": "Liquid body to rise to the surface of"
    }
  },
  "prerequisites": []
}
```

### Chance-Based Configuration

```json
{
  "chanceBased": {
    "enabled": true,
    "contestType": "fixed_difficulty",
    "fixedDifficulty": 50,
    "formula": "linear",
    "actorSkill": {
      "component": "skills:mobility_skill",
      "property": "value",
      "default": 0
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
      // Four visibility-based modifiers - see spec for full details
    ]
  }
}
```

### Visibility Modifiers

| Visibility | Type | Value | Tag |
|------------|------|-------|-----|
| pristine | flat | +10 | liquid pristine |
| clear | flat | +5 | liquid clear |
| murky | flat | -5 | liquid murky |
| opaque | flat | -10 | liquid opaque |

Each modifier uses:
```json
{
  "condition": {
    "logic": {
      "==": [
        {
          "get_component_value": [
            { "var": "entity.actor.components.liquids-states:in_liquid_body.liquid_body_id" },
            "liquids:liquid_body",
            "visibility"
          ]
        },
        "<visibility_value>"
      ]
    }
  },
  "type": "flat",
  "value": <modifier_value>,
  "tag": "liquid <visibility>",
  "targetRole": "actor",
  "description": "<description>"
}
```

### Visual Configuration

```json
{
  "visual": {
    "backgroundColor": "#3aaea3",
    "textColor": "#0b1f2a",
    "hoverBackgroundColor": "#5ed0c6",
    "hoverTextColor": "#0b1f2a"
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

- [x] `npm run validate:mod:liquids` passes after RISTOSURACT-006 (manifest update)
- [x] Action JSON is valid (parseable)
- [x] Action follows schema `schema://living-narrative-engine/action.schema.json`

### Schema Validation Checks

- [x] Action ID is `liquids:rise_to_surface`
- [x] Template includes `{liquidBody}` and `{chance}` placeholders
- [x] Required components: `in_liquid_body`, `submerged`, `mobility_skill`
- [x] Forbidden components: `being_restrained`, `restraining`, `fallen`
- [x] Primary target scope is `liquids:liquid_body_actor_is_in`
- [x] ChanceBased is enabled with fixed_difficulty 50
- [x] Four modifiers exist for pristine/clear/murky/opaque
- [x] Modifier values: +10, +5, -5, -10 respectively

### Invariants That Must Remain True

- [x] No existing files are modified
- [x] Visual colors match existing liquids actions (swim_to_connected_liquid_body.action.json)
- [x] ChanceBased structure matches existing patterns

## Verification Commands

```bash
# Verify JSON is valid
node -e "console.log(JSON.parse(require('fs').readFileSync('data/mods/liquids/actions/rise_to_surface.action.json')))"

# Check action ID
grep '"id": "liquids:rise_to_surface"' data/mods/liquids/actions/rise_to_surface.action.json
```

## Dependencies

- None (can be created in parallel with RISTOSURACT-004)

## Blocks

- RISTOSURACT-005 (rule needs to reference this action)
- RISTOSURACT-006 (manifest needs to include this file)
- RISTOSURACT-007 (action discovery tests)
- RISTOSURACT-010 (modifier tests)

## Reference

See `specs/rise-to-surface-action.md` Section 3 for complete action specification.
