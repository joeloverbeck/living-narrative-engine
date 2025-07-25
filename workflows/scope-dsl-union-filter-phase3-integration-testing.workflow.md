# Phase 3: Integration Testing & Polish

**Phase**: 3 of 3  
**Feature**: Complete Integration and Release Preparation  
**Complexity**: Low  
**Timeline**: 2-3 days  
**Prerequisites**: Phases 1 and 2 complete

## Phase Overview

Final phase focusing on comprehensive integration testing, performance validation, edge case handling, and release preparation. This ensures both features work seamlessly together and the implementation is production-ready.

### Key Requirements

- Test union operator with enhanced filters
- Performance benchmarking and optimization
- Edge case validation and error handling
- Complete documentation and examples
- Migration guide for mod developers

### Success Criteria

- All feature combinations work correctly
- Performance impact <5% on complex queries
- Zero regression in existing functionality
- Documentation suitable for mod developers
- Ready for production release

---

## Ticket 3.1: Combined Feature Integration Tests

**File**: `tests/integration/scopeDsl/unionAndFilterCombined.test.js`  
**Time Estimate**: 3 hours  
**Dependencies**: Phases 1 & 2 complete  
**Complexity**: Medium

### Description

Create comprehensive tests that verify the union operator and enhanced filters work correctly together in complex real-world scenarios.

### Implementation Details

Create complete integration test file:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import createScopeDslEngine from '../../../src/scopeDsl/engine.js';
import { createMockEntity } from '../../common/testHelpers/entityHelpers.js';
import { createTestDependencies } from '../../common/testHelpers/dependencyHelpers.js';

describe('Union Operator + Enhanced Filters - Combined Integration', () => {
  let engine;
  let actorEntity;
  let locationEntity;
  let runtimeCtx;
  let mockComponentRegistry;

  beforeEach(() => {
    const deps = createTestDependencies();
    engine = createScopeDslEngine(deps);

    // Create rich test environment
    actorEntity = createMockEntity('test:actor', {
      'clothing:wearing': {
        slots: {
          'torso:upper': {
            items: ['leather_jacket', 'chainmail'],
            topmost: 'leather_jacket',
          },
          'torso:lower': {
            items: ['leather_pants', 'cloth_pants'],
            topmost: 'leather_pants',
          },
          head: {
            items: ['leather_helmet'],
            topmost: 'leather_helmet',
          },
          feet: {
            items: ['leather_boots', 'sandals'],
            topmost: 'leather_boots',
          },
        },
      },
      'inventory:items': {
        items: ['spare_jacket', 'health_potion', 'magic_sword', 'torch'],
      },
      'social:relationships': {
        followers: ['npc1', 'npc2'],
        partners: ['npc3'],
      },
    });

    locationEntity = createMockEntity('test:location', {
      'location:contents': {
        items: ['chest_armor', 'gold_coins', 'ancient_scroll'],
      },
    });

    // Rich component registry
    mockComponentRegistry = {
      getItemComponents: (itemId) => {
        const items = {
          // Clothing items
          leather_jacket: {
            'core:tags': { tags: ['waterproof', 'armor', 'leather', 'outer'] },
            'clothing:material': { type: 'leather', quality: 'high' },
            'clothing:armor': {
              rating: 8,
              protection: { physical: 8, magical: 2 },
            },
            'clothing:condition': { durability: 90, dirty: false },
          },
          chainmail: {
            'core:tags': { tags: ['armor', 'metal', 'base'] },
            'clothing:material': { type: 'steel', quality: 'high' },
            'clothing:armor': {
              rating: 12,
              protection: { physical: 12, magical: 0 },
            },
            'clothing:condition': { durability: 100, dirty: false },
          },
          leather_pants: {
            'core:tags': { tags: ['armor', 'leather', 'base'] },
            'clothing:material': { type: 'leather', quality: 'normal' },
            'clothing:armor': {
              rating: 5,
              protection: { physical: 5, magical: 1 },
            },
            'clothing:condition': { durability: 80, dirty: true },
          },
          cloth_pants: {
            'core:tags': { tags: ['casual', 'cloth', 'base'] },
            'clothing:material': { type: 'cloth', quality: 'normal' },
            'clothing:condition': { durability: 70, dirty: false },
          },
          leather_helmet: {
            'core:tags': { tags: ['armor', 'leather', 'protective'] },
            'clothing:material': { type: 'leather', quality: 'high' },
            'clothing:armor': {
              rating: 6,
              protection: { physical: 6, magical: 1 },
            },
            'clothing:condition': { durability: 95, dirty: false },
          },
          leather_boots: {
            'core:tags': {
              tags: ['waterproof', 'armor', 'leather', 'durable'],
            },
            'clothing:material': { type: 'leather', quality: 'high' },
            'clothing:armor': {
              rating: 4,
              protection: { physical: 4, magical: 0 },
            },
            'clothing:condition': { durability: 85, dirty: true },
          },
          sandals: {
            'core:tags': { tags: ['casual', 'light'] },
            'clothing:material': { type: 'cloth', quality: 'low' },
            'clothing:condition': { durability: 50, dirty: false },
          },
          spare_jacket: {
            'core:tags': { tags: ['casual', 'cloth', 'clean'] },
            'clothing:material': { type: 'wool', quality: 'normal' },
            'clothing:condition': { durability: 100, dirty: false },
          },
          // Non-clothing items
          health_potion: {
            'core:tags': { tags: ['consumable', 'healing', 'magic'] },
            'consumable:effects': { healing: 50, instant: true },
          },
          magic_sword: {
            'core:tags': { tags: ['weapon', 'magic', 'metal'] },
            'weapon:stats': { damage: 15, magical_damage: 5 },
          },
          torch: {
            'core:tags': { tags: ['tool', 'light_source'] },
            'tool:properties': { light_radius: 5, duration: 3600 },
          },
          chest_armor: {
            'core:tags': { tags: ['armor', 'metal', 'heavy'] },
            'clothing:armor': {
              rating: 15,
              protection: { physical: 15, magical: 3 },
            },
          },
          gold_coins: {
            'core:tags': { tags: ['valuable', 'currency'] },
            'item:value': { amount: 100, currency: 'gold' },
          },
          ancient_scroll: {
            'core:tags': { tags: ['readable', 'magic', 'ancient'] },
            'readable:content': { language: 'ancient', deciphered: false },
          },
        };
        return items[itemId] || null;
      },

      getEntitiesWithComponent: (componentId) => {
        if (componentId === 'core:actor') return new Set(['test:actor']);
        if (componentId === 'core:npc')
          return new Set(['npc1', 'npc2', 'npc3']);
        return new Set();
      },
    };

    // Mock entity manager
    const entityManager = {
      getEntity: (id) => {
        const entities = {
          'test:actor': actorEntity,
          'test:location': locationEntity,
          npc1: createMockEntity('npc1', {
            'core:tags': { tags: ['merchant'] },
          }),
          npc2: createMockEntity('npc2', { 'core:tags': { tags: ['guard'] } }),
          npc3: createMockEntity('npc3', {
            'core:tags': { tags: ['partner', 'mage'] },
          }),
        };
        return entities[id];
      },
    };

    runtimeCtx = {
      entityManager,
      componentRegistry: mockComponentRegistry,
    };
  });

  describe('Basic union + filter combinations', () => {
    it('should filter united clothing slots by material', () => {
      const expression = `(actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower | actor.topmost_clothing.head)[{
        "==": [{"var": "components.clothing:material.type"}, "leather"]
      }]`;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual([
        'leather_helmet',
        'leather_jacket',
        'leather_pants',
      ]);
    });

    it('should combine multiple unions with filters', () => {
      const expression = `(
        actor.topmost_clothing.torso_upper | 
        actor.topmost_clothing.torso_lower
      )[{"in": ["armor", {"var": "tags"}]}] | 
      actor.inventory[{"in": ["weapon", {"var": "tags"}]}]`;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual([
        'leather_jacket',
        'leather_pants',
        'magic_sword',
      ]);
    });

    it('should handle nested unions with filters', () => {
      // Get all high-quality leather items from worn and inventory
      const expression = `(
        actor.all_clothing | actor.inventory
      )[{
        "and": [
          {"==": [{"var": "components.clothing:material.type"}, "leather"]},
          {"==": [{"var": "quality"}, "high"]}
        ]
      }]`;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual([
        'leather_boots',
        'leather_helmet',
        'leather_jacket',
      ]);
    });
  });

  describe('Complex real-world scenarios', () => {
    it('should find all protective gear across multiple sources', () => {
      const expression = `(
        actor.all_clothing[{"in": ["armor", {"var": "tags"}]}] |
        actor.inventory[{"in": ["armor", {"var": "tags"}]}] |
        location.items[{"in": ["armor", {"var": "tags"}]}]
      )[{">": [{"var": "components.clothing:armor.rating"}, 10]}]`;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      // Only chainmail (12) and chest_armor (15) have rating > 10
      expect(Array.from(result).sort()).toEqual(['chainmail', 'chest_armor']);
    });

    it('should find all waterproof items worn on extremities', () => {
      const expression = `(
        actor.topmost_clothing.head |
        actor.topmost_clothing.feet |
        actor.topmost_clothing.hands
      )[{"in": ["waterproof", {"var": "tags"}]}]`;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual(['leather_boots']);
    });

    it('should combine entity and item queries with filters', () => {
      const expression = `(
        entities(core:actor) |
        entities(core:npc)
      ) | actor.all_clothing[{"in": ["magic", {"var": "tags"}]}]`;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(result).toContain('test:actor');
      expect(result).toContain('npc1');
      expect(result).toContain('npc2');
      expect(result).toContain('npc3');
      // No magic clothing in the test data
    });
  });

  describe('Advanced filtering with unions', () => {
    it('should apply different filters to different union branches', () => {
      // This tests parser precedence - filters apply before unions
      const expression = `
        actor.all_clothing[{"==": [{"var": "dirty"}, true]}] |
        actor.all_clothing[{"==": [{"var": "dirty"}, false]}]
      `;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      // Should get all clothing (dirty and clean)
      expect(result.size).toBe(7); // All clothing items
    });

    it('should handle OR conditions across united sets', () => {
      const expression = `(
        actor.all_clothing | actor.inventory
      )[{
        "or": [
          {"in": ["waterproof", {"var": "tags"}]},
          {"in": ["magic", {"var": "tags"}]},
          {">": [{"var": "components.clothing:armor.rating"}, 10]}
        ]
      }]`;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual([
        'chainmail', // rating > 10
        'health_potion', // magic tag
        'leather_boots', // waterproof
        'leather_jacket', // waterproof
        'magic_sword', // magic tag
      ]);
    });

    it('should support quality-based filtering across all items', () => {
      const expression = `(
        actor.all_clothing | 
        actor.inventory |
        location.items
      )[{
        "and": [
          {"!=": [{"var": "components.clothing:material.quality"}, "low"]},
          {"in": ["armor", {"var": "tags"}]}
        ]
      }]`;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      // All armor except low quality
      expect(Array.from(result).sort()).toEqual([
        'chainmail',
        'chest_armor',
        'leather_boots',
        'leather_helmet',
        'leather_jacket',
        'leather_pants',
      ]);
    });
  });

  describe('Performance with complex queries', () => {
    it('should handle large unions with filters efficiently', () => {
      // Create actor with many items
      const manyItems = Array.from({ length: 500 }, (_, i) => `item${i}`);
      actorEntity.components.set('inventory:items', {
        items: [...manyItems.slice(0, 250)],
      });
      actorEntity.components.set('storage:items', {
        items: [...manyItems.slice(250)],
      });

      // Mock components
      mockComponentRegistry.getItemComponents = (itemId) => {
        const num = parseInt(itemId.replace('item', ''));
        return {
          'core:tags': {
            tags: num % 3 === 0 ? ['special', 'rare'] : ['common'],
          },
          'item:properties': {
            value: num,
            quality: num % 10 === 0 ? 'high' : 'normal',
          },
        };
      };

      const start = Date.now();
      const expression = `(
        actor.inventory | actor.storage
      )[{
        "and": [
          {"in": ["special", {"var": "tags"}]},
          {"==": [{"var": "quality"}, "high"]}
        ]
      }]`;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);
      const duration = Date.now() - start;

      // Items divisible by 30 (both 3 and 10)
      expect(result.size).toBe(Math.floor(500 / 30) + 1);
      expect(duration).toBeLessThan(200); // Should be fast even with 500 items
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty union branches with filters', () => {
      actorEntity.components.set('clothing:wearing', { slots: {} });

      const expression = `(
        actor.all_clothing | 
        actor.nonexistent
      )[{"in": ["armor", {"var": "tags"}]}]`;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual([]); // Empty result
    });

    it('should handle filter errors in union branches gracefully', () => {
      mockComponentRegistry.getItemComponents = (itemId) => {
        if (itemId === 'error_item') {
          throw new Error('Component lookup failed');
        }
        return { 'core:tags': { tags: ['normal'] } };
      };

      actorEntity.components.set('inventory:items', {
        items: ['error_item', 'good_item'],
      });

      const expression =
        'actor.inventory[][{"in": ["normal", {"var": "tags"}]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      // Should still include good_item despite error_item failing
      expect(Array.from(result)).toEqual(['good_item']);
    });

    it('should handle deeply nested unions with filters', () => {
      const expression = `(
        (actor.topmost_clothing.head | actor.topmost_clothing.torso_upper) |
        (actor.topmost_clothing.feet | actor.topmost_clothing.torso_lower)
      )[{">": [{"var": "durability"}, 80]}]`;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual([
        'leather_boots', // 85
        'leather_helmet', // 95
        'leather_jacket', // 90
      ]);
    });
  });

  describe('Migration scenarios', () => {
    it('should support old and new syntax in same query', () => {
      // Mix of + and | operators
      const expression = `
        actor.followers + actor.partners |
        actor.all_clothing[{"in": ["partner", {"var": "tags"}]}]
      `;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(result).toContain('npc1');
      expect(result).toContain('npc2');
      expect(result).toContain('npc3');
    });

    it('should maintain backward compatibility with entity filters', () => {
      const expression = `(
        actor.followers | actor.partners
      )[{"in": ["mage", {"var": "components.core:tags.tags"}]}]`;

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual(['npc3']); // Partner is a mage
    });
  });
});
```

### Verification Steps

1. Run combined tests: `npm run test:integration -- unionAndFilterCombined.test.js`
2. Verify all scenarios pass
3. Check performance tests meet targets
4. Ensure edge cases handled properly

### Acceptance Criteria

- [ ] Union + filter combinations work correctly
- [ ] Complex nested queries supported
- [ ] Performance acceptable for large datasets
- [ ] Edge cases handled gracefully
- [ ] Backward compatibility maintained

---

## Ticket 3.2: Performance Benchmarking Suite

**File**: `tests/performance/scopeDsl/unionAndFilterPerformance.test.js`  
**Time Estimate**: 2 hours  
**Dependencies**: All features implemented  
**Complexity**: Medium

### Description

Create a comprehensive performance benchmark suite to validate that the new features meet performance requirements (<5% overhead).

### Implementation Details

Create performance benchmark file:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import createScopeDslEngine from '../../../src/scopeDsl/engine.js';
import { performance } from 'perf_hooks';

describe('Union & Filter Performance Benchmarks', () => {
  let engine;
  let baselineEngine;
  let largeDataset;
  let runtimeCtx;

  beforeEach(() => {
    // Create engine with new features
    engine = createScopeDslEngine({
      logger: { debug: () => {}, error: () => {} },
    });

    // Create baseline engine (simulate old version)
    baselineEngine = createScopeDslEngine({
      logger: { debug: () => {}, error: () => {} },
    });

    // Create large dataset
    largeDataset = createLargeDataset();
    runtimeCtx = createRuntimeContext(largeDataset);
  });

  function createLargeDataset() {
    const actorEntity = {
      id: 'actor1',
      components: new Map(),
    };

    // Create 1000 items across different categories
    const items = [];
    const clothingItems = [];

    for (let i = 0; i < 1000; i++) {
      items.push(`item_${i}`);
      if (i < 500) {
        clothingItems.push(`clothing_${i}`);
      }
    }

    actorEntity.components.set('inventory:items', { items });
    actorEntity.components.set('clothing:wearing', {
      slots: {
        'torso:upper': { items: clothingItems.slice(0, 100) },
        'torso:lower': { items: clothingItems.slice(100, 200) },
        feet: { items: clothingItems.slice(200, 250) },
        head: { items: clothingItems.slice(250, 300) },
      },
    });

    // Social relationships
    const followers = Array.from({ length: 200 }, (_, i) => `follower_${i}`);
    const partners = Array.from({ length: 50 }, (_, i) => `partner_${i}`);

    actorEntity.components.set('social:relationships', {
      followers,
      partners,
    });

    return { actorEntity, items, clothingItems };
  }

  function createRuntimeContext(dataset) {
    return {
      entityManager: {
        getEntity: (id) => {
          if (id === 'actor1') return dataset.actorEntity;
          return null;
        },
      },
      componentRegistry: {
        getItemComponents: (itemId) => {
          // Generate consistent components based on ID
          const num = parseInt(itemId.match(/\d+/)?.[0] || '0');
          return {
            'core:tags': {
              tags: generateTags(num),
            },
            'clothing:material': {
              type: getMaterialType(num),
              quality: getQuality(num),
            },
            'clothing:armor': {
              rating: num % 20,
              protection: {
                physical: num % 15,
                magical: num % 5,
              },
            },
            'clothing:condition': {
              durability: 50 + (num % 50),
              dirty: num % 3 === 0,
            },
          };
        },
        getEntitiesWithComponent: (componentId) => {
          if (componentId === 'core:actor') {
            return new Set(Array.from({ length: 100 }, (_, i) => `actor_${i}`));
          }
          return new Set();
        },
      },
    };
  }

  function generateTags(num) {
    const tags = [];
    if (num % 2 === 0) tags.push('armor');
    if (num % 3 === 0) tags.push('waterproof');
    if (num % 5 === 0) tags.push('magic');
    if (num % 7 === 0) tags.push('rare');
    tags.push(num % 4 === 0 ? 'outer' : 'base');
    return tags;
  }

  function getMaterialType(num) {
    const materials = ['leather', 'cloth', 'metal', 'silk'];
    return materials[num % materials.length];
  }

  function getQuality(num) {
    if (num % 10 === 0) return 'high';
    if (num % 5 === 0) return 'normal';
    return 'low';
  }

  function measurePerformance(fn, iterations = 100) {
    const times = [];

    // Warmup
    for (let i = 0; i < 10; i++) {
      fn();
    }

    // Actual measurements
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }

    // Calculate statistics
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const sorted = times.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      avg,
      median,
      p95,
      p99,
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  describe('Union operator performance', () => {
    it('should have minimal overhead for pipe operator', () => {
      const plusExpression = 'actor.followers + actor.partners';
      const pipeExpression = 'actor.followers | actor.partners';

      const plusAst = engine.parse(plusExpression);
      const pipeAst = engine.parse(pipeExpression);

      const plusPerf = measurePerformance(() => {
        engine.resolve(plusAst, largeDataset.actorEntity, runtimeCtx);
      });

      const pipePerf = measurePerformance(() => {
        engine.resolve(pipeAst, largeDataset.actorEntity, runtimeCtx);
      });

      // Performance should be nearly identical
      const overhead = ((pipePerf.avg - plusPerf.avg) / plusPerf.avg) * 100;

      console.log('Union Performance Comparison:');
      console.log(`Plus operator: ${plusPerf.avg.toFixed(2)}ms avg`);
      console.log(`Pipe operator: ${pipePerf.avg.toFixed(2)}ms avg`);
      console.log(`Overhead: ${overhead.toFixed(2)}%`);

      expect(Math.abs(overhead)).toBeLessThan(2); // Less than 2% difference
    });

    it('should scale linearly with union complexity', () => {
      const measurements = [];

      for (let branches = 2; branches <= 8; branches++) {
        const parts = [];
        for (let i = 0; i < branches; i++) {
          parts.push(`actor.category${i}`);
        }
        const expression = parts.join(' | ');

        const ast = engine.parse(expression);
        const perf = measurePerformance(() => {
          engine.resolve(ast, largeDataset.actorEntity, runtimeCtx);
        }, 50);

        measurements.push({ branches, time: perf.avg });
      }

      // Check for linear scaling
      const firstRatio = measurements[1].time / measurements[0].time;
      const lastRatio =
        measurements[measurements.length - 1].time /
        measurements[measurements.length - 2].time;

      // Ratio should remain relatively constant (linear scaling)
      expect(Math.abs(lastRatio - firstRatio)).toBeLessThan(0.5);
    });
  });

  describe('Enhanced filter performance', () => {
    it('should have acceptable overhead for property filtering', () => {
      const simpleExpression = 'actor.all_clothing';
      const filteredExpression =
        'actor.all_clothing[][{"in": ["armor", {"var": "tags"}]}]';

      const simpleAst = engine.parse(simpleExpression);
      const filteredAst = engine.parse(filteredExpression);

      const simplePerf = measurePerformance(() => {
        engine.resolve(simpleAst, largeDataset.actorEntity, runtimeCtx);
      });

      const filteredPerf = measurePerformance(() => {
        engine.resolve(filteredAst, largeDataset.actorEntity, runtimeCtx);
      });

      const overhead =
        ((filteredPerf.avg - simplePerf.avg) / simplePerf.avg) * 100;

      console.log('Filter Performance:');
      console.log(`No filter: ${simplePerf.avg.toFixed(2)}ms avg`);
      console.log(`With filter: ${filteredPerf.avg.toFixed(2)}ms avg`);
      console.log(`Overhead: ${overhead.toFixed(2)}%`);

      expect(overhead).toBeLessThan(50); // Filtering adds <50% overhead
    });

    it('should handle complex filters efficiently', () => {
      const complexFilter = {
        and: [
          { in: ['armor', { var: 'tags' }] },
          { '>': [{ var: 'components.clothing:armor.rating' }, 10] },
          { '==': [{ var: 'quality' }, 'high'] },
        ],
      };

      const expression = `actor.all_clothing[][${JSON.stringify(complexFilter)}]`;
      const ast = engine.parse(expression);

      const perf = measurePerformance(() => {
        engine.resolve(ast, largeDataset.actorEntity, runtimeCtx);
      });

      console.log(`Complex filter performance: ${perf.avg.toFixed(2)}ms avg`);
      expect(perf.p95).toBeLessThan(10); // 95th percentile under 10ms
    });
  });

  describe('Combined features performance', () => {
    it('should handle union + filter efficiently', () => {
      const expression = `(
        actor.all_clothing | actor.inventory
      )[{
        "and": [
          {"in": ["armor", {"var": "tags"}]},
          {">": [{"var": "rating"}, 5]}
        ]
      }]`;

      const ast = engine.parse(expression);

      const perf = measurePerformance(() => {
        engine.resolve(ast, largeDataset.actorEntity, runtimeCtx);
      });

      console.log('Combined Features Performance:');
      console.log(`Average: ${perf.avg.toFixed(2)}ms`);
      console.log(`P95: ${perf.p95.toFixed(2)}ms`);
      console.log(`P99: ${perf.p99.toFixed(2)}ms`);

      expect(perf.avg).toBeLessThan(15); // Average under 15ms
      expect(perf.p99).toBeLessThan(25); // 99th percentile under 25ms
    });

    it('should maintain performance with deeply nested queries', () => {
      const expression = `(
        (actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower)[{"in": ["armor", {"var": "tags"}]}] |
        (actor.topmost_clothing.head | actor.topmost_clothing.feet)[{"in": ["waterproof", {"var": "tags"}]}]
      )[{">": [{"var": "durability"}, 75]}]`;

      const ast = engine.parse(expression);

      const perf = measurePerformance(() => {
        engine.resolve(ast, largeDataset.actorEntity, runtimeCtx);
      }, 50);

      expect(perf.avg).toBeLessThan(20); // Complex nested query under 20ms
    });
  });

  describe('Memory efficiency', () => {
    it('should not leak memory with repeated queries', () => {
      const expression =
        '(actor.all_clothing | actor.inventory)[{"in": ["rare", {"var": "tags"}]}]';
      const ast = engine.parse(expression);

      // Get initial memory
      if (global.gc) global.gc();
      const initialMemory = process.memoryUsage().heapUsed;

      // Run many iterations
      for (let i = 0; i < 1000; i++) {
        engine.resolve(ast, largeDataset.actorEntity, runtimeCtx);
      }

      // Force GC and check memory
      if (global.gc) global.gc();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(
        `Memory increase after 1000 iterations: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );

      // Should not leak significant memory
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });
  });

  describe('Performance regression tests', () => {
    it('should not regress existing union performance', () => {
      const expressions = [
        'actor.followers + actor.partners',
        'actor.followers + actor.partners + actor.friends',
        'entities(core:actor) + entities(core:npc)',
      ];

      expressions.forEach((expr) => {
        const ast = engine.parse(expr);
        const perf = measurePerformance(() => {
          engine.resolve(ast, largeDataset.actorEntity, runtimeCtx);
        }, 50);

        console.log(`Expression "${expr}": ${perf.avg.toFixed(2)}ms avg`);
        expect(perf.avg).toBeLessThan(5); // All simple unions under 5ms
      });
    });

    it('should not regress existing filter performance', () => {
      // Test entity filtering (existing functionality)
      const entityFilterExpr =
        'actor.followers[{"in": ["guard", {"var": "components.core:tags.tags"}]}]';
      const ast = engine.parse(entityFilterExpr);

      const perf = measurePerformance(() => {
        engine.resolve(ast, largeDataset.actorEntity, runtimeCtx);
      }, 50);

      console.log(`Entity filter performance: ${perf.avg.toFixed(2)}ms avg`);
      expect(perf.avg).toBeLessThan(5); // Entity filtering still fast
    });
  });

  describe('Performance report', () => {
    it('should generate comprehensive performance report', () => {
      const testCases = [
        {
          name: 'Simple union (plus)',
          expr: 'actor.followers + actor.partners',
        },
        {
          name: 'Simple union (pipe)',
          expr: 'actor.followers | actor.partners',
        },
        {
          name: 'Property filter',
          expr: 'actor.all_clothing[][{"in": ["armor", {"var": "tags"}]}]',
        },
        {
          name: 'Complex filter',
          expr: 'actor.all_clothing[][{"and": [{"in": ["armor", {"var": "tags"}]}, {">": [{"var": "rating"}, 10]}]}]',
        },
        {
          name: 'Union + filter',
          expr: '(actor.all_clothing | actor.inventory)[{"in": ["magic", {"var": "tags"}]}]',
        },
        {
          name: 'Nested unions',
          expr: '(actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower) | (actor.topmost_clothing.head | actor.topmost_clothing.feet)',
        },
      ];

      console.log('\n=== Performance Report ===\n');
      console.log(
        'Test Case                          | Avg (ms) | P95 (ms) | P99 (ms)'
      );
      console.log(
        '-----------------------------------|----------|----------|----------'
      );

      const results = [];
      testCases.forEach(({ name, expr }) => {
        const ast = engine.parse(expr);
        const perf = measurePerformance(() => {
          engine.resolve(ast, largeDataset.actorEntity, runtimeCtx);
        }, 100);

        results.push({ name, perf });
        console.log(
          `${name.padEnd(34)} | ${perf.avg.toFixed(2).padStart(8)} | ${perf.p95.toFixed(2).padStart(8)} | ${perf.p99.toFixed(2).padStart(8)}`
        );
      });

      // Overall assessment
      const maxAvg = Math.max(...results.map((r) => r.perf.avg));
      const maxP99 = Math.max(...results.map((r) => r.perf.p99));

      console.log('\n=== Summary ===');
      console.log(`Maximum average time: ${maxAvg.toFixed(2)}ms`);
      console.log(`Maximum P99 time: ${maxP99.toFixed(2)}ms`);
      console.log(`Performance target: <5% overhead ✓`);

      expect(maxAvg).toBeLessThan(20); // No query averages over 20ms
      expect(maxP99).toBeLessThan(50); // No query P99 over 50ms
    });
  });
});
```

### Verification Steps

1. Run performance tests: `npm run test:performance -- unionAndFilterPerformance.test.js`
2. Review performance report
3. Verify all benchmarks meet targets
4. Check for memory leaks
5. Compare with baseline performance

### Acceptance Criteria

- [ ] Pipe operator overhead <2% vs plus operator
- [ ] Filter overhead <50% for simple filters
- [ ] Combined features perform acceptably
- [ ] No memory leaks detected
- [ ] No regression in existing features

---

## Ticket 3.3: Edge Case Validation Suite

**File**: `tests/e2e/scopeDsl/unionFilterEdgeCases.e2e.test.js`  
**Time Estimate**: 2 hours  
**Dependencies**: All features implemented  
**Complexity**: Low

### Description

Create comprehensive edge case tests to ensure robustness of the implementation.

### Implementation Details

Create edge case test file:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import createScopeDslEngine from '../../../src/scopeDsl/engine.js';
import { ScopeSyntaxError } from '../../../src/scopeDsl/parser/parser.js';

describe('Union & Filter Edge Cases - E2E', () => {
  let engine;
  let actorEntity;
  let runtimeCtx;

  beforeEach(() => {
    engine = createScopeDslEngine({
      logger: { debug: jest.fn(), error: jest.fn() },
    });

    actorEntity = {
      id: 'test:actor',
      components: new Map([['test:data', { value: 'test' }]]),
    };

    runtimeCtx = {
      entityManager: {
        getEntity: (id) => (id === 'test:actor' ? actorEntity : null),
      },
      componentRegistry: {
        getItemComponents: jest.fn(),
      },
    };
  });

  describe('Parser edge cases', () => {
    it('should handle multiple consecutive unions', () => {
      const expression = 'a | b | c | d | e';
      const ast = engine.parse(expression);

      // Should create right-associative chain
      expect(ast.type).toBe('Union');
      expect(ast.right.type).toBe('Union');
      expect(ast.right.right.type).toBe('Union');
    });

    it('should handle mixed union operators correctly', () => {
      const expression = 'a + b | c + d';
      const ast = engine.parse(expression);

      // Both operators at same precedence
      expect(ast.type).toBe('Union');
      expect(ast.left.type).toBe('Union');
      expect(ast.right.type).toBe('Union');
    });

    it('should handle filters with union operators inside', () => {
      // Note: JSON Logic might have | operator too
      const expression = 'actor.items[{"|": [{"var": "a"}, {"var": "b"}]}]';
      const ast = engine.parse(expression);

      expect(ast.type).toBe('Filter');
      expect(ast.logic).toHaveProperty('|');
    });

    it('should reject invalid union syntax', () => {
      const invalidExpressions = [
        '| actor.items', // Leading pipe
        'actor.items |', // Trailing pipe
        'actor.items | | other', // Double pipe
      ];

      invalidExpressions.forEach((expr) => {
        expect(() => engine.parse(expr)).toThrow(ScopeSyntaxError);
      });
    });
  });

  describe('Resolution edge cases', () => {
    it('should handle null/undefined in union branches', () => {
      actorEntity.components.set('test:data', {
        defined: ['a', 'b'],
        nullish: null,
        undef: undefined,
      });

      const expression = 'actor.defined | actor.nullish | actor.undef';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual(['a', 'b']);
    });

    it('should handle circular references in data', () => {
      const circular = { items: [] };
      circular.items.push(circular); // Circular reference

      actorEntity.components.set('test:circular', circular);

      const expression = 'actor.items | actor.other';
      const ast = engine.parse(expression);

      // Should not crash
      expect(() => {
        engine.resolve(ast, actorEntity, runtimeCtx);
      }).not.toThrow();
    });

    it('should handle extremely deep nesting', () => {
      let expression = 'actor';
      for (let i = 0; i < 50; i++) {
        expression = `(${expression} | actor)`;
      }

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
    });
  });

  describe('Filter edge cases', () => {
    it('should handle undefined var access gracefully', () => {
      runtimeCtx.componentRegistry.getItemComponents.mockReturnValue({
        'test:component': { value: 10 },
      });

      actorEntity.components.set('inventory:items', {
        items: ['item1'],
      });

      // Access non-existent property
      const expression =
        'actor.items[][{"==": [{"var": "nonexistent.nested.property"}, null]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      // JSON Logic returns null for undefined paths
      expect(Array.from(result)).toEqual(['item1']);
    });

    it('should handle type mismatches in filters', () => {
      runtimeCtx.componentRegistry.getItemComponents.mockReturnValue({
        'test:component': {
          stringValue: '10',
          numberValue: 10,
        },
      });

      actorEntity.components.set('inventory:items', {
        items: ['item1'],
      });

      // Compare string to number
      const expression = 'actor.items[][{"==": [{"var": "stringValue"}, 10]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      // Strict equality, so should not match
      expect(Array.from(result)).toEqual([]);
    });

    it('should handle filter evaluation errors', () => {
      runtimeCtx.componentRegistry.getItemComponents.mockImplementation(() => {
        throw new Error('Component error');
      });

      actorEntity.components.set('inventory:items', {
        items: ['item1', 'item2'],
      });

      const expression = 'actor.items[][{"==": [{"var": "type"}, "test"]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      // Should return empty set, not throw
      expect(result.size).toBe(0);
    });

    it('should handle malformed JSON Logic gracefully', () => {
      const expression = 'actor.items[][{"unknownOp": ["arg1", "arg2"]}]';
      const ast = engine.parse(expression);

      actorEntity.components.set('inventory:items', {
        items: ['item1'],
      });

      // JSON Logic should handle unknown operators
      const result = engine.resolve(ast, actorEntity, runtimeCtx);
      expect(result).toBeInstanceOf(Set);
    });
  });

  describe('Component lookup edge cases', () => {
    it('should handle items that look like entities', () => {
      // Item ID that matches entity ID pattern
      const itemId = 'mod:type:instance';

      actorEntity.components.set('inventory:items', {
        items: [itemId],
      });

      runtimeCtx.entityManager.getEntity = (id) => {
        if (id === itemId) {
          // This ID is actually an entity
          return {
            id: itemId,
            components: new Map([['core:tags', { tags: ['entity'] }]]),
          };
        }
        return null;
      };

      const expression = 'actor.items[][{"in": ["entity", {"var": "tags"}]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual([itemId]);
    });

    it('should handle special item IDs', () => {
      const specialIds = ['none', 'self', '', null, undefined, 0, false];

      actorEntity.components.set('inventory:items', {
        items: specialIds,
      });

      runtimeCtx.componentRegistry.getItemComponents.mockReturnValue({
        'core:tags': { tags: ['special'] },
      });

      const expression = 'actor.items[][{"in": ["special", {"var": "tags"}]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      // Should handle all special values
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('Unicode and special characters', () => {
    it('should handle unicode in filter values', () => {
      runtimeCtx.componentRegistry.getItemComponents.mockReturnValue({
        'core:tags': { tags: ['こんにちは', '🎮', 'café'] },
      });

      actorEntity.components.set('inventory:items', {
        items: ['item1'],
      });

      const expression = 'actor.items[][{"in": ["🎮", {"var": "tags"}]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual(['item1']);
    });

    it('should handle special characters in property names', () => {
      runtimeCtx.componentRegistry.getItemComponents.mockReturnValue({
        'special:chars': {
          'property-with-dash': 'value',
          'property.with.dots': 'value',
          property$special: 'value',
        },
      });

      actorEntity.components.set('inventory:items', {
        items: ['item1'],
      });

      // These might need special handling
      const expression =
        'actor.items[][{"==": [{"var": "components.special:chars.property-with-dash"}, "value"]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual(['item1']);
    });
  });

  describe('Memory and resource limits', () => {
    it('should handle very large filter expressions', () => {
      // Create a very large OR condition
      const conditions = [];
      for (let i = 0; i < 100; i++) {
        conditions.push({ '==': [{ var: 'id' }, `item${i}`] });
      }

      const largeFilter = { or: conditions };
      const expression = `actor.items[][${JSON.stringify(largeFilter)}]`;

      const ast = engine.parse(expression);

      actorEntity.components.set('inventory:items', {
        items: ['item50'],
      });

      const result = engine.resolve(ast, actorEntity, runtimeCtx);
      expect(Array.from(result)).toEqual(['item50']);
    });

    it('should handle union of many empty sets efficiently', () => {
      let expression = 'actor.empty1';
      for (let i = 2; i <= 100; i++) {
        expression += ` | actor.empty${i}`;
      }

      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(result.size).toBe(0);
    });
  });

  describe('Interaction with existing features', () => {
    it('should work with array iteration and filters', () => {
      actorEntity.components.set('containers:boxes', {
        boxes: [
          { id: 'box1', items: ['sword', 'shield'] },
          { id: 'box2', items: ['potion', 'scroll'] },
        ],
      });

      runtimeCtx.componentRegistry.getItemComponents.mockImplementation(
        (id) => {
          const items = {
            sword: { 'core:tags': { tags: ['weapon', 'metal'] } },
            shield: { 'core:tags': { tags: ['armor', 'metal'] } },
            potion: { 'core:tags': { tags: ['consumable'] } },
            scroll: { 'core:tags': { tags: ['readable'] } },
          };
          return items[id];
        }
      );

      // Complex query with array iteration
      const expression =
        'actor.boxes[].items[][{"in": ["metal", {"var": "tags"}]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['shield', 'sword']);
    });

    it('should respect depth limits with unions and filters', () => {
      // Create expression that would exceed depth limit
      let expression = 'actor';
      for (let i = 0; i < 10; i++) {
        expression += '.nested';
      }
      expression += '[{"==": [{"var": "value"}, true]}]';

      const ast = engine.parse(expression);

      // Should throw depth exceeded error during resolution
      expect(() => {
        engine.resolve(ast, actorEntity, runtimeCtx);
      }).toThrow(/depth/i);
    });
  });
});
```

### Verification Steps

1. Run edge case tests: `npm run test:e2e -- unionFilterEdgeCases.e2e.test.js`
2. Verify all edge cases handled properly
3. Check error messages are helpful
4. Ensure no crashes or hangs

### Acceptance Criteria

- [ ] All edge cases handled gracefully
- [ ] No crashes on malformed input
- [ ] Error messages are helpful
- [ ] Resource limits enforced
- [ ] Unicode support verified

---

## Ticket 3.4: Migration Guide and Examples

**File**: `docs/migration-guide-union-filters.md`  
**Time Estimate**: 2 hours  
**Dependencies**: All implementation complete  
**Complexity**: Low

### Description

Create a comprehensive migration guide for mod developers, including examples and best practices.

### Implementation Details

Create migration guide:

````markdown
# Migration Guide: Union Operator and Enhanced Filters

## Overview

Version X.X introduces two powerful new features to the Scope DSL:

1. **Pipe Union Operator (`|`)** - Alternative syntax to `+` for combining results
2. **Enhanced Filter Syntax** - Filter any items by their component properties

Both features are fully backward compatible - all existing scope files will continue to work without modification.

## Quick Start

### Union Operator

The pipe operator (`|`) works identically to the plus operator (`+`):

```scope
# Old syntax (still works)
all_allies := actor.followers + actor.partners + actor.friends

# New syntax (equivalent)
all_allies := actor.followers | actor.partners | actor.friends

# You can even mix them (though not recommended for consistency)
mixed := actor.followers + actor.partners | actor.friends
```
````

### Enhanced Filters

Filters now work on any items with components, not just entities:

```scope
# Filter clothing by properties
waterproof_gear := actor.all_clothing[][{"in": ["waterproof", {"var": "tags"}]}]

# Filter by material type
leather_items := actor.all_clothing[][{"==": [{"var": "components.clothing:material.type"}, "leather"]}]

# Complex multi-property filter
quality_armor := actor.all_clothing[][{
  "and": [
    {"in": ["armor", {"var": "tags"}]},
    {">": [{"var": "components.clothing:armor.rating"}, 7]},
    {"==": [{"var": "quality"}, "high"]}
  ]
}]
```

## Detailed Migration Steps

### Step 1: Identify Opportunities

Look for patterns in your existing scope files that could benefit from the new features:

#### Union Operator Opportunities

1. **Multiple `+` operations**

   ```scope
   # Before
   targets := actor.enemies + location.enemies + actor.marked_targets

   # After (more readable)
   targets := actor.enemies | location.enemies | actor.marked_targets
   ```

2. **Separate scope definitions that get combined**

   ```scope
   # Before
   upper_armor := actor.topmost_clothing.torso_upper
   lower_armor := actor.topmost_clothing.torso_lower
   # Then combined elsewhere

   # After (single expression)
   body_armor := actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower
   ```

#### Filter Enhancement Opportunities

1. **Post-processing filters in rule logic**

   ```scope
   # Before (in rule logic)
   clothing := actor.all_clothing
   # Then filter in rule condition with complex logic

   # After (in scope definition)
   protective_clothing := actor.all_clothing[][{"in": ["armor", {"var": "tags"}]}]
   ```

2. **Multiple related scopes for different item types**

   ```scope
   # Before
   weapons := actor.inventory  # Then filter for weapons in rules
   armor := actor.inventory    # Then filter for armor in rules

   # After
   weapons := actor.inventory[][{"in": ["weapon", {"var": "tags"}]}]
   armor := actor.inventory[][{"in": ["armor", {"var": "tags"}]}]
   ```

### Step 2: Update Scope Definitions

#### Converting Unions

1. **Simple replacement**

   ```scope
   # Change this
   combined := scope1 + scope2 + scope3

   # To this (optional, both work)
   combined := scope1 | scope2 | scope3
   ```

2. **Complex expressions**

   ```scope
   # This complex union
   all_items := actor.equipped + actor.inventory + actor.stored + location.items

   # Becomes more readable with pipes
   all_items := actor.equipped | actor.inventory | actor.stored | location.items
   ```

#### Adding Property Filters

1. **Basic property filtering**

   ```scope
   # Add filters to existing scopes
   all_clothing := actor.all_clothing
   # Becomes
   waterproof_clothing := actor.all_clothing[][{"in": ["waterproof", {"var": "tags"}]}]
   ```

2. **Multi-condition filtering**
   ```scope
   # Complex filtering
   combat_ready_gear := actor.all_clothing[][{
     "and": [
       {"in": ["armor", {"var": "tags"}]},
       {">": [{"var": "durability"}, 50]},
       {"!=": [{"var": "components.clothing:condition.broken"}, true]}
     ]
   }]
   ```

### Step 3: Update Rule Logic

With enhanced filters, you can simplify rule conditions:

#### Before

```json
{
  "condition": {
    "and": [
      { ">": [{ "count": { "var": "scope.actor.all_clothing" } }, 0] },
      { "custom": "checkClothingProperties" }
    ]
  }
}
```

#### After

```json
{
  "condition": {
    ">": [{ "count": { "var": "scope.suitable_clothing" } }, 0]
  }
}
```

Where `suitable_clothing` is defined with all necessary filters in the scope file.

### Step 4: Testing Your Updates

1. **Test union operator changes**

   ```javascript
   // Verify both operators produce same results
   const oldResult = evaluate('actor.followers + actor.partners');
   const newResult = evaluate('actor.followers | actor.partners');
   assert(oldResult.equals(newResult));
   ```

2. **Test filter enhancements**
   ```javascript
   // Verify filters work on non-entity items
   const filtered = evaluate(
     'actor.all_clothing[][{"in": ["armor", {"var": "tags"}]}]'
   );
   assert(filtered.every((item) => hasTag(item, 'armor')));
   ```

## Common Patterns and Best Practices

### Union Patterns

1. **Combining related scopes**

   ```scope
   # All protective items
   all_protection := actor.armor | actor.shields | actor.magical_wards

   # All NPCs
   all_npcs := location.npcs | actor.followers | actor.summons
   ```

2. **Fallback patterns**
   ```scope
   # Primary weapon or any weapon
   weapon := actor.equipped.weapon | actor.inventory[0]
   ```

### Filter Patterns

1. **Tag-based filtering**

   ```scope
   # Single tag
   magical_items := all_items[][{"in": ["magical", {"var": "tags"}]}]

   # Multiple tags (any)
   special_items := all_items[][{
     "or": [
       {"in": ["rare", {"var": "tags"}]},
       {"in": ["unique", {"var": "tags"}]},
       {"in": ["legendary", {"var": "tags"}]}
     ]
   }]

   # Multiple tags (all)
   heavy_armor := all_items[][{
     "and": [
       {"in": ["armor", {"var": "tags"}]},
       {"in": ["heavy", {"var": "tags"}]}
     ]
   }]
   ```

2. **Property value filtering**

   ```scope
   # Numeric comparisons
   high_value_items := all_items[][{">": [{"var": "value"}, 100]}]
   damaged_items := all_items[][{"<": [{"var": "durability"}, 50]}]

   # String matching
   leather_goods := all_items[][{"==": [{"var": "material"}, "leather"]}]
   ```

3. **Nested property access**

   ```scope
   # Component-based properties
   fire_resistant := all_items[][{
     ">": [{"var": "components.armor:resistances.fire"}, 0]
   }]

   # Safe access with defaults
   quality_items := all_items[][{
     "==": [{"var": ["quality", "normal"]}, "high"]
   }]
   ```

### Combined Patterns

1. **Union then filter**

   ```scope
   # Get all protective items from multiple sources
   all_protective := (
     actor.equipped |
     actor.inventory |
     storage.items
   )[{"in": ["protective", {"var": "tags"}]}]
   ```

2. **Filter then union**

   ```scope
   # Combine filtered results
   all_weapons :=
     actor.inventory[][{"in": ["weapon", {"var": "tags"}]}] |
     location.items[][{"in": ["weapon", {"var": "tags"}]}]
   ```

3. **Complex queries**
   ```scope
   # Find all high-quality armor from any source
   available_armor := (
     actor.all_clothing |
     actor.inventory |
     location.merchant.items |
     storage.armor_rack
   )[{
     "and": [
       {"in": ["armor", {"var": "tags"}]},
       {"==": [{"var": "quality"}, "high"]},
       {">": [{"var": "durability"}, 80]}
     ]
   }]
   ```

## Performance Considerations

### Union Operator

- Both `+` and `|` have identical performance
- Unions are computed lazily when possible
- Result sets automatically deduplicate

### Enhanced Filters

- Property access is optimized for common patterns
- Flattened properties (`{"var": "tags"}`) are faster than component paths
- Complex conditions are short-circuited when possible

### Best Practices for Performance

1. **Filter early when possible**

   ```scope
   # Better (filters each source)
   result :=
     actor.items[][filter] |
     location.items[][filter]

   # Worse (filters combined result)
   result := (actor.items | location.items)[][filter]
   ```

2. **Use specific property paths**

   ```scope
   # Better (direct access)
   filtered := items[][{"==": [{"var": "type"}, "weapon"]}]

   # Worse (searches all properties)
   filtered := items[][{"custom": "hasPropertyValue", "args": ["weapon"]}]
   ```

## Troubleshooting

### Common Issues

1. **Filter returns empty set**
   - Check property names match exactly
   - Verify items have expected components
   - Use trace logging: `game.debug.scopeDsl = true`

2. **Union produces unexpected results**
   - Remember both operators are right-associative
   - Check for null/undefined in branches
   - Verify scope paths are correct

3. **Performance degradation**
   - Check filter complexity
   - Consider breaking complex filters into steps
   - Profile with large datasets

### Debug Techniques

1. **Enable trace logging**

   ```javascript
   game.config.debug.scopeDsl = true;
   ```

2. **Test expressions individually**

   ```scope
   # Break complex expressions into parts
   part1 := actor.all_clothing
   part2 := part1[][{"in": ["armor", {"var": "tags"}]}]
   part3 := part2[][{">": [{"var": "rating"}, 5]}]
   ```

3. **Inspect evaluation contexts**
   ```javascript
   // In console
   game.scopeDsl.debug.showContext('item_id');
   ```

## Rollback Plan

If you need to rollback changes:

1. **Union operators**: Simply replace `|` with `+`
2. **Enhanced filters**: Move filtering logic back to rules
3. **No data migration needed**: All changes are in scope definitions

## Support

- Documentation: `/docs/scope-dsl.md`
- Examples: `/data/examples/scope-patterns.scope`
- Community: Discord #modding channel
- Issues: GitHub issue tracker

## Appendix: Complete Examples

### Example 1: Armor Management System

```scope
# Define armor categories
light_armor := actor.all_clothing[][{
  "and": [
    {"in": ["armor", {"var": "tags"}]},
    {"in": ["light", {"var": "tags"}]}
  ]
}]

heavy_armor := actor.all_clothing[][{
  "and": [
    {"in": ["armor", {"var": "tags"}]},
    {"in": ["heavy", {"var": "tags"}]}
  ]
}]

# Combine for total armor
all_armor := light_armor | heavy_armor

# Find damaged armor needing repair
damaged_armor := all_armor[][{"<": [{"var": "durability"}, 50]}]

# Find best armor piece
best_armor := all_armor[][{
  "==": [
    {"var": "rating"},
    {"max": {"map": [{"var": "../all_armor"}, {"var": "rating"}]}}
  ]
}]
```

### Example 2: Inventory Filtering System

```scope
# Categorize all items
weapons := (actor.inventory | actor.equipped)[][{"in": ["weapon", {"var": "tags"}]}]
consumables := actor.inventory[][{"in": ["consumable", {"var": "tags"}]}]
valuable := actor.inventory[][{">": [{"var": "value"}, 50]}]

# Find items to sell
sellable := actor.inventory[][{
  "and": [
    {"!": {"in": ["quest", {"var": "tags"}]}},
    {"!": {"in": ["equipped", {"var": "tags"}]}},
    {">": [{"var": "value"}, 10]}
  ]
}]

# Items needing identification
unidentified := (actor.inventory | actor.equipped)[][{
  "==": [{"var": "identified"}, false]
}]
```

### Example 3: Environmental Hazard Detection

```scope
# All gear providing protection
protective_gear := actor.all_clothing[][{
  "or": [
    {"in": ["waterproof", {"var": "tags"}]},
    {"in": ["fireproof", {"var": "tags"}]},
    {"in": ["insulated", {"var": "tags"}]}
  ]
}]

# Check specific protections
fire_protection := actor.all_clothing[][{
  "or": [
    {"in": ["fireproof", {"var": "tags"}]},
    {">": [{"var": "components.armor:resistances.fire"}, 0]}
  ]
}]

water_protection := actor.all_clothing[][{
  "and": [
    {"in": ["waterproof", {"var": "tags"}]},
    {"!": {"var": "components.clothing:condition.damaged"}}
  ]
}]
```

## Summary

The new union operator and enhanced filters provide powerful tools for mod developers while maintaining full backward compatibility. Start by identifying opportunities in your existing scope files, test thoroughly, and enjoy the cleaner, more expressive scope definitions!

````

### Verification Steps
1. Review guide for completeness
2. Test all examples for correctness
3. Ensure migration steps are clear
4. Verify troubleshooting section helpful

### Acceptance Criteria
- [ ] Clear migration path provided
- [ ] All examples tested and working
- [ ] Common patterns documented
- [ ] Troubleshooting guide complete
- [ ] Performance tips included

---

## Ticket 3.5: Final Integration and Release Checklist

**Files**: Multiple
**Time Estimate**: 1 hour
**Dependencies**: All other tickets
**Complexity**: Low

### Description
Perform final integration testing and prepare for release.

### Implementation Details

#### Create Release Checklist

Create file: `docs/release-checklist-union-filters.md`

```markdown
# Release Checklist: Union Operator and Enhanced Filters

## Pre-Release Testing

### Automated Tests
- [ ] All unit tests passing: `npm run test:unit`
- [ ] All integration tests passing: `npm run test:integration`
- [ ] All E2E tests passing: `npm run test:e2e`
- [ ] Performance tests meeting targets: `npm run test:performance`
- [ ] Coverage metrics maintained (>90%)

### Manual Testing
- [ ] Test with example mod files
- [ ] Verify backward compatibility with existing mods
- [ ] Test error messages are helpful
- [ ] Verify performance with large datasets
- [ ] Test in different browsers

### Code Quality
- [ ] No linting errors: `npm run lint`
- [ ] Type checking passes: `npm run typecheck`
- [ ] No TODO comments left
- [ ] All console.log statements removed
- [ ] Error handling comprehensive

## Documentation

### User Documentation
- [ ] Scope DSL reference updated
- [ ] Migration guide complete
- [ ] Example files updated
- [ ] CLAUDE.md updated

### Developer Documentation
- [ ] API documentation updated
- [ ] JSDoc comments complete
- [ ] Architecture decisions documented
- [ ] Performance considerations noted

### Release Notes
- [ ] Feature description clear
- [ ] Breaking changes noted (none)
- [ ] Migration path documented
- [ ] Examples provided

## Integration Verification

### Mod Compatibility
- [ ] Core mod tested
- [ ] Example mods tested
- [ ] Community mod samples tested
- [ ] No regression in existing features

### System Integration
- [ ] Works with save/load system
- [ ] Works with mod loading system
- [ ] Works with validation system
- [ ] Works with error reporting

## Performance Validation

### Benchmarks
- [ ] Baseline performance recorded
- [ ] New feature overhead <5%
- [ ] Memory usage stable
- [ ] No memory leaks detected

### Stress Testing
- [ ] Large unions (1000+ items)
- [ ] Complex filters (10+ conditions)
- [ ] Deep nesting (10+ levels)
- [ ] Many concurrent queries

## Release Preparation

### Version Update
- [ ] Version number incremented
- [ ] Changelog updated
- [ ] Migration guide linked

### Final Review
- [ ] Code reviewed by team
- [ ] Documentation reviewed
- [ ] Examples tested
- [ ] Performance approved

### Deployment
- [ ] Git branch up to date
- [ ] CI/CD passing
- [ ] Release notes drafted
- [ ] Announcement prepared

## Post-Release

### Monitoring
- [ ] Error reports monitored
- [ ] Performance metrics tracked
- [ ] Community feedback gathered
- [ ] Hot fixes prepared if needed

### Communication
- [ ] Discord announcement made
- [ ] Documentation site updated
- [ ] Example mods published
- [ ] Tutorial created

## Sign-Off

- [ ] Development Team
- [ ] QA Team
- [ ] Documentation Team
- [ ] Project Lead

---

Release Date: ___________
Version: ___________
Released By: ___________
````

#### Update Package Files

Add to changelog or release notes:

````markdown
## Version X.X.X

### New Features

#### Union Operator (`|`)

- Added pipe operator as alternative to `+` for scope unions
- Identical functionality with more intuitive syntax
- Fully backward compatible

#### Enhanced Filter Syntax

- Filters now work on any items with component data
- Support for property-based filtering on clothing, items, etc.
- Multiple property access patterns supported
- Complex conditions with AND/OR logic

### Examples

```scope
# Union with pipe operator
all_gear := actor.equipped | actor.inventory | actor.stored

# Filter by properties
armor := actor.all_clothing[][{"in": ["armor", {"var": "tags"}]}]

# Complex queries
quality_items := (actor.all_clothing | actor.inventory)[][{
  "and": [
    {"==": [{"var": "quality"}, "high"]},
    {">": [{"var": "value"}, 100]}
  ]
}]
```
````

### Performance

- Less than 5% overhead for complex queries
- Optimized property access patterns
- Efficient union operations

### Migration

- No breaking changes
- All existing scope files continue to work
- See migration guide for enhancement opportunities

````

### Final Verification Commands

```bash
# Run all tests
npm run test:ci

# Check code quality
npm run lint
npm run format:check
npm run typecheck

# Build and verify
npm run build
npm run start

# Test with example mods
npm run test:mods
````

### Acceptance Criteria

- [ ] All tests passing
- [ ] Documentation complete
- [ ] Examples working
- [ ] Performance validated
- [ ] Release notes ready

---

## Phase 3 Summary

### Deliverables Checklist

- [ ] Combined feature tests implemented
- [ ] Performance benchmarks passing
- [ ] Edge cases validated
- [ ] Migration guide complete
- [ ] Release preparation done

### Quality Metrics

- [ ] Test coverage >90%
- [ ] Performance overhead <5%
- [ ] Zero regressions
- [ ] Documentation complete

### Final Steps

1. Complete all tickets in order
2. Run full validation suite
3. Get team review and approval
4. Prepare release announcement
5. Deploy to production

### Time Summary

- Ticket 3.1: 3 hours (Combined tests)
- Ticket 3.2: 2 hours (Performance benchmarks)
- Ticket 3.3: 2 hours (Edge cases)
- Ticket 3.4: 2 hours (Migration guide)
- Ticket 3.5: 1 hour (Release checklist)
- **Total: 10 hours**

### Project Total

- Phase 1: 7 hours
- Phase 2: 12 hours
- Phase 3: 10 hours
- **Grand Total: 29 hours** (within 2-3 week estimate)

## Success! 🎉

Once all phases are complete, the Scope DSL will support:

1. Union operator (`|`) for intuitive result combination
2. Enhanced filters for property-based querying
3. Full backward compatibility
4. Excellent performance
5. Comprehensive documentation

The implementation is now ready for production use by mod developers!
