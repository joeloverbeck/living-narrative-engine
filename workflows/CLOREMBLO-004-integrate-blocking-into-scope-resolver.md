# CLOREMBLO-004: Integrate Removal Blocking into ClothingAccessibilityService

**Category**: Clothing System Enhancement
**Priority**: High
**Estimated Effort**: 3-4 hours
**Phase**: 3 - Scope Integration

**⚠️ UPDATED:** This workflow has been corrected based on actual codebase architecture analysis.

---

## Overview

Modify the `ClothingAccessibilityService` to filter out items that are blocked from removal (via `clothing:blocks_removal` component) when resolving accessible clothing items. This prevents blocked items from appearing in action discovery, creating a natural and intuitive clothing removal experience.

---

## Background

Currently, `topmost_clothing` scope resolution uses:
1. **Coverage blocking** (already implemented) - Items with higher coverage priority block lower priority items
2. **Layer priority** - Within same coverage, uses layer ordering (accessories > outer > base > underwear)

However, it does NOT consider **removal blocking** via the `clothing:blocks_removal` component. This component defines explicit blocking relationships (e.g., belt blocks pants, armor blocks shirt).

After this implementation:
- Belt equipped → pants don't appear in `topmost_clothing`
- Belt removed → pants appear in `topmost_clothing`
- Armor equipped → underlying clothing doesn't appear
- Multiple blockers → all must be removed before blocked items appear

This filtering happens during clothing accessibility calculation, ensuring blocked items never appear in scope resolution results.

---

## Architecture Understanding

### Current Resolution Flow

```
Scope: actor.topmost_clothing[]
↓
ClothingStepResolver (field: topmost_clothing)
↓
ArrayIterationResolver (detects __isClothingAccessObject)
↓
ClothingAccessibilityService.getAccessibleItems()
  ├─ #parseEquipmentSlots()
  ├─ #applyCoverageBlocking() → CoverageAnalyzer (COVERAGE blocking only)
  ├─ #applyModeLogic()
  └─ #sortByPriority()
↓
Returns filtered item IDs
```

**Key Insight:** `SlotAccessResolver` handles ONLY slot-specific access (e.g., `actor.topmost_clothing.torso_upper`), NOT array iteration. Array iteration goes through `ClothingAccessibilityService`.

---

## Requirements

### File Modification

**File**: `src/clothing/services/clothingAccessibilityService.js`

**Location of Changes**: In the `getAccessibleItems()` method, ADD a new blocking check AFTER coverage blocking, BEFORE mode logic.

### Implementation Strategy

1. **Add Removal Blocking Method**: Create `#applyRemovalBlocking()` to filter items blocked by `clothing:blocks_removal`
2. **Extract Shared Logic**: Use logic from `IsRemovalBlockedOperator` or extract to shared utility
3. **Integrate into Flow**: Call after coverage blocking in `getAccessibleItems()`
4. **Add Logging**: Debug logging for filtered items
5. **Handle Arrays**: Support both single item and array formats in equipment slots

### Code Changes

#### 1. Add Removal Blocking Method

Add this private method to the `ClothingAccessibilityService` class:

```javascript
/**
 * Apply removal blocking based on clothing:blocks_removal component
 *
 * @private
 * @param {Array} items - Array of equipped items to filter
 * @param {string} entityId - Entity ID wearing the clothing
 * @param {object} equipment - Equipment state object
 * @returns {Array} Filtered items with blocked items removed
 */
#applyRemovalBlocking(items, entityId, equipment) {
  // Get all equipped items for checking blocking relationships
  const allEquippedItems = this.#parseEquipmentSlots(equipment);

  // Filter out items that are blocked
  return items.filter((targetItem) => {
    // Get target item's wearable data
    const targetWearable = this.#entityManager.getComponentData(
      targetItem.itemId,
      'clothing:wearable'
    );

    if (!targetWearable) {
      return true; // Include non-wearable items (shouldn't happen)
    }

    // Check if any equipped item blocks this target item
    for (const equippedItem of allEquippedItems) {
      // Skip self
      if (equippedItem.itemId === targetItem.itemId) {
        continue;
      }

      // Check if this equipped item has blocking component
      if (!this.#entityManager.hasComponent(equippedItem.itemId, 'clothing:blocks_removal')) {
        continue;
      }

      const blocking = this.#entityManager.getComponentData(
        equippedItem.itemId,
        'clothing:blocks_removal'
      );

      // Check slot-based blocking
      if (blocking.blockedSlots) {
        const targetSlot = targetWearable.equipmentSlots?.primary;
        const targetLayer = targetWearable.layer;

        if (targetSlot && targetLayer) {
          for (const rule of blocking.blockedSlots) {
            if (rule.slot === targetSlot && rule.layers.includes(targetLayer)) {
              this.#logger.debug('Filtering blocked item from accessible items', {
                targetItemId: targetItem.itemId,
                blockedBy: equippedItem.itemId,
                reason: 'slot_based_blocking',
              });
              return false; // Item is blocked
            }
          }
        }
      }

      // Check explicit item ID blocking
      if (blocking.blocksRemovalOf?.includes(targetItem.itemId)) {
        this.#logger.debug('Filtering explicitly blocked item from accessible items', {
          targetItemId: targetItem.itemId,
          blockedBy: equippedItem.itemId,
          reason: 'explicit_id_blocking',
        });
        return false; // Item is blocked
      }
    }

    return true; // Item is not blocked
  });
}
```

#### 2. Modify getAccessibleItems Method

In the `getAccessibleItems()` method, add removal blocking AFTER coverage blocking:

```javascript
// EXISTING CODE: Apply coverage blocking
const accessibleItems = this.#applyCoverageBlocking(
  filteredItems,
  entityId,
  equipment,
  mode
);
this.#logger.debug('ClothingAccessibilityService: After coverage blocking', {
  accessibleItems,
});

// NEW CODE: Apply removal blocking (belt blocks pants, etc.)
const removalFilteredItems = this.#applyRemovalBlocking(
  accessibleItems,
  entityId,
  equipment
);
this.#logger.debug('ClothingAccessibilityService: After removal blocking', {
  removalFilteredItems,
});

// EXISTING CODE: Apply mode-specific logic (continue with removalFilteredItems)
let result = this.#applyModeLogic(removalFilteredItems, mode);
```

### Design Rationale

1. **Centralized Service**: All accessibility logic in one place (ClothingAccessibilityService)
2. **Separation of Concerns**: Coverage blocking vs. removal blocking are separate concerns
3. **Reusable Logic**: Same service used by scope resolution AND action validation
4. **Performance**: Checks only equipped items (O(n × m) where n = items, m = blockers)
5. **Logging**: Debug logging helps troubleshoot complex blocking scenarios
6. **Fail-Safe**: Errors don't break clothing system (logged and continue)
7. **Cache Invalidation**: Cache clearing ensures blocking state stays current

---

## Implementation Tasks

### 1. Read Current Implementation

**File**: `src/clothing/services/clothingAccessibilityService.js`

Read the file to understand:
- Current structure of `getAccessibleItems()` method
- How `#applyCoverageBlocking()` works
- Where to add removal blocking (after coverage, before mode logic)
- Existing helper methods pattern

### 2. Add Removal Blocking Method

Add the `#applyRemovalBlocking()` private method to the class. Place it near `#applyCoverageBlocking()` for logical grouping.

### 3. Modify getAccessibleItems

In the `getAccessibleItems()` method, add a call to `#applyRemovalBlocking()` after coverage blocking but before mode logic application.

### 4. Create Unit Tests

**File**: `tests/unit/clothing/services/clothingAccessibilityServiceBlocking.test.js`

**Test Coverage**:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ClothingAccessibilityService } from '../../../../src/clothing/services/clothingAccessibilityService.js';
import { createTestBed } from '../../../common/testBed.js';

describe('ClothingAccessibilityService - Removal Blocking', () => {
  let testBed;
  let service;
  let entityManager;
  let logger;

  beforeEach(() => {
    testBed = createTestBed();
    entityManager = testBed.resolve('IEntityManager');
    logger = testBed.resolve('ILogger');

    // Create service with test dependencies
    service = new ClothingAccessibilityService({
      logger,
      entityManager,
      entitiesGateway: {
        getComponentData: (entityId, componentId) =>
          entityManager.getComponentData(entityId, componentId)
      }
    });
  });

  describe('Removal Blocking Integration', () => {
    it('should filter out pants when belt is equipped', () => {
      // Arrange
      const actor = testBed.createEntity('actor1', ['clothing:equipment']);
      const belt = testBed.createEntity('belt1', [
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
      const pants = testBed.createEntity('pants1', ['clothing:wearable'], {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' },
        },
      });

      testBed.equipItem(actor.id, belt.id);
      testBed.equipItem(actor.id, pants.id);

      // Act
      const accessible = service.getAccessibleItems(actor.id, { mode: 'topmost' });

      // Assert
      expect(accessible).toContain(belt.id);
      expect(accessible).not.toContain(pants.id);
    });

    it('should include pants after belt is removed', () => {
      // Arrange
      const actor = testBed.createEntity('actor1', ['clothing:equipment']);
      const belt = testBed.createEntity('belt1', [
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
      const pants = testBed.createEntity('pants1', ['clothing:wearable'], {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' },
        },
      });

      testBed.equipItem(actor.id, belt.id);
      testBed.equipItem(actor.id, pants.id);

      // Remove belt
      testBed.unequipItem(actor.id, belt.id);

      // Clear cache after equipment change
      service.clearCache(actor.id);

      // Act
      const accessible = service.getAccessibleItems(actor.id, { mode: 'topmost' });

      // Assert
      expect(accessible).not.toContain(belt.id);
      expect(accessible).toContain(pants.id);
    });

    it('should handle multiple blocking items', () => {
      // Arrange
      const actor = testBed.createEntity('actor1', ['clothing:equipment']);
      const belt = testBed.createEntity('belt1', [
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
      const suspenders = testBed.createEntity('suspenders1', [
        'clothing:wearable',
        'clothing:blocks_removal',
      ], {
        'clothing:wearable': {
          layer: 'accessories',
          equipmentSlots: { primary: 'torso_upper' },
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
      const pants = testBed.createEntity('pants1', ['clothing:wearable'], {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' },
        },
      });

      testBed.equipItem(actor.id, belt.id);
      testBed.equipItem(actor.id, suspenders.id);
      testBed.equipItem(actor.id, pants.id);

      // Act
      const topmost = resolver.resolveTopmostClothing(actor.id);

      // Assert
      expect(topmost).toContain(belt.id);
      expect(topmost).toContain(suspenders.id);
      expect(topmost).not.toContain(pants.id);
    });

    it('should not filter items without blocking', () => {
      // Arrange
      const actor = testBed.createEntity('actor1', ['clothing:equipment']);
      const shirt = testBed.createEntity('shirt1', ['clothing:wearable'], {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'torso_upper' },
        },
      });
      const pants = testBed.createEntity('pants1', ['clothing:wearable'], {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' },
        },
      });

      testBed.equipItem(actor.id, shirt.id);
      testBed.equipItem(actor.id, pants.id);

      // Act
      const topmost = resolver.resolveTopmostClothing(actor.id);

      // Assert
      expect(topmost).toContain(shirt.id);
      expect(topmost).toContain(pants.id);
    });

    it('should handle armor blocking base layers', () => {
      // Arrange
      const actor = testBed.createEntity('actor1', ['clothing:equipment']);
      const armor = testBed.createEntity('cuirass1', [
        'clothing:wearable',
        'clothing:blocks_removal',
      ], {
        'clothing:wearable': {
          layer: 'outer',
          equipmentSlots: { primary: 'torso_upper' },
        },
        'clothing:blocks_removal': {
          blockedSlots: [
            {
              slot: 'torso_upper',
              layers: ['base', 'underwear'],
              blockType: 'full_block',
            },
          ],
        },
      });
      const shirt = testBed.createEntity('shirt1', ['clothing:wearable'], {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'torso_upper' },
        },
      });

      testBed.equipItem(actor.id, armor.id);
      testBed.equipItem(actor.id, shirt.id);

      // Act
      const topmost = resolver.resolveTopmostClothing(actor.id);

      // Assert
      expect(topmost).toContain(armor.id);
      expect(topmost).not.toContain(shirt.id);
    });

    it('should handle explicit item ID blocking', () => {
      // Arrange
      const actor = testBed.createEntity('actor1', ['clothing:equipment']);
      const artifact1 = testBed.createEntity('artifact1', ['clothing:wearable'], {
        'clothing:wearable': {
          layer: 'accessories',
          equipmentSlots: { primary: 'hands' },
        },
      });
      const artifact2 = testBed.createEntity('artifact2', [
        'clothing:wearable',
        'clothing:blocks_removal',
      ], {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'hands' },
        },
        'clothing:blocks_removal': {
          blocksRemovalOf: ['artifact1'],
        },
      });

      testBed.equipItem(actor.id, artifact1.id);
      testBed.equipItem(actor.id, artifact2.id);

      // Act
      const topmost = resolver.resolveTopmostClothing(actor.id);

      // Assert
      expect(topmost).toContain(artifact2.id);
      expect(topmost).not.toContain(artifact1.id);
    });
  });

  describe('Edge Cases', () => {
    it('should not block item from blocking itself', () => {
      // Arrange
      const actor = testBed.createEntity('actor1', ['clothing:equipment']);
      const belt = testBed.createEntity('belt1', [
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
              slot: 'torso_lower',
              layers: ['accessories'],
              blockType: 'must_remove_first',
            },
          ],
        },
      });

      testBed.equipItem(actor.id, belt.id);

      // Act
      const topmost = resolver.resolveTopmostClothing(actor.id);

      // Assert
      expect(topmost).toContain(belt.id); // Should not block itself
    });

    it('should handle missing components gracefully', () => {
      // Arrange
      const actor = testBed.createEntity('actor1', ['clothing:equipment']);
      const item = testBed.createEntity('item1', ['clothing:wearable'], {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'torso_upper' },
        },
      });

      testBed.equipItem(actor.id, item.id);

      // Act & Assert: Should not throw
      expect(() => {
        resolver.resolveTopmostClothing(actor.id);
      }).not.toThrow();
    });
  });
});
```

### 5. Create Integration Tests

**File**: `tests/integration/clothing/topmostClothingBlocking.integration.test.js`

**Test Coverage**:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('Topmost Clothing Blocking Integration', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('clothing', 'clothing:remove_clothing');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should prevent pants from appearing in topmost_clothing when belt equipped', async () => {
    // Arrange
    const actor = fixture.createStandardActor('John');
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

    // Act
    const topmostClothing = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Assert
    expect(topmostClothing).toContain(belt.id);
    expect(topmostClothing).not.toContain(pants.id);
  });

  it('should allow pants removal after belt removed', async () => {
    // Arrange
    const actor = fixture.createStandardActor('John');
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

    // Resolve scope again
    const topmostClothing = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Assert
    expect(topmostClothing).toContain(pants.id);
    expect(topmostClothing).not.toContain(belt.id);
  });
});
```

### 6. Add Cache Invalidation

When equipment changes, the cache must be invalidated. Check if this is already handled or needs to be added.

**Possible locations to add cache invalidation:**
- `EquipClothingHandler` - after successful equip
- `RemoveClothingHandler` - after successful removal
- Any operation that modifies `clothing:equipment`

```javascript
// Example: In operation handler after equipment change
this.#clothingAccessibilityService.clearCache(actorId);
```

### 7. Run Tests

```bash
# Unit tests
NODE_ENV=test npm run test:unit -- tests/unit/clothing/services/clothingAccessibilityServiceBlocking.test.js

# Integration tests
NODE_ENV=test npm run test:integration -- tests/integration/clothing/topmostClothingBlocking.integration.test.js
```

### 8. Performance Benchmarking

Create a simple performance test to verify blocking checks don't significantly impact accessibility queries:

```javascript
const iterations = 1000;
const start = performance.now();

for (let i = 0; i < iterations; i++) {
  service.clearAllCache(); // Ensure no cache hits
  service.getAccessibleItems(actorId, { mode: 'topmost' });
}

const end = performance.now();
const avgTime = (end - start) / iterations;

console.log(`Average time: ${avgTime}ms`);
// Target: < 10ms per query (includes coverage + removal blocking)
```

---

## Validation

### Unit Tests

```bash
NODE_ENV=test npm run test:unit -- tests/unit/clothing/services/clothingAccessibilityServiceBlocking.test.js
```

Expected: All tests pass, coverage ≥ 80%.

### Integration Tests

```bash
NODE_ENV=test npm run test:integration -- tests/integration/clothing/topmostClothingBlocking.integration.test.js
```

Expected: All tests pass, scope resolution returns correct blocked/unblocked items.

### Type Checking

```bash
npm run typecheck
```

Expected: No errors.

### ESLint

```bash
npx eslint src/clothing/services/clothingAccessibilityService.js
```

Expected: No warnings or errors.

### Performance

Performance impact should be < 10ms per accessibility query with both coverage and removal blocking.

---

## Acceptance Criteria

- [ ] `#applyRemovalBlocking()` method added to `ClothingAccessibilityService` class
- [ ] `getAccessibleItems()` method modified to call removal blocking after coverage blocking
- [ ] Blocking logic checks `clothing:blocks_removal` component for all equipped items
- [ ] Self-exclusion logic prevents items from blocking themselves
- [ ] Debug logging added for filtered items (with blocking reason)
- [ ] Cache invalidation added to equipment modification operations
- [ ] Unit tests created and passing (≥ 80% coverage)
- [ ] Integration tests created and passing (scope resolution)
- [ ] Performance benchmarks acceptable (< 10ms per query)
- [ ] ESLint passes
- [ ] Type checking passes
- [ ] No regression in existing clothing resolution or coverage blocking

---

## Notes

- Removal blocking is separate from coverage blocking (two different systems)
- Filtering happens in ClothingAccessibilityService (before scope resolution returns)
- Performance is O(n × m) where n = candidate items, m = equipped items with blocks_removal
- Debug logging includes blocking reason (slot_based or explicit_id)
- Fail-safe design: errors don't break clothing system (logged and continue)
- Cache must be invalidated when equipment changes (critical for correctness)
- `IsRemovalBlockedOperator` provides similar logic for action validation (different use case)

---

## Common Pitfalls

**Pitfall**: Modifying wrong file (slotAccessResolver.js)
**Solution**: Modify clothingAccessibilityService.js (handles array iteration)

**Pitfall**: Blocking an item from blocking itself
**Solution**: Skip target item with `equippedItem.itemId === targetItem.itemId` check

**Pitfall**: Not clearing cache after equipment changes
**Solution**: Call `clearCache(entityId)` in equipment modification handlers

**Pitfall**: Breaking existing coverage blocking
**Solution**: Add removal blocking AFTER coverage blocking, don't replace it

**Pitfall**: Confusing coverage blocking with removal blocking
**Solution**: They're separate systems - coverage is priority-based, removal is component-based

**Pitfall**: Performance degradation with many items
**Solution**: Early exits when no blocks_removal component found

---

## Related Tickets

- **CLOREMBLO-002**: Implement IsRemovalBlockedOperator (provides logic pattern)
- **CLOREMBLO-003**: Register operator in DI container (prerequisite)
- **CLOREMBLO-005**: Create can-remove-item condition (complementary validation)
- **CLOREMBLO-007**: Create comprehensive test suite (validates this)
