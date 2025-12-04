# THRITEATTAR-003: Create Throw Item at Target Action Definition

## Summary

Create the `ranged:throw_item_at_target` action definition with chance-based mechanics, visual styling, and proper target configuration.

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/ranged/actions/throw_item_at_target.action.json` | Main action definition |

## Implementation Details

### throw_item_at_target.action.json

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "ranged:throw_item_at_target",
  "name": "Throw at Target",
  "description": "Throw a portable item at a target",
  "template": "throw {throwable} at {target} ({chance}% chance)",
  "generateCombinations": true,
  "visual": {
    "backgroundColor": "#2a4a3f",
    "textColor": "#e8f5f0",
    "hoverBackgroundColor": "#3a5f52",
    "hoverTextColor": "#ffffff"
  },
  "required_components": {
    "actor": [],
    "primary": ["items:portable"]
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
      "scope": "ranged:throwable_items",
      "placeholder": "throwable",
      "description": "Item to throw"
    },
    "secondary": {
      "scope": "core:actors_in_location",
      "placeholder": "target",
      "description": "Target to throw at"
    }
  },
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": {
      "component": "skills:ranged_skill",
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

### Visual Styling

Uses the "Archer's Focus" color scheme (Section 15.1 in mod-color-schemes.md):
- Background: `#2a4a3f` (deep forest-olive teal)
- Text: `#e8f5f0` (light mint)
- Hover Background: `#3a5f52` (lighter forest-teal)
- Hover Text: `#ffffff` (pure white)
- Both states exceed WCAG AAA (7:1) contrast ratios

### Key Configuration Details

| Property | Value | Rationale |
|----------|-------|-----------|
| `required_components.actor` | `[]` | No wielding requirement - can throw from inventory |
| `required_components.primary` | `["items:portable"]` | Only portable items can be thrown |
| `actorSkill.component` | `skills:ranged_skill` | Uses ranged skill (not melee) |
| `targetSkill.targetRole` | `secondary` | Defense skill comes from target actor |
| `generateCombinations` | `true` | Generate all item/target combinations |

## Out of Scope

- **DO NOT** modify any existing action definitions
- **DO NOT** modify the action schema
- **DO NOT** create the scope (THRITEATTAR-002)
- **DO NOT** create the condition (THRITEATTAR-004)
- **DO NOT** create the rule (THRITEATTAR-008)
- **DO NOT** create test files (THRITEATTAR-012)

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` completes without errors
2. Action JSON passes schema validation against `action.schema.json`
3. Action is valid JSON (parseable without errors)

### Invariants That Must Remain True

1. All existing actions continue to function correctly
2. Action ID `ranged:throw_item_at_target` is unique across all mods
3. Referenced scopes exist (`ranged:throwable_items`, `core:actors_in_location`)
4. Referenced components exist (all `positioning:*` forbidden components)
5. Visual colors meet WCAG AA (4.5:1) contrast requirements

## Validation Commands

```bash
# Verify JSON is valid
node -e "JSON.parse(require('fs').readFileSync('data/mods/ranged/actions/throw_item_at_target.action.json'))"

# Run project validation
npm run validate
```

## Reference Files

For understanding action patterns:
- `data/mods/weapons/actions/swing_at_target.action.json` - Similar chance-based combat action

## Dependencies

- THRITEATTAR-001 (mod structure must exist)
- THRITEATTAR-002 (scope must exist for action discovery)

## Blocks

- THRITEATTAR-008 (rule references this action)
- THRITEATTAR-012 (integration tests verify this action)

## Outcome

- Created `data/mods/ranged/actions/throw_item_at_target.action.json` as specified.
- Validated JSON and project structure.
- Updated `data/mods/ranged/mod-manifest.json` via `npm run update-manifest` to register the new action file (this was an implicit requirement for validation to pass without warnings about unregistered files).
