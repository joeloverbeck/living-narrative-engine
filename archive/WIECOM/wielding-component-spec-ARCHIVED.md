# Spec: Wielding Component

## Overview

This specification defines the implementation of a `positioning:wielding` component that tracks items being actively wielded by actors in a combat-ready or threatening stance.

## Problem Statement

Currently, when the `wield_threateningly` action executes:

1. No component tracks that the actor is wielding an item
2. No activity description is generated (e.g., "{actor} is wielding a sword")
3. No mechanism exists to gate other actions based on wielding state
4. The rule does not call `REGENERATE_DESCRIPTION`

## Requirements

### Functional Requirements

1. **Component Creation**: When `wield_threateningly` action executes, add `positioning:wielding` component to actor
2. **Array Support**: Component must store multiple wielded item IDs (actors can hold multiple items)
3. **Activity Description**: Generate text like "{actor} is wielding a sword and dagger threateningly"
4. **Description Regeneration**: Rule must call `REGENERATE_DESCRIPTION` after adding component
5. **Future Action Gating**: Component presence can gate other actions (e.g., can't approach while wielding)

### Non-Functional Requirements

1. Follow existing positioning component patterns (`facing_away`, `hugging`)
2. Integrate with activity description system
3. Comprehensive test coverage

## Design Decisions

| Decision          | Choice            | Rationale                                            |
| ----------------- | ----------------- | ---------------------------------------------------- |
| Mod location      | `positioning`     | Wielding is a positional state like sitting/kneeling |
| Schema structure  | Simple array      | No appendage mapping needed for current requirements |
| Activity template | List weapon names | Requires activity system enhancement but better UX   |
| Priority          | 70                | Between hugging (66) and kneeling (75)               |

## Technical Design

### 1. Component Definition

**File**: `data/mods/positioning/components/wielding.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:wielding",
  "description": "Tracks items an actor is actively wielding in a combat-ready or threatening manner. Presence indicates the actor has one or more items in wielding stance.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["wielded_item_ids"],
    "properties": {
      "wielded_item_ids": {
        "type": "array",
        "description": "Entity IDs of items currently being wielded. Order may indicate primary/secondary preference.",
        "uniqueItems": true,
        "default": [],
        "items": {
          "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
        }
      },
      "activityMetadata": {
        "type": "object",
        "description": "Inline metadata for activity description generation.",
        "additionalProperties": false,
        "properties": {
          "shouldDescribeInActivity": {
            "type": "boolean",
            "default": true,
            "description": "Whether this component should be included in activity descriptions."
          },
          "template": {
            "type": "string",
            "default": "{actor} is wielding {targets} threateningly",
            "description": "Template with {targets} placeholder for multiple item names."
          },
          "targetRole": {
            "type": "string",
            "default": "wielded_item_ids",
            "description": "Property containing target entity IDs."
          },
          "targetRoleIsArray": {
            "type": "boolean",
            "default": true,
            "description": "Signals that targetRole points to an array, enabling list formatting."
          },
          "priority": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "default": 70,
            "description": "Display priority for activity ordering. 70 = active combat stance."
          }
        }
      }
    }
  }
}
```

### 2. Rule Modification

**File**: `data/mods/weapons/rules/handle_wield_threateningly.rule.json`

The rule must be updated to add the following operations after getting names/position:

```json
{
  "type": "QUERY_COMPONENT",
  "comment": "Check if actor already has wielding component",
  "parameters": {
    "entity_ref": "actor",
    "component_type": "positioning:wielding",
    "result_variable": "existingWielding",
    "missing_value": null
  }
},
{
  "type": "IF",
  "comment": "Add to existing array or create new component",
  "parameters": {
    "condition": { "var": "context.existingWielding" },
    "then_actions": [
      {
        "type": "MODIFY_ARRAY_FIELD",
        "comment": "Append weapon to existing wielded_item_ids array",
        "parameters": {
          "entity_ref": "actor",
          "component_type": "positioning:wielding",
          "field": "wielded_item_ids",
          "mode": "push_unique",
          "value": "{event.payload.targetId}"
        }
      }
    ],
    "else_actions": [
      {
        "type": "ADD_COMPONENT",
        "comment": "Create new wielding component with weapon in array",
        "parameters": {
          "entity_ref": "actor",
          "component_type": "positioning:wielding",
          "value": {
            "wielded_item_ids": ["{event.payload.targetId}"]
          }
        }
      }
    ]
  }
},
{
  "type": "REGENERATE_DESCRIPTION",
  "comment": "Update actor description to include wielding activity",
  "parameters": { "entity_ref": "actor" }
}
```

### 3. Manifest Update

**File**: `data/mods/positioning/mod-manifest.json`

Add to the `content.components` array (maintain alphabetical order):

```json
"wielding.component.json"
```

### 4. Activity System Enhancement

**File**: `src/anatomy/services/activityMetadataCollectionSystem.js`

Modify `#parseInlineMetadata` method to handle array targets:

```javascript
// Current (line ~298):
const rawTargetEntityId = componentData?.[targetRole];
if (typeof rawTargetEntityId === 'string') {
  // ... handles single target
}

// Enhanced:
const rawTargetValue = componentData?.[targetRole];
const isArrayTarget = activityMetadata?.targetRoleIsArray === true;

if (isArrayTarget && Array.isArray(rawTargetValue)) {
  return {
    type: 'inline',
    template: activityMetadata.template,
    targetEntityIds: rawTargetValue, // New field for arrays
    isMultiTarget: true,
    priority: activityMetadata.priority ?? 50,
    shouldDescribeInActivity:
      activityMetadata.shouldDescribeInActivity !== false,
    sourceComponentId: componentId,
    ownerEntityId: entityId,
  };
} else if (typeof rawTargetValue === 'string') {
  // ... existing single-target handling
}
```

**File**: `src/anatomy/services/activityNLGSystem.js`

Add handling for `{targets}` placeholder and multi-target activities:

```javascript
// In phrase generation:
if (activity.isMultiTarget && activity.targetEntityIds?.length > 0) {
  const names = activity.targetEntityIds.map(id => this.#resolveEntityName(id));
  const formattedList = this.#formatListWithConjunction(names, 'and');
  rawPhrase = template.replace(/\{targets\}/g, formattedList);
}

// Helper method:
#formatListWithConjunction(items, conjunction) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
}
```

## Testing Requirements

### Test Suite 1: Component Schema Validation

**File**: `tests/unit/mods/positioning/components/wielding_component_schema.test.js`

| Test Case                         | Input                                                                                   | Expected |
| --------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| Valid: Empty array                | `{ wielded_item_ids: [] }`                                                              | Pass     |
| Valid: Single item                | `{ wielded_item_ids: ['sword-1'] }`                                                     | Pass     |
| Valid: Multiple items             | `{ wielded_item_ids: ['sword-1', 'dagger-2'] }`                                         | Pass     |
| Valid: With activityMetadata      | `{ wielded_item_ids: ['sword'], activityMetadata: { shouldDescribeInActivity: true } }` | Pass     |
| Invalid: Missing wielded_item_ids | `{}`                                                                                    | Fail     |
| Invalid: Items as string          | `{ wielded_item_ids: 'sword' }`                                                         | Fail     |
| Invalid: Non-string in array      | `{ wielded_item_ids: [123] }`                                                           | Fail     |
| Invalid: Additional properties    | `{ wielded_item_ids: [], extra: 'bad' }`                                                | Fail     |
| Valid: Namespaced IDs             | `{ wielded_item_ids: ['weapons:silver_revolver'] }`                                     | Pass     |

### Test Suite 2: Rule Execution

**File**: `tests/integration/mods/weapons/wieldThreateninglyRuleExecution.test.js`

| Test Case               | Initial State | Action       | Expected                                   |
| ----------------------- | ------------- | ------------ | ------------------------------------------ |
| First wield             | No component  | Wield sword  | Component with `['sword']`                 |
| Second wield            | `['sword']`   | Wield dagger | Component with `['sword', 'dagger']`       |
| Duplicate wield         | `['sword']`   | Wield sword  | Component still `['sword']` (no duplicate) |
| Description regenerated | No component  | Wield sword  | REGENERATE_DESCRIPTION called              |

### Test Suite 3: Activity Description Integration

**File**: `tests/integration/mods/positioning/wieldingActivityDescription.test.js`

| Test Case         | Component State                                    | Expected Output                                              |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Single weapon     | `['sword']`                                        | "{actor} is wielding sword threateningly"                    |
| Two weapons       | `['sword', 'dagger']`                              | "{actor} is wielding sword and dagger threateningly"         |
| Three weapons     | `['sword', 'dagger', 'staff']`                     | "{actor} is wielding sword, dagger, and staff threateningly" |
| Disabled          | `activityMetadata.shouldDescribeInActivity: false` | No wielding in description                                   |
| Priority ordering | `priority: 70`                                     | Appears between priority 66 and 75 activities                |

### Test Suite 4: Edge Cases

**File**: `tests/integration/mods/weapons/wieldingEdgeCases.test.js`

| Test Case         | Scenario                      | Expected                     |
| ----------------- | ----------------------------- | ---------------------------- |
| Empty array       | Component with `[]`           | Valid state, no crash        |
| Namespaced IDs    | `['weapons:silver_revolver']` | Correctly handled            |
| Max items         | Many items wielded            | Array grows correctly        |
| Component removal | Remove component              | Activity description updates |

### Test Suite 5: Action Gating (Future)

**File**: `tests/integration/mods/weapons/wieldingActionGating.test.js`

Document test cases for future action gating:

| Action          | Wielding State | Expected         |
| --------------- | -------------- | ---------------- |
| approach        | `['sword']`    | Blocked (future) |
| hug             | `['sword']`    | Blocked (future) |
| step_back       | `['sword']`    | Allowed          |
| put_down_weapon | `['sword']`    | Allowed          |

## Implementation Checklist

### Phase 1: Component & Rule

- [ ] Create `data/mods/positioning/components/wielding.component.json`
- [ ] Update `data/mods/positioning/mod-manifest.json`
- [ ] Modify `data/mods/weapons/rules/handle_wield_threateningly.rule.json`
- [ ] Create unit test for component schema
- [ ] Create integration test for rule execution

### Phase 2: Activity System Enhancement

- [ ] Modify `src/anatomy/services/activityMetadataCollectionSystem.js`
- [ ] Modify `src/anatomy/services/activityNLGSystem.js`
- [ ] Create integration test for activity description

### Phase 3: Comprehensive Testing

- [ ] Create edge case tests
- [ ] Create action gating test stubs (for future implementation)
- [ ] Run full test suite
- [ ] Validate with `npm run validate`

## Files to Modify

| File                                                                       | Change Type                    |
| -------------------------------------------------------------------------- | ------------------------------ |
| `data/mods/positioning/components/wielding.component.json`                 | CREATE                         |
| `data/mods/positioning/mod-manifest.json`                                  | MODIFY (add to components)     |
| `data/mods/weapons/rules/handle_wield_threateningly.rule.json`             | MODIFY (add operations)        |
| `src/anatomy/services/activityMetadataCollectionSystem.js`                 | MODIFY (array support)         |
| `src/anatomy/services/activityNLGSystem.js`                                | MODIFY ({targets} placeholder) |
| `tests/unit/mods/positioning/components/wielding_component_schema.test.js` | CREATE                         |
| `tests/integration/mods/weapons/wieldThreateninglyRuleExecution.test.js`   | CREATE                         |
| `tests/integration/mods/positioning/wieldingActivityDescription.test.js`   | CREATE                         |
| `tests/integration/mods/weapons/wieldingEdgeCases.test.js`                 | CREATE                         |
| `tests/integration/mods/weapons/wieldingActionGating.test.js`              | CREATE                         |

## Reference Files

These files should be studied before implementation:

1. `data/mods/positioning/components/facing_away.component.json` - Array pattern
2. `data/mods/positioning/components/hugging.component.json` - Activity metadata pattern
3. `data/mods/positioning/components/kneeling_before.component.json` - Activity metadata with priority
4. `data/mods/weapons/rules/handle_wield_threateningly.rule.json` - Current rule structure
5. `src/anatomy/services/activityMetadataCollectionSystem.js` - Current single-target handling
6. `tests/integration/mods/weapons/wield_threateningly_action.test.js` - Test fixture pattern
7. `tests/integration/mods/positioning/kneel_before_action.test.js` - Rule execution test pattern

## Priority Justification

| Component        | Priority | Rationale                       |
| ---------------- | -------- | ------------------------------- |
| sitting_on       | 62       | Common passive state            |
| lying_down       | 64       | Passive positional state        |
| hugging          | 66       | Active intimate embrace         |
| **wielding**     | **70**   | Active combat stance (proposed) |
| kneeling_before  | 75       | Prominent positional state      |
| straddling_waist | 82       | Highly intimate position        |

Priority 70 was chosen because:

- Wielding is more visually/tactically significant than sitting or hugging
- Less prominent than kneeling (which has social/power dynamics)
- Represents an active state that significantly changes character perception

## Future Considerations (Out of Scope)

1. **Stop Wielding Action**: New action to remove items from `wielded_item_ids`
2. **Appendage Mapping**: Track which hand holds which item
3. **Wielding Styles**: One-handed, two-handed, dual-wield classifications
4. **Combat Integration**: Wielded weapons affecting combat calculations
5. **Action Gating**: Using `positioning:wielding` as forbidden_component for intimacy actions
