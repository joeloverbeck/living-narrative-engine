# Clothing Removal Blocking System Specification

## Implementation Status

**Status**: NOT IMPLEMENTED – New Feature
**Date**: 2025-11-10
**Version**: 1.0.0
**Category**: Clothing System Enhancement
**Priority**: High

---

## 1. Overview

### 1.1 Executive Summary

The clothing system currently allows unrealistic removal scenarios where dependent items (e.g., belts and pants) can be removed independently, violating real-world clothing physics. When an actor wears a belt (layer: `accessories`, primary slot: `torso_lower`) and pants (layer: `base`, primary slot: `legs`, coverage_mapping: `["torso_lower"]`), both items appear in the `topmost_clothing` scope and can be removed independently. This allows unrealistic scenarios where pants are removed while the belt remains fastened, or vice versa.

This specification introduces a **Blocking Component System** that enables explicit declaration of removal dependencies between clothing items. The system adds a new `clothing:blocks_removal` component that allows items to declare which other items or layers they block from removal, enforcing realistic clothing physics without disrupting backward compatibility.

### 1.2 Problem Statement

**Current Behavior**:
- All topmost clothing items in equipped slots appear as removable in action discovery
- No mechanism exists to express that one item depends on or blocks another
- `topmost_clothing` scope uses only layer priority (accessories > outer > base > underwear)
- Each slot is resolved independently with no cross-slot dependencies

**Root Cause**:
- No dependency system for clothing items
- Layer-based priority doesn't consider item relationships
- Coverage mapping indicates covered areas but not blocking relationships
- Slot independence prevents cross-slot dependency checking

**Real-World Violations**:
- Belts can be removed without removing pants (belt secures pants)
- Pants can be removed while belt remains fastened (physically impossible)
- No support for armor blocking access to underlying clothing
- No support for tucked/buttoned items creating dependencies

### 1.3 Affected Systems

- **Scope Resolution**: `src/scopeDsl/nodes/slotAccessResolver.js`, `clothingStepResolver.js`
- **Action Validation**: `data/mods/clothing/actions/remove_clothing.action.json`
- **Component System**: `data/mods/clothing/components/`
- **JSON Logic**: Custom operator for removal blocking checks
- **Operation Handlers**: New validation handler for blocking checks

### 1.4 Design Philosophy

- **Explicit over Implicit**: Data-driven blocking declarations visible in entity definitions
- **Backward Compatible**: Optional component; existing content works unchanged
- **Future-Proof**: Supports armor, complex layering, and state-dependent blocking
- **Separation of Concerns**: Blocking logic separate from coverage mapping
- **Clear Semantics**: Multiple block types (must_remove_first, must_loosen_first, full_block)

---

## 2. Component Requirements

### 2.1 Blocks Removal Component

**File**: `data/mods/clothing/components/blocks_removal.component.json`

**Purpose**: Declares which items or layers this item blocks from removal while worn.

**Full Definition**:
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "clothing:blocks_removal",
  "description": "Defines what items or layers this item blocks from removal while it remains equipped. Used to enforce realistic clothing physics (e.g., belts blocking pants removal).",
  "dataSchema": {
    "type": "object",
    "properties": {
      "blockedSlots": {
        "type": "array",
        "description": "List of slot/layer combinations that cannot be removed while this item is worn",
        "items": {
          "type": "object",
          "properties": {
            "slot": {
              "type": "string",
              "enum": [
                "torso_upper",
                "torso_lower",
                "legs",
                "feet",
                "head_gear",
                "hands",
                "left_arm_clothing",
                "right_arm_clothing"
              ],
              "description": "Equipment slot that is blocked"
            },
            "layers": {
              "type": "array",
              "description": "Layers in the blocked slot that cannot be removed",
              "items": {
                "type": "string",
                "enum": ["underwear", "base", "outer", "accessories"]
              },
              "minItems": 1,
              "uniqueItems": true
            },
            "blockType": {
              "type": "string",
              "enum": [
                "must_remove_first",
                "must_loosen_first",
                "full_block"
              ],
              "description": "Type of blocking: must_remove_first (this item must be removed), must_loosen_first (this item must be loosened), full_block (complete inaccessibility)"
            },
            "reason": {
              "type": "string",
              "minLength": 1,
              "description": "Human-readable explanation of why blocking occurs (for error messages)"
            }
          },
          "required": ["slot", "layers", "blockType"],
          "additionalProperties": false
        },
        "minItems": 1
      },
      "blocksRemovalOf": {
        "type": "array",
        "description": "Specific item IDs that cannot be removed while this item is worn (for explicit item-to-item blocking)",
        "items": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$"
        },
        "uniqueItems": true
      }
    },
    "anyOf": [
      { "required": ["blockedSlots"] },
      { "required": ["blocksRemovalOf"] }
    ],
    "additionalProperties": false
  }
}
```

**Design Rationale**:

1. **Slot-Based Blocking** (`blockedSlots`):
   - Declares blocking by slot/layer combination (generic, reusable)
   - Supports blocking multiple layers in a slot (e.g., belt blocks both base and outer pants)
   - Allows cross-slot blocking (accessory in `torso_lower` blocks items in `legs`)

2. **Item-Specific Blocking** (`blocksRemovalOf`):
   - Explicit item ID blocking for special cases
   - Useful for quest items or unique clothing combinations
   - Less common than slot-based blocking

3. **Block Types**:
   - `must_remove_first`: This item must be removed before blocked item (standard case)
   - `must_loosen_first`: This item must be loosened but not removed (future: belt loosening)
   - `full_block`: Complete inaccessibility (armor covering clothing completely)

4. **Reason Field**:
   - Optional but recommended for clear error messages
   - Provides context for why removal is blocked
   - Helps debugging and player understanding

**Example Usage: Belt Blocking Pants**:
```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:black_calfskin_belt",
  "description": "Black calfskin belt with brushed-brass buckle",
  "components": {
    "core:name": {
      "text": "belt"
    },
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["accessories"]
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_lower"],
      "coveragePriority": "accessories"
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
    "core:color": {
      "colorName": "black"
    }
  }
}
```

**Example Usage: Armor Blocking Clothing**:
```json
{
  "id": "armor:plate_cuirass",
  "components": {
    "clothing:wearable": {
      "layer": "outer",
      "equipmentSlots": {
        "primary": "torso_upper"
      }
    },
    "clothing:blocks_removal": {
      "blockedSlots": [
        {
          "slot": "torso_upper",
          "layers": ["base", "underwear"],
          "blockType": "full_block",
          "reason": "Plate armor completely covers torso"
        }
      ]
    }
  }
}
```

---

## 3. JSON Logic Operator

### 3.1 IsRemovalBlocked Operator

**File**: `src/logic/operators/isRemovalBlockedOperator.js`

**Purpose**: Evaluates whether a target item's removal is blocked by any equipped items.

**Implementation**:
```javascript
import { BaseOperator } from './baseOperator.js';
import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';

/**
 * @file IsRemovalBlocked JSON Logic Operator
 * Evaluates whether an item's removal is blocked by other equipped items
 * @see src/scopeDsl/nodes/slotAccessResolver.js
 */

/**
 * IsRemovalBlocked operator evaluates removal blocking constraints
 *
 * Usage in JSON Logic:
 * {
 *   "isRemovalBlocked": [
 *     "{actorId}",      // Entity ID wearing the clothing
 *     "{targetItemId}"  // Item ID to check for removal blocking
 *   ]
 * }
 *
 * Returns: true if removal is blocked, false if allowed
 */
export class IsRemovalBlockedOperator extends BaseOperator {
  #entityManager;
  #logger;

  constructor({ entityManager, logger }) {
    super();
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponent', 'hasComponent'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Evaluates removal blocking for a target item
   * @param {Array} args - [actorId, targetItemId]
   * @param {Object} context - Evaluation context (unused)
   * @returns {boolean} - true if blocked, false if allowed
   */
  evaluate(args, context) {
    assertPresent(args, 'IsRemovalBlocked requires arguments');

    if (!Array.isArray(args) || args.length !== 2) {
      this.#logger.warn(
        'IsRemovalBlocked operator requires exactly 2 arguments: [actorId, targetItemId]',
        { args }
      );
      return false;
    }

    const [actorId, targetItemId] = args;

    if (!actorId || !targetItemId) {
      this.#logger.warn('IsRemovalBlocked received null or undefined arguments', {
        actorId,
        targetItemId,
      });
      return false;
    }

    try {
      // Get actor's equipment
      const equipment = this.#entityManager.getComponent(
        actorId,
        'clothing:equipment'
      );

      if (!equipment || !equipment.equipped) {
        this.#logger.debug('Actor has no equipment', { actorId });
        return false;
      }

      // Get target item's wearable data
      const targetWearable = this.#entityManager.getComponent(
        targetItemId,
        'clothing:wearable'
      );

      if (!targetWearable) {
        this.#logger.warn('Target item is not wearable', { targetItemId });
        return false;
      }

      // Check all equipped items for blocking components
      for (const [slot, layers] of Object.entries(equipment.equipped)) {
        for (const [layer, items] of Object.entries(layers)) {
          const equippedItems = Array.isArray(items) ? items : [items];

          for (const equippedItemId of equippedItems) {
            // Skip if checking the target item itself
            if (equippedItemId === targetItemId) {
              continue;
            }

            // Check if this equipped item has blocking component
            if (
              !this.#entityManager.hasComponent(
                equippedItemId,
                'clothing:blocks_removal'
              )
            ) {
              continue;
            }

            const blocking = this.#entityManager.getComponent(
              equippedItemId,
              'clothing:blocks_removal'
            );

            // Check slot-based blocking
            if (blocking.blockedSlots) {
              if (this.#itemIsBlockedBySlotRules(targetWearable, blocking.blockedSlots)) {
                this.#logger.debug('Item removal blocked by slot rules', {
                  targetItemId,
                  blockedBy: equippedItemId,
                });
                return true;
              }
            }

            // Check explicit item ID blocking
            if (
              blocking.blocksRemovalOf &&
              blocking.blocksRemovalOf.includes(targetItemId)
            ) {
              this.#logger.debug('Item removal blocked by explicit ID', {
                targetItemId,
                blockedBy: equippedItemId,
              });
              return true;
            }
          }
        }
      }

      return false;
    } catch (err) {
      this.#logger.error('Error evaluating IsRemovalBlocked operator', {
        error: err.message,
        actorId,
        targetItemId,
      });
      return false;
    }
  }

  /**
   * Checks if item matches any blocked slot rules
   * @private
   * @param {Object} targetWearable - Target item's wearable component
   * @param {Array} blockedSlots - Array of blocking rules
   * @returns {boolean} - true if blocked
   */
  #itemIsBlockedBySlotRules(targetWearable, blockedSlots) {
    const targetSlot = targetWearable.equipmentSlots?.primary;
    const targetLayer = targetWearable.layer;

    if (!targetSlot || !targetLayer) {
      return false;
    }

    for (const rule of blockedSlots) {
      if (rule.slot === targetSlot && rule.layers.includes(targetLayer)) {
        return true;
      }
    }

    return false;
  }
}

export default IsRemovalBlockedOperator;
```

**Design Rationale**:

1. **Fail-Safe Defaults**: Returns `false` (allow removal) on errors to avoid blocking valid actions
2. **Comprehensive Checks**: Validates both slot-based and explicit ID blocking
3. **Self-Exclusion**: Skips the target item itself when checking blockers
4. **Logging**: Detailed debug logging for troubleshooting blocking issues
5. **Error Handling**: Catches and logs errors without crashing evaluation

**Testing Requirements**:
- Unit tests: `tests/unit/logic/operators/isRemovalBlockedOperator.test.js`
- Test blocked/unblocked scenarios
- Test missing components
- Test invalid arguments
- Test self-referential blocking

---

## 4. Scope Resolution Enhancement

### 4.1 SlotAccessResolver Modification

**File**: `src/scopeDsl/nodes/slotAccessResolver.js`

**Changes Required**:

Modify the `topmost_clothing` resolution to filter out items blocked by other equipped items.

**Implementation Strategy**:

```javascript
// In resolveTopmostClothing function:
// AFTER getting topmost candidates per slot
// BEFORE returning results

// Filter out items that are blocked by other equipped items
const availableForRemoval = candidates.filter((candidate) => {
  // Check if any OTHER equipped item blocks this candidate
  const isBlocked = this.#checkIfRemovalBlocked(entityId, candidate.itemId, equipped);
  return !isBlocked;
});

return availableForRemoval;
```

**New Helper Method**:

```javascript
/**
 * Checks if item removal is blocked by any equipped items
 * @private
 * @param {string} actorId - Entity wearing the clothing
 * @param {string} targetItemId - Item to check
 * @param {Object} equipped - Equipment data structure
 * @returns {boolean} - true if blocked
 */
#checkIfRemovalBlocked(actorId, targetItemId, equipped) {
  const targetWearable = this.#entityManager.getComponent(
    targetItemId,
    'clothing:wearable'
  );

  if (!targetWearable) {
    return false;
  }

  // Check all equipped items for blocking components
  for (const [slot, layers] of Object.entries(equipped)) {
    for (const [layer, items] of Object.entries(layers)) {
      const equippedItems = Array.isArray(items) ? items : [items];

      for (const equippedItemId of equippedItems) {
        if (equippedItemId === targetItemId) {
          continue; // Skip self
        }

        if (!this.#entityManager.hasComponent(equippedItemId, 'clothing:blocks_removal')) {
          continue;
        }

        const blocking = this.#entityManager.getComponent(
          equippedItemId,
          'clothing:blocks_removal'
        );

        // Check slot-based blocking
        if (blocking.blockedSlots) {
          if (this.#itemMatchesBlockingRule(targetWearable, blocking.blockedSlots)) {
            return true;
          }
        }

        // Check explicit ID blocking
        if (blocking.blocksRemovalOf?.includes(targetItemId)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Checks if item matches any blocking rule
 * @private
 */
#itemMatchesBlockingRule(targetWearable, blockedSlots) {
  const targetSlot = targetWearable.equipmentSlots?.primary;
  const targetLayer = targetWearable.layer;

  for (const rule of blockedSlots) {
    if (rule.slot === targetSlot && rule.layers.includes(targetLayer)) {
      return true;
    }
  }

  return false;
}
```

**Design Rationale**:
- Filtering happens at scope resolution (prevents blocked items from appearing in actions)
- Duplicates operator logic (necessary for scope evaluation vs condition evaluation)
- Maintains performance (checks only equipped items)
- Logs filtering for debugging

---

## 5. Condition Definition

### 5.1 Can Remove Item Condition

**File**: `data/mods/clothing/conditions/can-remove-item.condition.json`

**Purpose**: Validates that an item can be removed (not blocked by other items).

**Definition**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "clothing:can-remove-item",
  "description": "Validates that the target clothing item can be removed (not blocked by other equipped items)",
  "type": "inline",
  "expression": {
    "!": {
      "isRemovalBlocked": [
        "{actorId}",
        "{targetId}"
      ]
    }
  }
}
```

**Usage in Action Prerequisites**:
```json
{
  "prerequisites": [
    {
      "condition_ref": "clothing:event-is-action-remove-clothing"
    },
    {
      "condition_ref": "clothing:can-remove-item"
    }
  ]
}
```

---

## 6. Action Updates

### 6.1 Remove Clothing Action

**File**: `data/mods/clothing/actions/remove_clothing.action.json`

**Changes**: Add `can-remove-item` condition to prerequisites.

**Updated Prerequisites**:
```json
{
  "prerequisites": [
    {
      "condition_ref": "clothing:event-is-action-remove-clothing"
    },
    {
      "condition_ref": "clothing:can-remove-item"
    }
  ]
}
```

### 6.2 Remove Others Clothing Action

**File**: `data/mods/clothing/actions/remove_others_clothing.action.json`

**Changes**: Add same validation to prerequisites.

---

## 7. Dependency Injection Setup

### 7.1 Operator Registration

**File**: `src/dependencyInjection/registrations/jsonLogicRegistrations.js`

**Add Operator**:
```javascript
import IsRemovalBlockedOperator from '../../logic/operators/isRemovalBlockedOperator.js';

// In registration function:
container.registerFactory(
  'IsRemovalBlockedOperator',
  (c) => new IsRemovalBlockedOperator({
    entityManager: c.resolve(tokens.IEntityManager),
    logger: c.resolve(tokens.ILogger),
  })
);

// Register with JSON Logic
const jsonLogic = container.resolve(tokens.IJSONLogic);
const operator = container.resolve('IsRemovalBlockedOperator');
jsonLogic.addOperation('isRemovalBlocked', (args, data) =>
  operator.evaluate(args, data)
);
```

---

## 8. Content Updates

### 8.1 Belt Entities

**Files**: All belt entity definitions in `data/mods/clothing/entities/`

**Add Component**:
```json
{
  "clothing:blocks_removal": {
    "blockedSlots": [
      {
        "slot": "legs",
        "layers": ["base", "outer"],
        "blockType": "must_remove_first",
        "reason": "Belt secures pants at waist"
      }
    ]
  }
}
```

**Affected Files**:
- `clothing:black_calfskin_belt`
- `clothing:brown_leather_belt`
- Any other belt entities

---

## 9. Testing Strategy

### 9.1 Unit Tests

**File**: `tests/unit/logic/operators/isRemovalBlockedOperator.test.js`

**Test Coverage**:
```javascript
describe('IsRemovalBlockedOperator', () => {
  describe('Slot-Based Blocking', () => {
    it('should return true when belt blocks pants removal', () => {
      // Belt in torso_lower blocks base layer in legs
    });

    it('should return false when no blocking component present', () => {
      // Items without blocks_removal component don't block
    });

    it('should handle multiple blocking items', () => {
      // Belt + suspenders both block pants
    });
  });

  describe('Explicit ID Blocking', () => {
    it('should block specific item IDs', () => {
      // Quest item blocks removal of specific artifact
    });
  });

  describe('Edge Cases', () => {
    it('should not block item from blocking itself', () => {
      // Self-referential check
    });

    it('should handle missing equipment component', () => {
      // Actor with no clothing:equipment
    });

    it('should handle invalid arguments gracefully', () => {
      // null/undefined arguments
    });
  });

  describe('Block Types', () => {
    it('should respect must_remove_first block type', () => {
      // Standard blocking behavior
    });

    it('should respect full_block type', () => {
      // Armor completely blocking access
    });
  });
});
```

### 9.2 Integration Tests

**File**: `tests/integration/clothing/removalBlocking.integration.test.js`

**Test Scenarios**:
```javascript
describe('Clothing Removal Blocking Integration', () => {
  it('should prevent pants removal when belt is equipped', async () => {
    // Create actor with belt + pants
    // Verify pants not in topmost_clothing scope
    // Verify remove_clothing action not available for pants
  });

  it('should allow pants removal after belt is removed', async () => {
    // Create actor with belt + pants
    // Remove belt
    // Verify pants now in topmost_clothing scope
    // Verify remove_clothing action available for pants
  });

  it('should handle multiple blocking items correctly', async () => {
    // Belt + suspenders blocking pants
    // Both must be removed before pants accessible
  });

  it('should not break non-blocking clothing removal', async () => {
    // Items without blocks_removal component work normally
  });

  it('should handle armor blocking base layers', async () => {
    // Plate cuirass blocks shirt removal
  });
});
```

### 9.3 E2E Tests

**File**: `tests/e2e/clothing/completeRemovalWorkflow.e2e.test.js`

**Workflow Tests**:
```javascript
describe('Complete Clothing Removal Workflow', () => {
  it('should enforce removal order in full outfit', async () => {
    // Actor wearing: jacket (outer), shirt (base), belt (accessories), pants (base)
    // Validate correct removal sequence
  });

  it('should show appropriate error messages for blocked removal', async () => {
    // Attempt to remove blocked item
    // Verify error message includes reason
  });

  it('should update available actions after each removal', async () => {
    // Remove blocking item
    // Verify newly unblocked items appear in action list
  });
});
```

---

## 10. Validation and Migration

### 10.1 Circular Dependency Validation

**File**: `src/validation/blockingDependencyValidator.js`

**Purpose**: Detect circular blocking dependencies during mod loading.

**Implementation**:
```javascript
export class BlockingDependencyValidator {
  /**
   * Validates no circular blocking dependencies exist
   * @param {Array} clothingEntities - All clothing entity definitions
   * @throws {ValidationError} if circular dependency detected
   */
  validateNoCircularBlocking(clothingEntities) {
    const blockingGraph = this.#buildBlockingGraph(clothingEntities);
    const visited = new Set();
    const recursionStack = new Set();

    for (const entityId of blockingGraph.keys()) {
      if (this.#detectCycle(entityId, blockingGraph, visited, recursionStack)) {
        throw new ValidationError(
          `Circular blocking dependency detected involving: ${entityId}`
        );
      }
    }
  }

  #buildBlockingGraph(entities) {
    // Build directed graph of blocking relationships
  }

  #detectCycle(node, graph, visited, stack) {
    // DFS cycle detection
  }
}
```

### 10.2 Content Migration

**Backward Compatibility**:
- `clothing:blocks_removal` is optional
- Existing clothing without component continues working
- Blocking only activates when component present

**Migration Strategy**:
1. Phase 1: Implement system without updating entities (test infrastructure)
2. Phase 2: Update critical items (belts, armor)
3. Phase 3: Batch update remaining items as needed

---

## 11. Documentation Requirements

### 11.1 User-Facing Documentation

**File**: `docs/modding/clothing-blocking-system.md` (new)

**Contents**:
- Overview of blocking system
- Component usage examples
- Common blocking scenarios (belts, armor, layers)
- Block types and when to use each
- Testing blocking configurations
- Troubleshooting guide

### 11.2 Update Existing Docs

**File**: `docs/modding/clothing-system.md`

**Add Section**: "Removal Blocking" explaining:
- Why blocking is needed
- How to add blocking to clothing items
- How scope resolution filters blocked items
- How validation prevents invalid removal

### 11.3 Developer Documentation

**Update**: `CLAUDE.md` § Development Guidelines

**Add**: Overview of blocking system architecture and integration points.

---

## 12. Acceptance Criteria

### 12.1 Functional Requirements

✅ **FR-1**: Belt entities with `blocks_removal` component prevent pants removal
✅ **FR-2**: Removing belt makes pants available for removal
✅ **FR-3**: `topmost_clothing` scope excludes blocked items
✅ **FR-4**: Blocked items don't appear in `remove_clothing` action discovery
✅ **FR-5**: Multiple blocking items work correctly (belt + suspenders)
✅ **FR-6**: Armor can block all underlying layers
✅ **FR-7**: Explicit item ID blocking works
✅ **FR-8**: Items without blocking component work unchanged

### 12.2 Technical Requirements

✅ **TR-1**: Component schema validates correctly
✅ **TR-2**: `isRemovalBlocked` operator registered and functional
✅ **TR-3**: Scope resolution filters blocked items efficiently
✅ **TR-4**: No circular blocking dependencies allowed
✅ **TR-5**: All tests pass (unit, integration, e2e)
✅ **TR-6**: Code coverage ≥ 80% for new code
✅ **TR-7**: ESLint passes on all modified files
✅ **TR-8**: Type checking passes

### 12.3 User Experience Requirements

✅ **UX-1**: Clear error messages when removal blocked
✅ **UX-2**: Blocked items simply don't appear (no confusing availability)
✅ **UX-3**: Removal order feels natural (accessories before base layers)
✅ **UX-4**: Performance impact negligible (< 5ms per scope resolution)

---

## 13. Implementation Roadmap

### 13.1 Phase 1: Foundation (2-3 hours)

**Tasks**:
1. Create `clothing:blocks_removal` component schema
2. Validate schema with `npm run validate`
3. Create unit tests for component structure
4. Document component in inline comments

**Deliverables**:
- ✅ Component schema file
- ✅ Schema passes validation
- ✅ Basic unit tests

### 13.2 Phase 2: Core Logic (3-4 hours)

**Tasks**:
1. Implement `IsRemovalBlockedOperator` class
2. Register operator in DI container
3. Create comprehensive unit tests
4. Add operator to JSON Logic engine

**Deliverables**:
- ✅ Operator implementation
- ✅ Unit tests (80%+ coverage)
- ✅ DI registration complete

### 13.3 Phase 3: Scope Integration (2-3 hours)

**Tasks**:
1. Modify `slotAccessResolver.js` to filter blocked items
2. Add helper methods for blocking checks
3. Create integration tests for scope resolution
4. Verify performance impact

**Deliverables**:
- ✅ Updated scope resolver
- ✅ Integration tests pass
- ✅ Performance benchmarks acceptable

### 13.4 Phase 4: Action Integration (1-2 hours)

**Tasks**:
1. Create `can-remove-item` condition
2. Update `remove_clothing` action prerequisites
3. Update `remove_others_clothing` action prerequisites
4. Test action discovery filtering

**Deliverables**:
- ✅ Condition definition
- ✅ Updated action files
- ✅ Actions filter correctly

### 13.5 Phase 5: Content Updates (2-3 hours)

**Tasks**:
1. Update belt entities with `blocks_removal` component
2. Create example armor with full blocking
3. Update mod manifests if needed
4. Run full validation suite

**Deliverables**:
- ✅ Updated belt entities
- ✅ Example armor entity
- ✅ All validation passes

### 13.6 Phase 6: Testing & Documentation (3-4 hours)

**Tasks**:
1. Create comprehensive integration tests
2. Create E2E workflow tests
3. Write user-facing documentation
4. Update developer documentation
5. Create troubleshooting guide

**Deliverables**:
- ✅ Full test suite passes
- ✅ Documentation complete
- ✅ Troubleshooting guide

**Total Estimated Effort**: 13-19 hours

---

## 14. Open Questions

### 14.1 Design Decisions

**Q1**: Should we automatically cascade removal (remove belt when removing pants)?
**Current Decision**: No - require explicit user action. Cascading could be Phase 2 feature.
**Rationale**: Explicit control gives players more agency; cascading can be confusing.

**Q2**: Should loosening (vs removing) be implemented in Phase 1?
**Current Decision**: Define `must_loosen_first` block type but defer implementation.
**Rationale**: Complex state management; can add in future enhancement.

**Q3**: Should armor always use `full_block` or allow selective blocking?
**Current Decision**: Allow both; modders choose based on armor type.
**Rationale**: Light armor might allow partial access; heavy armor blocks everything.

**Q4**: How to handle tucked clothing states?
**Current Decision**: Defer to future enhancement with state components.
**Rationale**: Adds complexity; solve core blocking first.

### 14.2 Edge Cases

**EC1**: What if player removes blocking item during AI turn?
**Resolution**: Re-validate available actions at turn start; blocked actions disappear.

**EC2**: What if mod updates add blocking to previously non-blocking items?
**Resolution**: Blocking only affects new game states; existing saves work.

**EC3**: What if circular blocking is accidentally created?
**Resolution**: Validation during mod loading throws error with clear message.

**EC4**: What about items that block themselves from removal (cursed items)?
**Resolution**: Use separate `cursed` or `bound` marker component; different mechanic.

---

## 15. Future Enhancements

### 15.1 Dynamic Blocking (Phase 2)

**Feature**: Blocking rules that change based on item state.

**Examples**:
- Buttoned jacket blocks shirt (unbuttoned doesn't)
- Zipped dress blocks underwear (unzipped allows access)
- Tied robe blocks everything (untied doesn't)

**Implementation**:
- Add `state` field to `blocks_removal` component
- Add conditions to blocking rules
- Update operator to check state

### 15.2 Loosen Action (Phase 2)

**Feature**: Add `loosen_belt` action that allows pants removal without full belt removal.

**Implementation**:
- New `clothing:loosened` state component
- `must_loosen_first` block type checks loosened state
- New action: `loosen_clothing`

### 15.3 Cascading Removal (Phase 3)

**Feature**: Automatically remove blocking items when removing blocked item.

**Implementation**:
- Add `cascade_unequip: true` option to `UNEQUIP_CLOTHING` operation
- Prompt user: "Remove belt first?" or auto-remove
- Dispatch events for each cascaded removal

### 15.4 Assistance Requirements (Phase 3)

**Feature**: Some items require another actor's help to remove.

**Examples**:
- Back-zippered dress
- Corset lacing
- Complex armor

**Implementation**:
- New `requires_assistance` component
- Update actions to require secondary actor
- Add `help_remove_clothing` action

---

## 16. Risk Assessment

### 16.1 Technical Risks

**Risk**: Performance impact on scope resolution
**Mitigation**: Early benchmarking; optimize blocking checks
**Likelihood**: Low
**Impact**: Medium

**Risk**: Circular dependency bugs in content
**Mitigation**: Validation during mod loading; clear error messages
**Likelihood**: Medium
**Impact**: High

**Risk**: Backward compatibility breaks
**Mitigation**: Optional component; thorough regression testing
**Likelihood**: Low
**Impact**: High

### 16.2 Content Risks

**Risk**: Modders create overly complex blocking rules
**Mitigation**: Clear documentation; examples; best practices guide
**Likelihood**: Medium
**Impact**: Low

**Risk**: Existing mods need updates
**Mitigation**: Backward compatible; gradual migration; migration guide
**Likelihood**: High
**Impact**: Low

---

## 17. Success Metrics

### 17.1 Technical Metrics

- ✅ Unit test coverage ≥ 80%
- ✅ Integration test coverage ≥ 80%
- ✅ All E2E tests pass
- ✅ ESLint passes
- ✅ Type checking passes
- ✅ Scope resolution performance < 5ms impact

### 17.2 Functional Metrics

- ✅ Belt blocks pants removal correctly
- ✅ Armor blocks underlying clothing
- ✅ Multiple blockers work correctly
- ✅ Removing blocker unblocks items
- ✅ No false positives (unrelated items blocked)
- ✅ No false negatives (should-block items not blocked)

### 17.3 User Experience Metrics

- ✅ Clothing removal feels realistic
- ✅ No confusing action availability
- ✅ Clear error messages when applicable
- ✅ Natural removal order enforced

---

## 18. Appendix: Code Examples

### 18.1 Complete Belt Entity

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:black_calfskin_belt",
  "description": "Black calfskin belt with brushed-brass buckle that secures waist garments",
  "components": {
    "core:name": {
      "text": "belt"
    },
    "core:description": {
      "text": "A sleek black belt made from supple calfskin leather, featuring a rectangular brushed-brass buckle with subtle wear patterns that hint at regular use."
    },
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["accessories"]
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_lower"],
      "coveragePriority": "accessories"
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
    "core:color": {
      "colorName": "black"
    },
    "items:portable": {
      "canBePickedUp": true
    }
  }
}
```

### 18.2 Integration Test Example

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('Clothing Removal Blocking', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('clothing', 'clothing:remove_clothing');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should block pants removal when belt is equipped', async () => {
    // Arrange: Create actor with belt and pants
    const actor = fixture.createEntity('test_actor', [
      'core:actor',
      'anatomy:body',
      'clothing:equipment',
    ]);

    const belt = fixture.createEntity('belt', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
      },
    });

    const pants = fixture.createEntity('pants', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    // Equip both items
    fixture.equipItem(actor.id, belt.id);
    fixture.equipItem(actor.id, pants.id);

    // Act: Resolve topmost_clothing scope
    const topmostClothing = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Assert: Pants should NOT be in topmost clothing (blocked by belt)
    expect(topmostClothing).not.toContain(pants.id);
    expect(topmostClothing).toContain(belt.id);
  });

  it('should allow pants removal after belt removed', async () => {
    // Arrange: Create actor with belt and pants (as above)
    const actor = fixture.createEntity('test_actor', [
      'core:actor',
      'anatomy:body',
      'clothing:equipment',
    ]);

    const belt = fixture.createEntity('belt', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
      },
    });

    const pants = fixture.createEntity('pants', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    fixture.equipItem(actor.id, belt.id);
    fixture.equipItem(actor.id, pants.id);

    // Act: Remove belt
    await fixture.executeAction(actor.id, belt.id);

    // Resolve topmost_clothing scope again
    const topmostClothing = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Assert: Pants should NOW be in topmost clothing
    expect(topmostClothing).toContain(pants.id);
    expect(topmostClothing).not.toContain(belt.id); // Belt removed
  });
});
```

---

**End of Specification**
