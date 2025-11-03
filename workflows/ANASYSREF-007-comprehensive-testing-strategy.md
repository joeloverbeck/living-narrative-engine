# ANASYSREF-007: Comprehensive Testing Strategy

**Priority**: 🟢 **RECOMMENDED**
**Phase**: 3 - Long-Term Resilience
**Estimated Effort**: 40-60 hours
**Dependencies**: ANASYSREF-001 (OrientationResolver), ANASYSREF-002, ANASYSREF-003
**Report Reference**: `reports/anatomy-system-refactoring-analysis.md` (Section: Phase 3.1)

---

## Problem Statement

Current testing lacks:
- Contract tests for SlotGenerator ↔ SocketGenerator synchronization
- Property-based tests for orientation schemes
- Regression tests for known failures
- Full pipeline integration tests

---

## Objective

Implement **comprehensive test suite** covering:
1. **Contract Tests** - Verify SlotGenerator ↔ SocketGenerator always match
2. **Property-Based Tests** - Test orientation schemes with random inputs
3. **Regression Tests** - Prevent recurrence of known failures (octopoid, spider, etc.)
4. **Integration Tests** - Full anatomy generation pipeline
5. **Performance Tests** - Ensure scalability

---

## Implementation Details

### 1. Contract Tests

**File**: `tests/unit/anatomy/slotSocketContract.test.js`

```javascript
describe('SlotGenerator ↔ SocketGenerator Contract', () => {
  it('should generate matching keys for all orientation schemes', () => {
    const schemes = ['bilateral', 'radial', 'indexed', 'custom', 'quadrupedal'];
    const counts = [1, 2, 4, 8, 16];

    for (const scheme of schemes) {
      for (const count of counts) {
        const socketPattern = {
          orientationScheme: scheme,
          idTemplate: 'test_{orientation}_{index}',
          slotType: 'testSlot'
        };

        const slotKeys = slotGenerator.generateKeys(socketPattern, count);
        const socketIds = socketGenerator.generateIds(socketPattern, count);

        expect(slotKeys.sort()).toEqual(socketIds.sort());
      }
    }
  });
});
```

### 2. Property-Based Tests

**File**: `tests/unit/anatomy/orientationProperties.test.js`

```javascript
import { fc, test } from 'fast-check';

describe('OrientationResolver Properties', () => {
  test('should produce unique orientations for all indices', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('bilateral', 'radial', 'indexed'),
        fc.integer({ min: 2, max: 16 }),
        (scheme, count) => {
          const orientations = [];
          for (let i = 0; i < count; i++) {
            orientations.push(OrientationResolver.resolveOrientation(scheme, i, count));
          }
          const unique = new Set(orientations);
          return unique.size === orientations.length;
        }
      )
    );
  });
});
```

### 3. Regression Test Suite

**File**: `tests/regression/anatomy/octopoid.regression.test.js`

```javascript
describe('Octopoid Regression Tests', () => {
  it('should prevent recurrence of tentacle slot mismatch (commit af53a1948)', async () => {
    const entity = await generateOctopoid({ tentacleCount: 8 });
    const tentacles = entity.getParts({ type: 'tentacle' });

    expect(tentacles).toHaveLength(8);
    expect(entity.getClothingSlots().some(s => s.includes('tentacle'))).toBe(true);
  });
});
```

### 4. Full Pipeline Integration Tests

**File**: `tests/integration/anatomy/fullPipeline.test.js`

```javascript
describe('Anatomy Generation Pipeline', () => {
  it('should generate complete anatomy from blueprint and recipe', async () => {
    const blueprint = await loadBlueprint('anatomy:octopoid_body');
    const recipe = await loadRecipe('anatomy:octopoid_recipe');

    const result = await anatomyGenerator.generate({ blueprint, recipe, parameters: { tentacleCount: 8 } });

    expect(result.entities).toHaveLength(9); // Body + 8 tentacles
    expect(result.clothingSlots).toBeDefined();
    expect(result.graph).toBeConnectedGraph();
  });
});
```

---

## Acceptance Criteria

- [ ] Contract tests for SlotGenerator ↔ SocketGenerator
- [ ] Property-based tests for orientation schemes (using fast-check)
- [ ] Regression tests for octopoid, spider, humanoid
- [ ] Full pipeline integration tests
- [ ] Performance tests for large entity graphs
- [ ] Test coverage: OrientationResolver 100%, overall anatomy 85%
- [ ] All tests passing
- [ ] CI/CD pipeline updated

---

## Risk Assessment

**Risk Level**: 🟢 **LOW** - Testing only

---

## Definition of Done

- All test types implemented
- Coverage targets met
- Tests integrated into CI/CD
- Documentation updated

---

**Created**: 2025-11-03
**Status**: Not Started
