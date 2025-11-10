# Brainstorming: Clothing Removal Dependencies and Blocking System

**Date**: 2025-11-10
**Status**: Initial Brainstorming
**Issue**: Belts can be removed without removing pants, violating realistic clothing physics

---

## Problem Statement

### Current Behavior

When an actor wears:
- **Belt**: `layer: "accessories"`, `primary slot: "torso_lower"`
- **Pants**: `layer: "base"`, `primary slot: "legs"`, `coverage_mapping: ["torso_lower"]`

Both items appear in the `topmost_clothing` scope and can be removed independently. This allows unrealistic scenarios where pants are removed while the belt remains worn.

### Root Cause Analysis

1. **No Dependency System**: The clothing system lacks any mechanism to express that one item depends on or blocks another
2. **Layer-Based Priority Only**: `topmost_clothing` uses layer priority (accessories > outer > base > underwear) but doesn't consider item relationships
3. **Slot Independence**: Each slot is resolved independently; no cross-slot dependencies exist
4. **Coverage Mapping Limitation**: `coverage_mapping` indicates what areas an item covers but not what it blocks

### Real-World Clothing Physics

In reality:
- **Belts** secure pants, so removing pants requires removing or loosening the belt first
- **Armor layers** might completely block access to underlying clothing
- **Buttoned items** might need to be unbuttoned before removal of items beneath them
- **Tucked items** (shirt tucked into pants) create dependencies

---

## System Architecture Analysis

### Current Components

#### 1. `clothing:equipment` Component
```json
{
  "equipped": {
    "torso_lower": {
      "accessories": ["belt-id"]
    },
    "legs": {
      "base": ["pants-id"]
    }
  }
}
```

#### 2. `clothing:wearable` Component
```json
{
  "layer": "accessories",
  "equipmentSlots": {
    "primary": "torso_lower"
  },
  "allowedLayers": ["accessories"]
}
```

#### 3. `clothing:coverage_mapping` Component
```json
{
  "covers": ["torso_lower"],
  "coveragePriority": "base"
}
```

#### 4. `topmost_clothing` Scope Resolution
- Returns ONE item per equipped slot
- Uses layer priority: `outer > base > underwear > accessories`
- No cross-item dependency checking
- Implemented in `src/scopeDsl/nodes/slotAccessResolver.js` and `clothingStepResolver.js`

---

## Solution Approaches

### Approach 1: Blocking Component (Recommended)

**Concept**: Introduce a new `clothing:blocks_removal` component that explicitly declares which items or layers an item blocks.

#### Implementation Details

**New Component Schema**: `data/mods/clothing/components/blocks_removal.component.json`
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "clothing:blocks_removal",
  "description": "Defines what items or layers this item blocks from removal",
  "dataSchema": {
    "type": "object",
    "properties": {
      "blockedSlots": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "slot": {
              "type": "string",
              "enum": ["torso_upper", "torso_lower", "legs", "feet", "head_gear", "hands", "left_arm_clothing", "right_arm_clothing"]
            },
            "layers": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": ["underwear", "base", "outer", "accessories"]
              }
            },
            "blockType": {
              "type": "string",
              "enum": ["must_remove_first", "must_loosen_first", "full_block"],
              "description": "Type of blocking relationship"
            }
          },
          "required": ["slot", "layers", "blockType"]
        }
      },
      "blocksRemovalOf": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Specific item IDs that cannot be removed while this is worn"
      }
    }
  }
}
```

**Example: Belt Entity**
```json
{
  "id": "clothing:black_calfskin_belt",
  "components": {
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": { "primary": "torso_lower" }
    },
    "clothing:blocks_removal": {
      "blockedSlots": [
        {
          "slot": "legs",
          "layers": ["base", "outer"],
          "blockType": "must_remove_first"
        }
      ]
    }
  }
}
```

**Advantages**:
- ✅ Explicit and easy to understand
- ✅ Supports multiple blocking relationships
- ✅ Allows different block types (must remove, must loosen, full block)
- ✅ Future-proof for armor and complex clothing
- ✅ Backward compatible (optional component)

**Disadvantages**:
- ❌ Requires updating existing clothing definitions
- ❌ Could become verbose for complex outfits
- ❌ Needs validation to prevent circular dependencies

**Impact Points**:
- `src/scopeDsl/nodes/slotAccessResolver.js`: Filter out blocked items
- `data/mods/clothing/actions/remove_clothing.action.json`: Add prerequisite check
- New operation handler: `validateRemovalBlockingHandler.js`
- New operator: `isRemovalBlockedOperator.js`

---

### Approach 2: Dependency Graph Component

**Concept**: Create a dependency graph that defines "requires" and "blocks" relationships between items.

#### Implementation Details

**New Component Schema**: `data/mods/clothing/components/item_dependencies.component.json`
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "clothing:item_dependencies",
  "description": "Defines dependency relationships with other worn items",
  "dataSchema": {
    "type": "object",
    "properties": {
      "requires": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "slot": { "type": "string" },
            "layer": { "type": "string" },
            "reason": { "type": "string" }
          }
        },
        "description": "Items that must be present for this item to function"
      },
      "blocksRemovalOf": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "slot": { "type": "string" },
            "layer": { "type": "string" },
            "mustRemoveFirst": { "type": "boolean" }
          }
        }
      }
    }
  }
}
```

**Example: Belt Entity**
```json
{
  "clothing:item_dependencies": {
    "blocksRemovalOf": [
      {
        "slot": "legs",
        "layer": "base",
        "mustRemoveFirst": true
      }
    ]
  }
}
```

**Advantages**:
- ✅ Supports bidirectional relationships (requires/blocks)
- ✅ Good for complex dependency scenarios
- ✅ Enables validation of outfit coherence

**Disadvantages**:
- ❌ More complex to implement and validate
- ❌ Risk of circular dependencies
- ❌ Harder to debug and visualize
- ❌ Requires graph traversal algorithms

---

### Approach 3: Removal Order Component

**Concept**: Assign removal order priorities to items, similar to how layers work but specifically for removal sequencing.

#### Implementation Details

**New Component Schema**: `data/mods/clothing/components/removal_order.component.json`
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "clothing:removal_order",
  "description": "Defines removal order priority for this item",
  "dataSchema": {
    "type": "object",
    "properties": {
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "description": "Higher priority items must be removed first"
      },
      "affectsSlots": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Which slots are affected by this removal order"
      }
    },
    "required": ["priority"]
  }
}
```

**Example Configuration**:
- Belt: `priority: 50`, `affectsSlots: ["legs", "torso_lower"]`
- Pants: `priority: 30`
- Underwear: `priority: 10`

**Advantages**:
- ✅ Simple numeric priority system
- ✅ Easy to understand and implement
- ✅ Works well with existing layer system

**Disadvantages**:
- ❌ Less explicit about *why* something blocks
- ❌ Harder to configure complex relationships
- ❌ Global priority numbers could conflict
- ❌ Doesn't handle slot-specific blocking well

---

### Approach 4: Extended Coverage Mapping

**Concept**: Extend the existing `coverage_mapping` component to include blocking semantics.

#### Implementation Details

**Extended Component Schema**: Update `data/mods/clothing/components/coverage_mapping.component.json`
```json
{
  "dataSchema": {
    "properties": {
      "covers": { /* existing */ },
      "coveragePriority": { /* existing */ },
      "blocksRemoval": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "slot": { "type": "string" },
            "layers": { "type": "array", "items": { "type": "string" } },
            "blockMode": {
              "type": "string",
              "enum": ["full", "physical", "functional"]
            }
          }
        },
        "description": "Slots and layers that cannot be removed while this is worn"
      }
    }
  }
}
```

**Example: Belt Entity**
```json
{
  "clothing:coverage_mapping": {
    "covers": ["torso_lower"],
    "coveragePriority": "accessories",
    "blocksRemoval": [
      {
        "slot": "legs",
        "layers": ["base"],
        "blockMode": "functional"
      }
    ]
  }
}
```

**Advantages**:
- ✅ Builds on existing coverage system
- ✅ Natural semantic grouping (coverage + blocking)
- ✅ Minimal new schemas needed

**Disadvantages**:
- ❌ Conflates two different concepts (coverage vs. blocking)
- ❌ Makes coverage_mapping more complex
- ❌ Less flexible for non-coverage-related blocking

---

### Approach 5: Topmost Clothing Filter Enhancement

**Concept**: Keep item definitions unchanged but enhance the `topmost_clothing` scope to filter out items that are blocked by other worn items.

#### Implementation Details

**Modified Scope Resolver**: Update `src/scopeDsl/nodes/slotAccessResolver.js`

```javascript
function resolveTopmostClothingWithBlocking(entityId, equipped, trace) {
  const candidates = getTopmostCandidates(equipped);

  // New: Filter out items that are blocked
  const availableForRemoval = candidates.filter(item => {
    return !isBlockedByOtherItems(item, equipped);
  });

  return availableForRemoval;
}

function isBlockedByOtherItems(targetItem, equipped) {
  // Check if accessories in same/overlapping slots block this item
  for (const [slot, layers] of Object.entries(equipped)) {
    if (layers.accessories) {
      const accessory = getItemData(layers.accessories);
      if (accessoryBlocksItem(accessory, targetItem)) {
        return true;
      }
    }
  }
  return false;
}
```

**Heuristic Rules**:
1. Accessories in `torso_lower` block base/outer items in `legs` if those items have `coverage_mapping` for `torso_lower`
2. Items in `outer` layer block items in `base` layer in the same slot
3. Items with secondary slots block items in those slots

**Advantages**:
- ✅ No schema changes needed
- ✅ Fast to implement
- ✅ Backward compatible

**Disadvantages**:
- ❌ Hardcoded logic, not data-driven
- ❌ Limited to specific scenarios
- ❌ Difficult to extend for armor/complex cases
- ❌ Logic is hidden in code, not visible in data

---

## Comparison Matrix

| Approach | Complexity | Flexibility | Backward Compat | Future-Proof | Data-Driven |
|----------|-----------|-------------|-----------------|--------------|-------------|
| **1. Blocking Component** | Medium | High | Yes | Yes | Yes |
| **2. Dependency Graph** | High | Very High | Yes | Yes | Yes |
| **3. Removal Order** | Low | Medium | Yes | Medium | Yes |
| **4. Extended Coverage** | Medium | Medium | Partial | Medium | Yes |
| **5. Filter Enhancement** | Low | Low | Yes | Low | No |

---

## Recommended Solution

### **Approach 1: Blocking Component** (Primary Recommendation)

**Rationale**:
- Strikes best balance between simplicity and power
- Explicitly data-driven and visible in entity definitions
- Supports multiple block types for future armor/layering scenarios
- Easy to validate and debug
- Clear separation of concerns (blocking is separate from coverage)

### Implementation Roadmap

#### Phase 1: Foundation (2-3 hours)
1. Create `clothing:blocks_removal` component schema
2. Create `isRemovalBlocked` JSON Logic operator
3. Add validation for circular blocking dependencies

#### Phase 2: Integration (2-3 hours)
1. Update `remove_clothing` and `remove_others_clothing` actions with prerequisite conditions
2. Modify `topmost_clothing` scope resolution to filter blocked items
3. Create new condition: `clothing:can-remove-item.condition.json`

#### Phase 3: Content Updates (1-2 hours)
1. Update belt entities to include `blocks_removal` component
2. Document the blocking system in `docs/clothing/`
3. Add test cases for blocking scenarios

#### Phase 4: Testing (2-3 hours)
1. Unit tests for `isRemovalBlocked` operator
2. Integration tests for removal blocking scenarios
3. E2E tests for complete workflows

**Total Estimated Effort**: 7-11 hours

---

## Alternative/Complementary Solutions

### Enhancement 1: "Loosen" Action

Add a new `loosen_belt` action that allows loosening (but not removing) a belt, which then allows pants removal without removing the belt.

**Benefits**:
- More realistic simulation
- Gives players more granular control
- Doesn't require removing the belt entirely

### Enhancement 2: Cascading Removal

Implement `cascade_unequip: true` option in `UNEQUIP_CLOTHING` operation to automatically remove blocking items.

**Example Flow**:
1. Player attempts to remove pants
2. System detects belt is blocking
3. System prompts: "Remove belt first?" or automatically removes belt
4. System then removes pants

**Benefits**:
- More user-friendly
- Reduces micromanagement
- Clear communication of dependencies

---

## Edge Cases and Considerations

### 1. Multiple Blocking Items
**Scenario**: Wearing belt + suspenders, both block pants removal
**Solution**: Both must be removed/loosened for pants removal

### 2. Partial Blocking
**Scenario**: Heavy coat blocks access to shirt but not pants
**Solution**: `blockType: "full_block"` specifies complete inaccessibility

### 3. Context-Dependent Blocking
**Scenario**: Tucked shirt blocks pants removal, untucked shirt doesn't
**Solution**: Add `clothing:tucked` state component that affects blocking

### 4. Armor Over Clothing
**Scenario**: Plate armor completely blocks access to all underlying layers
**Solution**: `blockType: "full_block"` for all covered slots/layers

### 5. Removal Validation Failure
**Scenario**: Player tries to remove blocked item directly
**Solution**:
- Action doesn't appear in available actions (filtered by scope)
- If somehow triggered, validation fails with clear error message
- Dispatch `CLOTHING_REMOVAL_BLOCKED` event with reason

---

## Migration Strategy

### Backward Compatibility
- `clothing:blocks_removal` is **optional**
- Existing clothing without this component works as before
- New blocking logic only activates when component is present

### Gradual Rollout
1. **Phase 1**: Implement system without updating existing entities
2. **Phase 2**: Update critical items (belts, armor) incrementally
3. **Phase 3**: Batch update remaining items as needed

### Data Migration Script
```bash
npm run migrate:add-blocking-components
```

Script would:
1. Identify items that should have blocking (belts, armor, etc.)
2. Generate suggested `blocks_removal` components
3. Create migration PRs for review

---

## Testing Strategy

### Unit Tests
- `tests/unit/logic/operators/isRemovalBlockedOperator.test.js`
- `tests/unit/scopeDsl/nodes/slotAccessResolver.blocking.test.js`

### Integration Tests
- `tests/integration/clothing/removalBlocking.integration.test.js`
  - Test: Belt blocks pants removal
  - Test: Armor blocks shirt removal
  - Test: Multiple blocking items
  - Test: Removal order validation

### E2E Tests
- `tests/e2e/clothing/completeRemovalWorkflow.e2e.test.js`
  - Full outfit removal workflow
  - Validate action availability
  - Validate error messages

---

## Documentation Requirements

### User-Facing
- Update `docs/modding/clothing-system.md` with blocking mechanics
- Create examples for common blocking scenarios
- Document best practices for armor vs. clothing

### Developer-Facing
- Add JSDoc to new operators and handlers
- Update `CLAUDE.md` with blocking system overview
- Create architecture diagram showing blocking flow

---

## Future Enhancements

### 1. Dynamic Blocking
Allow blocking rules to change based on state:
- Buttoned vs. unbuttoned jacket
- Zipped vs. unzipped dress
- Tied vs. untied robe

### 2. Partial Accessibility
Some items might be partially accessible without full removal:
- "Unbutton jacket to access shirt pocket"
- "Roll up sleeves"

### 3. Time-Based Removal
Some items take longer to remove than others:
- Quick: Hat, belt, shoes
- Medium: Shirt, pants
- Slow: Full plate armor, wedding dress

### 4. Assistance Requirements
Some items require help to remove:
- Corset lacing
- Back-zippered dress
- Complex armor

---

## Decision Log

### Decision Points

1. **Q**: Should blocking be bidirectional (belt blocks pants, pants require belt)?
   **A**: No, only one direction needed. Belt blocks pants removal, but pants don't require belt to exist.

2. **Q**: Should we validate blocking on equip or unequip?
   **A**: Only on unequip. Equipping already has layer/slot validation.

3. **Q**: How to handle player removing blocking item during AI turn?
   **A**: Re-validate available actions at turn start; blocked actions disappear from AI choices.

4. **Q**: Should blocking apply to `adjust_clothing` or only `remove_clothing`?
   **A**: Initially only removal; can extend to adjustment if needed.

---

## Conclusion

The **Blocking Component** approach (Approach 1) is recommended as the primary solution due to its:
- Clear, explicit data-driven design
- Future-proof extensibility for armor and complex clothing
- Backward compatibility
- Reasonable implementation complexity

This solution maintains the architectural principles of the Living Narrative Engine while solving the immediate belt/pants removal issue and providing a foundation for future clothing physics enhancements.

---

## Appendix: Code Examples

### Example: Belt with Blocking

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:black_calfskin_belt",
  "description": "Black calfskin belt with brushed-brass buckle",
  "components": {
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["accessories"]
    },
    "clothing:blocks_removal": {
      "blockedSlots": [
        {
          "slot": "legs",
          "layers": ["base", "outer"],
          "blockType": "must_remove_first",
          "reason": "Belt secures pants at waist"
        }
      ]
    },
    "core:material": {
      "material": "calfskin"
    },
    "core:name": {
      "text": "belt"
    }
  }
}
```

### Example: JSON Logic Operator

```javascript
// src/logic/operators/isRemovalBlockedOperator.js
export class IsRemovalBlockedOperator extends BaseOperator {
  evaluate(args, context) {
    const [entityId, itemId] = args;

    // Get equipment data
    const equipment = this.entityManager.getComponent(
      entityId,
      'clothing:equipment'
    );

    // Get item to be removed
    const itemWearable = this.entityManager.getComponent(
      itemId,
      'clothing:wearable'
    );

    // Check all equipped items for blocking components
    for (const [slot, layers] of Object.entries(equipment.equipped)) {
      for (const [layer, items] of Object.entries(layers)) {
        const blockingItems = Array.isArray(items) ? items : [items];

        for (const blockingItemId of blockingItems) {
          const blocking = this.entityManager.getComponent(
            blockingItemId,
            'clothing:blocks_removal'
          );

          if (!blocking) continue;

          // Check if this item blocks the target item
          if (this.itemIsBlocked(itemWearable, blocking)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  itemIsBlocked(itemWearable, blockingComponent) {
    for (const blocked of blockingComponent.blockedSlots) {
      if (blocked.slot === itemWearable.equipmentSlots.primary &&
          blocked.layers.includes(itemWearable.layer)) {
        return true;
      }
    }
    return false;
  }
}
```

### Example: Updated Removal Condition

```json
{
  "condition_ref": "clothing:can-remove-item",
  "type": "combined",
  "mode": "all",
  "conditions": [
    {
      "condition_ref": "clothing:event-is-action-remove-clothing"
    },
    {
      "type": "inline",
      "expression": {
        "!": {
          "isRemovalBlocked": [
            "{event.payload.actorId}",
            "{event.payload.targetId}"
          ]
        }
      }
    }
  ]
}
```

---

**End of Brainstorming Document**
