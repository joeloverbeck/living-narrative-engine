# CLOREMBLO-004: Integrate Blocking Logic into SlotAccessResolver

**Category**: Clothing System Enhancement
**Priority**: High
**Estimated Effort**: 2-3 hours
**Phase**: 3 - Scope Integration

---

## Overview

Modify the `slotAccessResolver.js` to filter out items that are blocked from removal when resolving the `topmost_clothing` scope. This prevents blocked items from appearing in action discovery, creating a natural and intuitive clothing removal experience.

---

## Background

Currently, `topmost_clothing` scope resolution uses only layer priority (accessories > outer > base > underwear) to determine which items are removable. This doesn't consider blocking relationships between items.

After this implementation:
- Belt equipped → pants don't appear in `topmost_clothing`
- Belt removed → pants appear in `topmost_clothing`
- Armor equipped → underlying clothing doesn't appear
- Multiple blockers → all must be removed before blocked items appear

This filtering happens at scope resolution time, ensuring blocked items never appear in action discovery in the first place.

---

## Requirements

### File Modification

**File**: `src/scopeDsl/nodes/slotAccessResolver.js`

**Location of Changes**: In the `resolveTopmostClothing` method, AFTER getting topmost candidates per slot, BEFORE returning results.

### Implementation Strategy

1. **Add Blocking Check Method**: Create a private method to check if an item is blocked
2. **Filter Candidates**: Apply blocking filter to topmost candidates
3. **Preserve Performance**: Minimize additional checks
4. **Add Logging**: Debug logging for filtered items

### Code Changes

#### 1. Add Helper Methods

Add these private helper methods to the `SlotAccessResolver` class:

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
            this.#logger.debug('Filtering blocked item from topmost_clothing', {
              targetItemId,
              blockedBy: equippedItemId,
            });
            return true;
          }
        }

        // Check explicit ID blocking
        if (blocking.blocksRemovalOf?.includes(targetItemId)) {
          this.#logger.debug('Filtering explicitly blocked item from topmost_clothing', {
            targetItemId,
            blockedBy: equippedItemId,
          });
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
 * @param {Object} targetWearable - Target item's wearable component
 * @param {Array} blockedSlots - Array of blocking rules
 * @returns {boolean} - true if blocked
 */
#itemMatchesBlockingRule(targetWearable, blockedSlots) {
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
```

#### 2. Modify resolveTopmostClothing Method

In the `resolveTopmostClothing` method, find where topmost candidates are returned. Add filtering logic:

```javascript
// EXISTING CODE: Get topmost candidates per slot
// ... existing logic to build candidates array ...

// NEW CODE: Filter out items that are blocked by other equipped items
const availableForRemoval = candidates.filter((candidate) => {
  // Check if any OTHER equipped item blocks this candidate
  const isBlocked = this.#checkIfRemovalBlocked(
    entityId,
    candidate.itemId,
    equipment.equipped
  );
  return !isBlocked;
});

// Log filtering results
if (candidates.length !== availableForRemoval.length) {
  this.#logger.debug('Filtered blocked items from topmost_clothing', {
    totalCandidates: candidates.length,
    availableForRemoval: availableForRemoval.length,
    filtered: candidates.length - availableForRemoval.length,
  });
}

return availableForRemoval;
```

### Design Rationale

1. **Filtering at Scope Level**: Blocked items never appear in action discovery (cleaner UX)
2. **Code Duplication**: Helper methods duplicate operator logic (necessary for scope resolution)
3. **Performance**: Checks only equipped items (O(n) where n = number of equipped items)
4. **Logging**: Debug logging helps troubleshoot filtering issues
5. **Fail-Safe**: Returns unfiltered candidates on errors (allows gameplay to continue)

---

## Implementation Tasks

### 1. Read Current Implementation

**File**: `src/scopeDsl/nodes/slotAccessResolver.js`

Read the file to understand:
- Current structure of `resolveTopmostClothing` method
- How candidates are built
- Where to add filtering logic
- Existing helper methods pattern

### 2. Add Helper Methods

Add the two private helper methods (`#checkIfRemovalBlocked` and `#itemMatchesBlockingRule`) to the class. Place them near other helper methods for topmost clothing resolution.

### 3. Modify resolveTopmostClothing

Find the return statement in `resolveTopmostClothing` and add the filtering logic before it.

### 4. Create Unit Tests

**File**: `tests/unit/scopeDsl/nodes/slotAccessResolverBlocking.test.js`

**Test Coverage**:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('SlotAccessResolver - Blocking Integration', () => {
  let testBed;
  let resolver;

  beforeEach(() => {
    testBed = createTestBed();
    resolver = testBed.createSlotAccessResolver();
  });

  describe('Topmost Clothing Filtering', () => {
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
      const topmost = resolver.resolveTopmostClothing(actor.id);

      // Assert
      expect(topmost).toContain(belt.id);
      expect(topmost).not.toContain(pants.id);
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

      // Act
      const topmost = resolver.resolveTopmostClothing(actor.id);

      // Assert
      expect(topmost).not.toContain(belt.id);
      expect(topmost).toContain(pants.id);
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

### 6. Run Tests

```bash
# Unit tests
NODE_ENV=test npm run test:unit -- tests/unit/scopeDsl/nodes/slotAccessResolverBlocking.test.js

# Integration tests
NODE_ENV=test npm run test:integration -- tests/integration/clothing/topmostClothingBlocking.integration.test.js
```

### 7. Performance Benchmarking

Create a simple performance test to verify blocking checks don't significantly impact scope resolution:

```javascript
const iterations = 1000;
const start = performance.now();

for (let i = 0; i < iterations; i++) {
  resolver.resolveTopmostClothing(actorId);
}

const end = performance.now();
const avgTime = (end - start) / iterations;

console.log(`Average time: ${avgTime}ms`);
// Target: < 5ms per resolution
```

---

## Validation

### Unit Tests

```bash
NODE_ENV=test npm run test:unit -- tests/unit/scopeDsl/nodes/slotAccessResolverBlocking.test.js
```

Expected: All tests pass, coverage ≥ 80%.

### Integration Tests

```bash
NODE_ENV=test npm run test:integration -- tests/integration/clothing/topmostClothingBlocking.integration.test.js
```

Expected: All tests pass.

### Type Checking

```bash
npm run typecheck
```

Expected: No errors.

### ESLint

```bash
npx eslint src/scopeDsl/nodes/slotAccessResolver.js
```

Expected: No warnings or errors.

### Performance

Performance impact should be < 5ms per scope resolution with blocking checks.

---

## Acceptance Criteria

- [ ] Helper methods added to `SlotAccessResolver` class
- [ ] `resolveTopmostClothing` method modified to filter blocked items
- [ ] Filtering logic duplicates operator logic (for consistency)
- [ ] Self-exclusion logic prevents items from blocking themselves
- [ ] Debug logging added for filtered items
- [ ] Unit tests created and passing
- [ ] Integration tests created and passing
- [ ] Performance benchmarks acceptable (< 5ms impact)
- [ ] ESLint passes
- [ ] Type checking passes
- [ ] No regression in existing clothing resolution

---

## Notes

- Code duplication between operator and resolver is intentional (different contexts)
- Filtering happens before returning candidates (items never appear)
- Performance is O(n × m) where n = equipped items, m = blocking rules per item
- Debug logging helps troubleshoot complex blocking scenarios
- Fail-safe design: errors don't break clothing system

---

## Common Pitfalls

**Pitfall**: Blocking an item from blocking itself
**Solution**: Skip target item in blocking check loop

**Pitfall**: Not handling array vs single item in equipment
**Solution**: Normalize to array with `Array.isArray() ? items : [items]`

**Pitfall**: Breaking existing topmost_clothing logic
**Solution**: Add filtering AFTER existing candidate selection

**Pitfall**: Performance degradation with many items
**Solution**: Early exits, check only equipped items

---

## Related Tickets

- **CLOREMBLO-002**: Implement IsRemovalBlockedOperator (provides logic pattern)
- **CLOREMBLO-003**: Register operator in DI container (prerequisite)
- **CLOREMBLO-005**: Create can-remove-item condition (complementary validation)
- **CLOREMBLO-007**: Create comprehensive test suite (validates this)
