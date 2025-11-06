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

**Note**: Contract tests already exist at `tests/integration/anatomy/slotSocketSynchronization.test.js`

**Enhancement File**: `tests/integration/anatomy/slotSocketContract.enhanced.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import SlotGenerator from '../../../src/anatomy/slotGenerator.js';
import SocketGenerator from '../../../src/anatomy/socketGenerator.js';
import { createTestBed } from '../../common/testBed.js';

describe('SlotGenerator ↔ SocketGenerator Contract - Enhanced', () => {
  let testBed;
  let slotGenerator;
  let socketGenerator;

  beforeEach(() => {
    testBed = createTestBed();
    slotGenerator = new SlotGenerator({ logger: testBed.mockLogger });
    socketGenerator = new SocketGenerator({ logger: testBed.mockLogger });
  });

  it('should generate matching keys for all orientation schemes', () => {
    const schemes = ['bilateral', 'radial', 'indexed', 'custom', 'quadrupedal'];
    const counts = [1, 2, 4, 8, 16];

    for (const scheme of schemes) {
      for (const count of counts) {
        const template = {
          topology: {
            rootType: 'test_root',
            limbSets: [{
              type: 'test_limb',
              count,
              socketPattern: {
                orientationScheme: scheme,
                idTemplate: 'test_{{orientation}}_{{index}}',
                allowedTypes: ['test_type']
              }
            }]
          }
        };

        const slots = slotGenerator.generateBlueprintSlots(template);
        const sockets = socketGenerator.generateSockets(template);

        const slotKeys = Object.keys(slots).sort();
        const socketIds = sockets.map(s => s.id).sort();

        expect(slotKeys).toEqual(socketIds);
      }
    }
  });
});
```

### 2. Property-Based Tests

**Note**: OrientationResolver tests already exist at `tests/unit/anatomy/shared/orientationResolver.test.js`

**Prerequisites**: Install `fast-check` dependency
```bash
npm install --save-dev fast-check
```

**Enhancement File**: `tests/unit/anatomy/shared/orientationResolver.properties.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import { fc } from 'fast-check';
import { OrientationResolver } from '../../../../src/anatomy/shared/orientationResolver.js';

describe('OrientationResolver - Property-Based Tests', () => {
  it('should produce unique orientations for bilateral scheme (count > 4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 20 }), // Count > 4 (not quadrupedal)
        (count) => {
          const orientations = [];
          // Note: OrientationResolver uses 1-based indexing
          for (let i = 1; i <= count; i++) {
            orientations.push(
              OrientationResolver.resolveOrientation('bilateral', i, count)
            );
          }
          // For bilateral with count > 4, we expect alternating left/right
          const leftCount = orientations.filter(o => o === 'left').length;
          const rightCount = orientations.filter(o => o === 'right').length;
          return Math.abs(leftCount - rightCount) <= 1; // Should be roughly equal
        }
      )
    );
  });

  it('should always return a valid string (never undefined)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('bilateral', 'radial', 'indexed', 'custom', 'quadrupedal'),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 30 }),
        (scheme, index, count) => {
          const result = OrientationResolver.resolveOrientation(scheme, index, count);
          return typeof result === 'string' && result.length > 0;
        }
      )
    );
  });

  it('should be deterministic (same inputs produce same outputs)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('bilateral', 'radial', 'indexed'),
        fc.integer({ min: 1, max: 16 }),
        fc.integer({ min: 1, max: 16 }),
        (scheme, index, count) => {
          const result1 = OrientationResolver.resolveOrientation(scheme, index, count);
          const result2 = OrientationResolver.resolveOrientation(scheme, index, count);
          return result1 === result2;
        }
      )
    );
  });
});
```

### 3. Regression Test Suite

**Note**: The `tests/regression/` directory doesn't exist yet and should be created

**Directory Structure**:
```
tests/
  regression/
    anatomy/
      octopoid.regression.test.js
      spider.regression.test.js
      humanoid.regression.test.js
```

**File**: `tests/regression/anatomy/octopoid.regression.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Octopoid Regression Tests', () => {
  let testBed;
  let entityManager;
  let dataRegistry;
  let anatomyGenerationService;

  beforeEach(() => {
    testBed = createTestBed();
    // Setup services from DI container or create mocks
    entityManager = testBed.container.resolve('IEntityManager');
    dataRegistry = testBed.container.resolve('IDataRegistry');
    anatomyGenerationService = testBed.container.resolve('IAnatomyGenerationService');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should prevent recurrence of tentacle slot mismatch (Issue #XXXX)', async () => {
    // Create entity with octopoid anatomy
    const entityId = testBed.createEntity({
      components: [
        {
          id: 'anatomy:body',
          data: {
            blueprintId: 'anatomy:octopoid_body',
            recipeId: 'anatomy:octopoid_recipe'
          }
        }
      ]
    });

    // Generate anatomy
    await anatomyGenerationService.generateAnatomyIfNeeded(entityId);

    // Retrieve the generated anatomy
    const bodyEntity = entityManager.getEntityInstance(entityId);
    const bodyComponent = bodyEntity.getComponent('anatomy:body');

    // Verify tentacle parts exist
    const anatomyGraph = bodyComponent.data.anatomyGraph;
    const tentacles = anatomyGraph.parts.filter(p => p.type === 'tentacle');

    expect(tentacles).toHaveLength(8);

    // Verify clothing slots include tentacles
    const clothingSlots = bodyComponent.data.clothingSlots || [];
    const tentacleSlots = clothingSlots.filter(s => s.includes('tentacle'));
    expect(tentacleSlots.length).toBeGreaterThan(0);
  });
});
```

### 4. Full Pipeline Integration Tests

**Note**: Pipeline tests already exist at `tests/e2e/anatomy/anatomyGraphBuildingPipeline.e2e.test.js`

**Enhancement File**: `tests/integration/anatomy/fullPipeline.enhanced.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Anatomy Generation Pipeline - Enhanced', () => {
  let testBed;
  let entityManager;
  let dataRegistry;
  let bodyBlueprintFactory;
  let anatomyGenerationWorkflow;

  beforeEach(() => {
    testBed = createTestBed();
    entityManager = testBed.container.resolve('IEntityManager');
    dataRegistry = testBed.container.resolve('IDataRegistry');
    bodyBlueprintFactory = testBed.container.resolve('IBodyBlueprintFactory');
    anatomyGenerationWorkflow = testBed.container.resolve('IAnatomyGenerationWorkflow');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should generate complete anatomy from blueprint and recipe', async () => {
    // Create owner entity
    const ownerId = testBed.createEntity({
      components: [{ id: 'core:actor', data: { name: 'Test Actor' } }]
    });

    // Generate anatomy using the workflow
    const result = await anatomyGenerationWorkflow.generate(
      'anatomy:octopoid_body',
      'anatomy:octopoid_recipe',
      { ownerId }
    );

    // Verify anatomy structure
    expect(result.entities).toBeDefined();
    expect(result.entities.length).toBeGreaterThan(0); // Root + parts
    expect(result.rootId).toBeDefined();
    expect(result.partsMap).toBeInstanceOf(Map);
    expect(result.slotEntityMappings).toBeInstanceOf(Map);

    // Verify parts are connected
    const rootEntity = entityManager.getEntityInstance(result.rootId);
    expect(rootEntity).toBeDefined();

    // Verify anatomy graph is connected (no orphans)
    const anatomyGraph = rootEntity.getComponent('anatomy:part')?.data?.sockets || [];
    expect(anatomyGraph.length).toBeGreaterThan(0);
  });

  it('should handle blueprint composition correctly', async () => {
    const ownerId = testBed.createEntity({
      components: [{ id: 'core:actor', data: { name: 'Test Actor' } }]
    });

    const result = await anatomyGenerationWorkflow.generate(
      'anatomy:human_male',
      'anatomy:human_male',
      { ownerId }
    );

    // Verify humanoid anatomy has expected structure
    expect(result.entities.length).toBeGreaterThanOrEqual(10); // Body + limbs + head
    expect(result.clothingResult).toBeDefined(); // Should have clothing slots
  });
});
```

---

## Acceptance Criteria

**Existing Tests to Leverage:**
- [x] Contract tests exist at `tests/integration/anatomy/slotSocketSynchronization.test.js`
- [x] OrientationResolver tests exist at `tests/unit/anatomy/shared/orientationResolver.test.js`
- [x] Pipeline tests exist at `tests/e2e/anatomy/anatomyGraphBuildingPipeline.e2e.test.js`
- [x] Performance tests exist at `tests/performance/anatomy/slotGenerator.performance.test.js`

**New Tests to Implement:**
- [ ] Install `fast-check` dependency for property-based testing
- [ ] Create `tests/regression/` directory structure
- [ ] Enhanced contract tests covering edge cases and all orientation schemes
- [ ] Property-based tests for OrientationResolver invariants
- [ ] Regression tests for known issues (octopoid, spider, humanoid)
- [ ] Enhanced pipeline integration tests with validation coverage
- [ ] Performance benchmarks for large anatomy graphs (16+ sockets)
- [ ] Test coverage: OrientationResolver 100%, SlotGenerator/SocketGenerator 95%+
- [ ] All new tests passing with no regressions
- [ ] Documentation updated with testing patterns

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

## Assumptions Validated Against Production Code

### ✅ Correct Assumptions:
1. **OrientationResolver** exists and supports bilateral, radial, indexed, custom, and quadrupedal schemes
2. **SlotGenerator and SocketGenerator** exist and must produce synchronized IDs
3. **Orientation schemes** are implemented as documented
4. **Test infrastructure** exists with createTestBed and proper patterns

### ❌ Corrected Assumptions:
1. **SlotGenerator API**:
   - ❌ Original: `generateKeys(socketPattern, count)`
   - ✅ Actual: `generateBlueprintSlots(structureTemplate)` returns object mapping keys to definitions
   - ✅ Also: `extractSlotKeysFromLimbSet()`, `extractSlotKeysFromAppendage()`

2. **SocketGenerator API**:
   - ❌ Original: `generateIds(socketPattern, count)`
   - ✅ Actual: `generateSockets(structureTemplate)` returns array of socket objects `{id, orientation, allowedTypes, index}`

3. **Socket Pattern Structure**:
   - ❌ Original: Included `slotType` field
   - ✅ Actual: `{idTemplate, orientationScheme, allowedTypes, nameTpl?, positions?}`

4. **Blueprint/Recipe Loading**:
   - ❌ Original: `loadBlueprint()`, `loadRecipe()` standalone functions
   - ✅ Actual: `dataRegistry.get(id)` for accessing blueprints/recipes

5. **AnatomyGenerator API**:
   - ❌ Original: `anatomyGenerator.generate({blueprint, recipe, parameters})`
   - ✅ Actual: `anatomyGenerationWorkflow.generate(blueprintId, recipeId, options)`

6. **Entity API**:
   - ❌ Original: `entity.getParts()`, `entity.getClothingSlots()`
   - ✅ Actual: `entityManager.getEntityInstance(id)`, then `entity.getComponent(componentId)`

7. **Test Infrastructure**:
   - ❌ Original: Assumed `fast-check` dependency exists
   - ✅ Actual: Must be installed as devDependency
   - ❌ Original: Assumed `tests/regression/` directory exists
   - ✅ Actual: Must be created

8. **Existing Tests**:
   - ✅ Contract tests already exist at `tests/integration/anatomy/slotSocketSynchronization.test.js`
   - ✅ OrientationResolver tests exist at `tests/unit/anatomy/shared/orientationResolver.test.js`
   - ✅ Pipeline tests exist at `tests/e2e/anatomy/anatomyGraphBuildingPipeline.e2e.test.js`

---

**Created**: 2025-11-03
**Updated**: 2025-11-06 (Validated assumptions against production code)
**Status**: Ready for Implementation
