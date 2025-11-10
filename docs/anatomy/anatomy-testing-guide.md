# Anatomy System Testing Guide

This guide covers testing strategies, patterns, and best practices for the anatomy system.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Types](#test-types)
3. [Contract Testing](#contract-testing)
4. [Integration Testing Patterns](#integration-testing-patterns)
5. [Unit Testing Patterns](#unit-testing-patterns)
6. [Test Fixtures & Utilities](#test-fixtures--utilities)
7. [Regression Testing](#regression-testing)
8. [Performance Testing](#performance-testing)
9. [Common Test Scenarios](#common-test-scenarios)

## Testing Philosophy

### Test Pyramid

The anatomy system follows a testing pyramid:

```
        ┌─────────────┐
        │    E2E      │  ← Few, slow, comprehensive
        │   Tests     │
        ├─────────────┤
        │Integration  │  ← Moderate number, medium speed
        │   Tests     │
        ├─────────────┤
        │    Unit     │  ← Many, fast, focused
        │   Tests     │
        └─────────────┘
```

**Test Distribution**:
- **Unit tests**: 70% - Fast, isolated, focused on single components
- **Integration tests**: 25% - Medium speed, test component interactions
- **E2E tests**: 5% - Slow, test complete workflows

### Testing Principles

1. **Test behavior, not implementation**: Focus on inputs/outputs, not internal details
2. **Contract testing**: Verify component interfaces and synchronization
3. **Test critical paths**: Prioritize testing generation pipeline and pattern matching
4. **Regression coverage**: Maintain tests for previously fixed bugs
5. **Fast feedback**: Unit tests should run in milliseconds

## Test Types

### Unit Tests

**Location**: `tests/unit/anatomy/`

**Purpose**: Test individual components in isolation

**Coverage Targets**:
- **Functions/Statements**: 90%+
- **Branches**: 80%+
- **Lines**: 90%+

**Example**:
```javascript
// tests/unit/anatomy/shared/orientationResolver.test.js
import { describe, it, expect } from '@jest/globals';
import { OrientationResolver } from '../../../../src/anatomy/shared/orientationResolver.js';

describe('OrientationResolver - bilateral scheme', () => {
  it('should resolve bilateral with 2 items', () => {
    expect(OrientationResolver.resolveOrientation('bilateral', 1, 2)).toBe('left');
    expect(OrientationResolver.resolveOrientation('bilateral', 2, 2)).toBe('right');
  });

  it('should resolve quadrupedal with 4 items', () => {
    expect(OrientationResolver.resolveOrientation('bilateral', 1, 4)).toBe('left_front');
    expect(OrientationResolver.resolveOrientation('bilateral', 2, 4)).toBe('right_front');
    expect(OrientationResolver.resolveOrientation('bilateral', 3, 4)).toBe('left_rear');
    expect(OrientationResolver.resolveOrientation('bilateral', 4, 4)).toBe('right_rear');
  });

  it('should handle out-of-bounds index', () => {
    expect(OrientationResolver.resolveOrientation('bilateral', 5, 2)).toBe('5');
    expect(OrientationResolver.resolveOrientation('bilateral', -1, 2)).toBe('-1');
  });
});
```

### Integration Tests

**Location**: `tests/integration/anatomy/`

**Purpose**: Test component interactions and workflows

**Coverage Targets**:
- All generation pipeline stages
- Pattern matching scenarios
- Event-driven integration
- Cache invalidation

**Example**:
```javascript
// tests/integration/anatomy/anatomyGeneration.integration.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Anatomy Generation - Integration', () => {
  let testBed;
  let anatomyService;
  let entityManager;

  beforeEach(async () => {
    testBed = createTestBed();
    anatomyService = testBed.getService('anatomyGenerationService');
    entityManager = testBed.getService('entityManager');

    // Load test mods with blueprints/recipes
    await testBed.loadMods(['anatomy', 'test_anatomy']);
  });

  it('should generate complete anatomy from V2 blueprint', async () => {
    // Arrange
    const ownerId = 'test_entity_1';
    const blueprintId = 'anatomy:spider_common';
    const recipeId = 'anatomy:spider_garden';

    // Act
    const result = await anatomyService.generateForEntity(
      ownerId,
      blueprintId,
      recipeId
    );

    // Assert
    expect(result).toBeDefined();
    expect(result.rootId).toBe(ownerId);
    expect(result.entities.length).toBeGreaterThan(8); // 8 legs + cephalothorax + abdomen

    // Verify parts map
    expect(result.partsMap.has('leg_1')).toBe(true);
    expect(result.partsMap.has('abdomen')).toBe(true);

    // Verify anatomy:body component
    const bodyComponent = await entityManager.getComponentData(ownerId, 'anatomy:body');
    expect(bodyComponent).toBeDefined();
    expect(bodyComponent.parts).toHaveLength(result.entities.length);
  });

  it('should dispatch ANATOMY_GENERATED event', async () => {
    // Arrange
    const eventSpy = jest.fn();
    testBed.eventBus.on('ANATOMY_GENERATED', eventSpy);

    // Act
    await anatomyService.generateForEntity('test_entity_1', 'anatomy:spider_common', 'anatomy:spider_garden');

    // Assert
    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'test_entity_1',
        blueprintId: expect.any(String),
        sockets: expect.any(Array),
      })
    );
  });
});
```

### E2E Tests

**Location**: `tests/e2e/anatomy/`

**Purpose**: Test complete user workflows

**Example Scenarios**:
- Character creation with anatomy and clothing
- Non-human creature instantiation
- Anatomy modification and cache updates

## Contract Testing

### Critical Contracts

#### 1. SlotGenerator ↔ SocketGenerator Synchronization

**Contract**: Both MUST produce identical slot keys and socket IDs

**Test Strategy**:
```javascript
// tests/integration/anatomy/slotSocketSynchronization.contract.test.js
describe('SlotGenerator ↔ SocketGenerator Contract', () => {
  it('should generate synchronized slot keys and socket IDs', async () => {
    // Arrange
    const template = testBed.createStructureTemplate({
      limbSets: [{
        type: 'leg',
        count: 4,
        socketPattern: {
          idTemplate: 'leg_{{orientation}}',
          orientationScheme: 'bilateral',
        },
      }],
    });

    // Act
    const slots = await slotGenerator.generateSlots(template);
    const sockets = await socketGenerator.generateSockets(template);

    // Assert - Slot keys MUST match socket IDs
    const slotKeys = slots.map(s => s.key).sort();
    const socketIds = sockets.map(s => s.id).sort();

    expect(slotKeys).toEqual(socketIds);
  });

  it('should use OrientationResolver for all orientation schemes', () => {
    // Verify both services import and use OrientationResolver
    const slotGenSource = fs.readFileSync('src/anatomy/slotGenerator.js', 'utf8');
    const socketGenSource = fs.readFileSync('src/anatomy/socketGenerator.js', 'utf8');

    expect(slotGenSource).toContain("from './shared/orientationResolver.js'");
    expect(socketGenSource).toContain("from './shared/orientationResolver.js'");

    expect(slotGenSource).toContain('OrientationResolver.resolveOrientation');
    expect(socketGenSource).toContain('OrientationResolver.resolveOrientation');
  });
});
```

#### 2. Blueprint ↔ Recipe Pattern Matching

**Contract**: Recipe patterns MUST match blueprint slot structure

**Test Strategy**:
```javascript
// tests/integration/anatomy/blueprintRecipeMatching.contract.test.js
describe('Blueprint ↔ Recipe Pattern Matching Contract', () => {
  it('should match all required slots with recipe patterns', async () => {
    // Arrange
    const blueprint = await testBed.loadBlueprint('anatomy:spider_common');
    const recipe = await testBed.loadRecipe('anatomy:spider_garden');

    // Act
    const resolvedSlots = await patternResolver.resolve(blueprint, recipe);

    // Assert - All blueprint slots should be covered
    const blueprintSlotKeys = Object.keys(blueprint.slots);
    const resolvedSlotKeys = resolvedSlots.map(s => s.key);

    for (const slotKey of blueprintSlotKeys) {
      expect(resolvedSlotKeys).toContain(slotKey);
    }
  });

  it('should warn on zero-match patterns', async () => {
    // Arrange
    const logger = testBed.createMockLogger();
    const recipe = {
      patterns: [
        { matchesPattern: 'nonexistent_*', partType: 'test' }
      ],
    };
    const blueprint = { slots: { leg_1: {} } };

    // Act
    await patternResolver.resolve(blueprint, recipe);

    // Assert - Should log warning for zero matches
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Pattern matched zero slots')
    );
  });
});
```

#### 3. Anatomy ↔ Clothing Integration

**Contract**: ANATOMY_GENERATED event MUST provide valid sockets

**Test Strategy**:
```javascript
// tests/integration/anatomy/clothingIntegration.contract.test.js
describe('Anatomy ↔ Clothing Integration Contract', () => {
  it('should provide valid sockets in ANATOMY_GENERATED event', async () => {
    // Arrange
    let eventPayload;
    eventBus.on('ANATOMY_GENERATED', (payload) => {
      eventPayload = payload;
    });

    // Act
    await anatomyService.generateForEntity('test_entity', 'anatomy:humanoid', 'anatomy:human_default');

    // Assert - Event must include sockets
    expect(eventPayload).toBeDefined();
    expect(eventPayload.sockets).toBeDefined();
    expect(Array.isArray(eventPayload.sockets)).toBe(true);

    // Each socket must have id and orientation
    for (const socket of eventPayload.sockets) {
      expect(socket).toHaveProperty('id');
      expect(socket).toHaveProperty('orientation');
      expect(typeof socket.id).toBe('string');
      expect(typeof socket.orientation).toBe('string');
    }
  });

  it('should build socket index before dispatching event', async () => {
    // Arrange
    let socketIndexReady = false;
    eventBus.on('ANATOMY_GENERATED', async ({ entityId }) => {
      // Socket index should be ready when event fires
      const sockets = await socketIndex.getEntitySockets(entityId);
      socketIndexReady = sockets.length > 0;
    });

    // Act
    await anatomyService.generateForEntity('test_entity', 'anatomy:humanoid', 'anatomy:human_default');

    // Assert
    expect(socketIndexReady).toBe(true);
  });
});
```

## Integration Testing Patterns

### Pattern 1: Complete Generation Workflow

```javascript
describe('Complete Anatomy Generation Workflow', () => {
  it('should generate anatomy with all stages', async () => {
    // Arrange
    const ownerId = 'test_character';

    // Act
    const result = await anatomyService.generateForEntity(
      ownerId,
      'anatomy:humanoid',
      'anatomy:human_default'
    );

    // Assert each stage
    // Stage 1: Blueprint resolution
    expect(result.rootId).toBe(ownerId);

    // Stage 2: Recipe processing
    expect(result.partsMap.size).toBeGreaterThan(0);

    // Stage 3: Entity graph building
    expect(result.entities.length).toBeGreaterThan(0);

    // Stage 4: Post-generation
    const bodyComponent = await entityManager.getComponentData(ownerId, 'anatomy:body');
    expect(bodyComponent).toBeDefined();

    // Stage 5: Event dispatch (verified via spy)
    expect(eventSpy).toHaveBeenCalled();
  });
});
```

### Pattern 2: Template Change Impact Testing

```javascript
describe('Template Change Impact', () => {
  it('should handle template orientation scheme change', async () => {
    // Scenario: Template changes from indexed to bilateral
    // Verify recipe patterns still work

    // Arrange
    const templateV1 = {
      limbSets: [{
        type: 'leg',
        count: 4,
        socketPattern: {
          idTemplate: 'leg_{{index}}',
          orientationScheme: 'indexed',
        },
      }],
    };

    const templateV2 = {
      limbSets: [{
        type: 'leg',
        count: 4,
        socketPattern: {
          idTemplate: 'leg_{{orientation}}',
          orientationScheme: 'bilateral',
        },
      }],
    };

    const recipeWithGroup = {
      patterns: [
        { matchesGroup: 'limbSet:leg', partType: 'leg' }
      ],
    };

    // Act & Assert - matchesGroup should work with both templates
    const slotsV1 = await generateAndResolve(templateV1, recipeWithGroup);
    const slotsV2 = await generateAndResolve(templateV2, recipeWithGroup);

    expect(slotsV1.length).toBe(4);
    expect(slotsV2.length).toBe(4);
  });
});
```

### Pattern 3: Cache Invalidation Testing

```javascript
describe('Socket Index Cache Invalidation', () => {
  it('should invalidate cache when anatomy changes', async () => {
    // Arrange
    const entityId = 'test_entity';
    await anatomyService.generateForEntity(entityId, 'anatomy:humanoid', 'anatomy:human_default');

    // Cache initial sockets
    const initialSockets = await socketIndex.getEntitySockets(entityId);

    // Act - Modify anatomy structure
    await anatomyService.regenerateAnatomy(entityId, 'anatomy:humanoid', 'anatomy:human_muscular');

    // Assert - Cache should reflect new structure
    const updatedSockets = await socketIndex.getEntitySockets(entityId);
    expect(updatedSockets).not.toEqual(initialSockets);
  });
});
```

## Unit Testing Patterns

### Pattern 1: OrientationResolver Testing

```javascript
describe('OrientationResolver', () => {
  // Test all supported schemes
  const schemes = ['bilateral', 'quadrupedal', 'radial', 'indexed', 'custom'];

  for (const scheme of schemes) {
    describe(`${scheme} scheme`, () => {
      it('should resolve valid indices', () => {
        // Test specific to scheme
      });

      it('should handle out-of-bounds indices', () => {
        // Fallback behavior
      });

      it('should never return undefined', () => {
        // Critical requirement
      });
    });
  }
});
```

### Pattern 2: Pattern Resolver Testing

```javascript
describe('RecipePatternResolver', () => {
  describe('matchesGroup', () => {
    it('should match all slots from limbSet', () => {
      const blueprint = {
        slots: {
          leg_1: { slotGroup: 'limbSet:leg' },
          leg_2: { slotGroup: 'limbSet:leg' },
          arm_1: { slotGroup: 'limbSet:arm' },
        },
      };

      const pattern = { matchesGroup: 'limbSet:leg' };

      const matched = resolver.matchPattern(pattern, blueprint);

      expect(matched).toHaveLength(2);
      expect(matched.map(s => s.key)).toEqual(['leg_1', 'leg_2']);
    });
  });

  describe('matchesPattern', () => {
    it('should match wildcard patterns', () => {
      const blueprint = {
        slots: {
          leg_left: {},
          leg_right: {},
          arm_left: {},
        },
      };

      const pattern = { matchesPattern: 'leg_*' };

      const matched = resolver.matchPattern(pattern, blueprint);

      expect(matched).toHaveLength(2);
    });
  });
});
```

### Pattern 3: Socket Index Testing

```javascript
describe('AnatomySocketIndex', () => {
  it('should provide O(1) socket lookup', async () => {
    // Arrange
    const rootEntityId = 'test_entity';
    await socketIndex.buildIndex(rootEntityId);

    // Act & Assert - Multiple lookups should be fast
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      await socketIndex.findEntityWithSocket(rootEntityId, 'leg_left');
    }
    const duration = performance.now() - start;

    // Should be much faster than O(n) traversal
    expect(duration).toBeLessThan(100); // 100ms for 1000 lookups
  });

  it('should invalidate cache correctly', async () => {
    const rootEntityId = 'test_entity';
    await socketIndex.buildIndex(rootEntityId);

    socketIndex.invalidateIndex(rootEntityId);

    const entities = await socketIndex.getEntitiesWithSockets(rootEntityId);
    expect(entities).toEqual([]); // Cache cleared, will rebuild on next access
  });
});
```

## Test Fixtures & Utilities

### Test Bed Setup

```javascript
// tests/common/anatomy/anatomyTestBed.js
export class AnatomyTestBed {
  constructor() {
    this.testBed = createTestBed();
    this.anatomyService = null;
    this.entityManager = null;
  }

  async setup() {
    await this.testBed.loadMods(['core', 'anatomy']);
    this.anatomyService = this.testBed.getService('anatomyGenerationService');
    this.entityManager = this.testBed.getService('entityManager');
  }

  createStructureTemplate(overrides = {}) {
    return {
      id: 'test:structure_template',
      topology: {
        rootType: 'torso',
        limbSets: [],
        appendages: [],
      },
      ...overrides,
    };
  }

  createBlueprint(overrides = {}) {
    return {
      id: 'test:blueprint',
      schemaVersion: '2.0',
      root: 'anatomy:human_torso',
      slots: {},
      ...overrides,
    };
  }

  createRecipe(overrides = {}) {
    return {
      recipeId: 'test:recipe',
      blueprintId: 'test:blueprint',
      slots: {},
      patterns: [],
      ...overrides,
    };
  }

  async generateTestAnatomy(entityId = 'test_entity') {
    return await this.anatomyService.generateForEntity(
      entityId,
      'anatomy:humanoid',
      'anatomy:human_default'
    );
  }

  cleanup() {
    this.testBed.cleanup();
  }
}
```

### Common Test Scenarios

```javascript
// tests/common/anatomy/testScenarios.js
export const testScenarios = {
  async createSpiderAnatomy(testBed) {
    const ownerId = 'test_spider';
    return await testBed.anatomyService.generateForEntity(
      ownerId,
      'anatomy:spider_common',
      'anatomy:spider_garden'
    );
  },

  async createHumanoidAnatomy(testBed) {
    const ownerId = 'test_humanoid';
    return await testBed.anatomyService.generateForEntity(
      ownerId,
      'anatomy:humanoid',
      'anatomy:human_default'
    );
  },

  async createDragonAnatomy(testBed) {
    const ownerId = 'test_dragon';
    return await testBed.anatomyService.generateForEntity(
      ownerId,
      'anatomy:dragon_v2',
      'anatomy:dragon_red'
    );
  },
};
```

## Regression Testing

### Critical Regression Tests

#### 1. Orientation Synchronization Bug

**Fixed In**: Commit `af53a1948`

**Test**:
```javascript
describe('Regression: Orientation synchronization', () => {
  it('should generate matching slot keys and socket IDs', async () => {
    // This test prevents the bug from recurring
    const template = createOctopoidTemplate();
    const blueprint = await blueprintFactory.createFromTemplate(template);

    const slotKeys = Object.keys(blueprint.slots);
    const sockets = await socketIndex.getEntitySockets(blueprint.rootId);
    const socketIds = sockets.map(s => s.id);

    // Critical: Slot keys MUST match socket IDs
    for (const slotKey of slotKeys) {
      expect(socketIds).toContain(slotKey);
    }
  });
});
```

#### 2. Zero-Match Pattern Silent Failure

**Test**:
```javascript
describe('Regression: Zero-match pattern warning', () => {
  it('should log warning for zero-match patterns', async () => {
    const logger = createMockLogger();
    const recipe = {
      patterns: [
        { matchesPattern: 'nonexistent_*', partType: 'test' }
      ],
    };

    await resolver.resolve(blueprint, recipe);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Pattern matched zero slots')
    );
  });
});
```

## Performance Testing

### Location

`tests/performance/anatomy/`

### Key Metrics

- **Generation time**: < 100ms for typical humanoid
- **Socket lookup**: O(1) after index build
- **Pattern matching**: < 10ms for 20 patterns
- **Memory usage**: < 500KB per root entity

### Example Performance Test

```javascript
// tests/performance/anatomy/generationPerformance.test.js
describe('Anatomy Generation Performance', () => {
  it('should generate humanoid anatomy within time budget', async () => {
    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await anatomyService.generateForEntity(
        `test_entity_${i}`,
        'anatomy:humanoid',
        'anatomy:human_default'
      );
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    expect(avgDuration).toBeLessThan(100); // < 100ms average
  });

  it('should scale linearly with limb count', async () => {
    const limbCounts = [4, 8, 16, 32];
    const durations = [];

    for (const count of limbCounts) {
      const template = createTemplateWithLimbs(count);
      const start = performance.now();
      await generateFromTemplate(template);
      durations.push(performance.now() - start);
    }

    // Check linear scaling (O(n) acceptable for generation)
    const ratio1 = durations[1] / durations[0]; // 8 limbs / 4 limbs
    const ratio2 = durations[2] / durations[1]; // 16 limbs / 8 limbs

    expect(ratio1).toBeCloseTo(2, 0.5); // ~2x slower
    expect(ratio2).toBeCloseTo(2, 0.5); // ~2x slower
  });
});
```

## Common Test Scenarios

### Scenario 1: Humanoid Character

```javascript
it('should generate complete humanoid anatomy', async () => {
  const result = await anatomyService.generateForEntity(
    'human_1',
    'anatomy:humanoid',
    'anatomy:human_default'
  );

  expect(result.partsMap.has('head')).toBe(true);
  expect(result.partsMap.has('torso')).toBe(true);
  expect(result.partsMap.has('arm_left')).toBe(true);
  expect(result.partsMap.has('arm_right')).toBe(true);
  expect(result.partsMap.has('leg_left')).toBe(true);
  expect(result.partsMap.has('leg_right')).toBe(true);
});
```

### Scenario 2: Non-Human Creature (Spider)

```javascript
it('should generate spider anatomy with 8 legs', async () => {
  const result = await anatomyService.generateForEntity(
    'spider_1',
    'anatomy:spider_common',
    'anatomy:spider_garden'
  );

  // Verify 8 legs generated
  for (let i = 1; i <= 8; i++) {
    expect(result.partsMap.has(`leg_${i}`)).toBe(true);
  }

  // Verify cephalothorax and abdomen
  expect(result.partsMap.has('cephalothorax')).toBe(true);
  expect(result.partsMap.has('abdomen')).toBe(true);
});
```

### Scenario 3: Anatomy with Clothing

```javascript
it('should attach clothing to anatomy sockets', async () => {
  const result = await anatomyService.generateForEntity(
    'human_1',
    'anatomy:humanoid',
    'anatomy:human_clothed' // Recipe includes clothing
  );

  expect(result.clothingResult).toBeDefined();
  expect(result.clothingResult.instantiated.length).toBeGreaterThan(0);

  // Verify clothing attached to correct sockets
  const torsoClothing = result.clothingResult.instantiated.find(
    item => item.slot === 'torso'
  );
  expect(torsoClothing).toBeDefined();
});
```

## Testing Targetless Actions with Anatomy Prerequisites

Actions with `targets: "none"` can still evaluate prerequisites that reference the actor's anatomy or components. The test environment automatically creates actor context for prerequisite evaluation even when no targets are present.

### Quick Example

```javascript
it('should evaluate anatomy prerequisites for targetless action', async () => {
  // Create actor with anatomy parts as separate entities
  const actorId = 'actor-1';
  const torsoId = `${actorId}_torso`;
  const breastId = `${actorId}_breast`;

  const actor = new ModEntityBuilder(actorId)
    .withName('Test Actor')
    .asActor()
    .atLocation('test-room')
    .withLocationComponent('test-room')
    .withBody(torsoId) // Links to root anatomy part
    .build();

  const torso = new ModEntityBuilder(torsoId)
    .asBodyPart({ parent: null, children: [breastId], subType: 'torso' })
    .build();

  const breast = new ModEntityBuilder(breastId)
    .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
    .build();

  // Other actor required for hasOtherActorsAtLocation prerequisite
  const otherActor = new ModEntityBuilder('other-actor')
    .asActor()
    .atLocation('test-room')
    .withLocationComponent('test-room')
    .build();

  fixture.reset([actor, torso, breast, otherActor]);

  const actions = fixture.discoverActions(actorId);
  expect(actions).toContainEqual(
    expect.objectContaining({ id: 'seduction:squeeze_breasts_draw_attention' })
  );
});
```

### Key Points

- **Anatomy Structure**: Body parts are separate entities, not nested in `anatomy:body`
- **anatomy:body Component**: Only contains `{ body: { root: 'entity-id' } }`
- **hasPartOfType Operator**: Checks the `subType` field in `anatomy:part` component
- **ModEntityBuilder.asBodyPart()**: Use to create anatomy part entities
- **Actor Context**: Created automatically even when `targets: "none"`

### Pattern 1: Anatomy-Based Targetless Actions

Actions that require the actor to have specific anatomy:

**Example Action:**
```json
{
  "id": "seduction:squeeze_breasts_draw_attention",
  "targets": "none",
  "prerequisites": [
    { "logic": { "hasPartOfType": ["actor", "breast"] } }
  ]
}
```

**Test Pattern:**
```javascript
it('should evaluate anatomy prerequisites for targetless actions', () => {
  // Anatomy is modeled as separate entities with anatomy:part components
  const actorId = 'actor-1';
  const torsoId = `${actorId}_torso`;
  const leftBreastId = `${actorId}_left_breast`;
  const rightBreastId = `${actorId}_right_breast`;

  const actor = new ModEntityBuilder(actorId)
    .asActor()
    .atLocation('test-room')
    .withLocationComponent('test-room')
    .withBody(torsoId) // Links to root anatomy part
    .build();

  const torso = new ModEntityBuilder(torsoId)
    .asBodyPart({ parent: null, children: [leftBreastId, rightBreastId], subType: 'torso' })
    .build();

  const leftBreast = new ModEntityBuilder(leftBreastId)
    .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
    .build();

  const rightBreast = new ModEntityBuilder(rightBreastId)
    .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
    .build();

  // Other actors required for hasOtherActorsAtLocation prerequisite
  const otherActor = new ModEntityBuilder('other-actor')
    .asActor()
    .atLocation('test-room')
    .withLocationComponent('test-room')
    .build();

  fixture.reset([actor, torso, leftBreast, rightBreast, otherActor]);

  const actions = fixture.discoverActions(actorId);
  expect(actions).toContainEqual(
    expect.objectContaining({ id: 'seduction:squeeze_breasts_draw_attention' })
  );
});
```

**Key Points:**
- Anatomy is NOT nested in `anatomy:body.parts` - parts are separate entities
- Use `ModEntityBuilder.asBodyPart({ subType: 'breast' })` to create body parts
- `hasPartOfType` operator checks the `subType` field in `anatomy:part` component
- `anatomy:body` component only contains `{ body: { root: 'torso-id' } }`

### Pattern 2: Component-Based Targetless Actions

Actions that check for forbidden or required components:

**Example Action:**
```json
{
  "id": "seduction:grab_crotch_draw_attention",
  "targets": "none",
  "forbidden_components": [
    { "type": "sex-penile-oral:receiving_blowjob" }
  ]
}
```

**Test Pattern:**
```javascript
it('should respect forbidden components for targetless actions', () => {
  const actorId = 'actor-forbidden';
  const torsoId = `${actorId}_torso`;
  const breastId = `${actorId}_breast`;

  const actor = new ModEntityBuilder(actorId)
    .asActor()
    .atLocation('test-room')
    .withLocationComponent('test-room')
    .withBody(torsoId)
    .withComponent('positioning:hugging', { // Forbidden component
      embraced_entity_id: 'someone',
      initiated: true
    })
    .build();

  const torso = new ModEntityBuilder(torsoId)
    .asBodyPart({ parent: null, children: [breastId], subType: 'torso' })
    .build();

  const breast = new ModEntityBuilder(breastId)
    .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
    .build();

  const otherActor = new ModEntityBuilder('other-actor')
    .asActor()
    .atLocation('test-room')
    .withLocationComponent('test-room')
    .build();

  fixture.reset([actor, torso, breast, otherActor]);

  const actions = fixture.discoverActions(actorId);
  // Action should NOT be discovered due to forbidden positioning:hugging component
  expect(actions).not.toContainEqual(
    expect.objectContaining({ id: 'seduction:squeeze_breasts_draw_attention' })
  );
});
```

**Key Points:**
- `forbidden_components` is checked during action discovery
- Components are added using `ModEntityBuilder.withComponent(componentId, data)`
- Discovery pipeline automatically filters out actions with forbidden components present

### Common Mistakes with Targetless Actions

#### ❌ Incorrect Anatomy Structure

**Wrong:**
```javascript
// Anatomy parts nested in anatomy:body component
const actor = new ModEntityBuilder('actor')
  .withComponent('anatomy:body', {
    parts: {
      'breast': { type: 'breast', name: 'left breast' } // ❌ Wrong structure
    }
  })
  .build();
```

**Correct:**
```javascript
// Anatomy parts are separate entities
const actor = new ModEntityBuilder('actor')
  .withBody('torso-id') // ✅ References root part entity
  .build();

const breast = new ModEntityBuilder('breast-id')
  .asBodyPart({ // ✅ Separate entity with anatomy:part component
    parent: 'torso-id',
    children: [],
    subType: 'breast' // ✅ Used by hasPartOfType operator
  })
  .build();
```

#### ❌ Using Wrong Property Names

**Wrong:**
```javascript
.asBodyPart({
  parent: 'torso',
  children: [],
  type: 'breast' // ❌ Should be 'subType'
})
```

**Correct:**
```javascript
.asBodyPart({
  parent: 'torso',
  children: [],
  subType: 'breast' // ✅ Correct property name
})
```

#### ❌ Forgetting Required Prerequisites

**Wrong:**
```javascript
// Testing action but missing hasOtherActorsAtLocation prerequisite
fixture.reset([actor, ...bodyParts]); // ❌ No other actors
const actions = fixture.discoverActions(actorId);
// Action won't be discovered - prerequisite fails silently
```

**Correct:**
```javascript
// Include entities needed to satisfy all prerequisites
const otherActor = new ModEntityBuilder('other')
  .asActor()
  .atLocation('same-room')
  .withLocationComponent('same-room')
  .build();

fixture.reset([actor, ...bodyParts, otherActor]); // ✅ Other actor present
const actions = fixture.discoverActions(actorId);
```

#### ❌ Async/Await Confusion

**Wrong:**
```javascript
// discoverActions is synchronous, not async
const actions = await fixture.discoverActions(actor.id); // ❌ Unnecessary await
```

**Correct:**
```javascript
// Discovery is synchronous
const actions = fixture.discoverActions(actor.id); // ✅ No await

// Execution is async
await fixture.executeAction(actor.id); // ✅ Await needed
```

### Targetless Action Execution

For targetless actions, omit the target parameter or pass null:

```javascript
// Targetless (no target parameter)
await fixture.executeAction(actorId);

// Explicit null
await fixture.executeAction(actorId, null);

// With target (for non-targetless actions)
await fixture.executeAction(actorId, targetId);
```

### Internal Prerequisite Handling

Prerequisites are evaluated internally during discovery. The `buildPrerequisiteContextOverride` function in `systemLogicTestEnv.js` creates context for prerequisite evaluation:

```javascript
// Internal function (systemLogicTestEnv.js:1288-1348)
// Always creates actor context if actorId provided, even for targetless actions
buildPrerequisiteContextOverride(resolvedTargets, actorId)
// Returns: { actor: {...}, targets: {...} } or null
```

**Key behaviors:**
- Actor context created even when `targets: "none"`
- Context includes actor entity and components for prerequisite evaluation
- Returns `null` only when both actorId and resolvedTargets are empty

### References

- **Test Examples:**
  - `tests/integration/mods/seduction/squeeze_breasts_draw_attention_action_discovery.test.js` - Real implementation
- **Real-World Actions:**
  - `data/mods/seduction/actions/squeeze_breasts_draw_attention.action.json` (lines 12-34: prerequisites)
  - `data/mods/seduction/actions/grab_crotch_draw_attention.action.json`
  - `data/mods/seduction/actions/stroke_penis_to_draw_attention.action.json`
- **Production Code:**
  - `tests/common/mods/ModTestFixture.js` - Test fixture factory (lines 0-99: structure)
  - `tests/common/mods/ModEntityBuilder.js` - Entity builder (lines 375-406: anatomy methods)
  - `tests/common/engine/systemLogicTestEnv.js` - Test environment (lines 1288-1348: prerequisite context)
  - `src/logic/operators/hasPartOfTypeOperator.js` - Anatomy prerequisite operator
- **Component Schema:**
  - `data/mods/anatomy/components/body.component.json` - anatomy:body structure (lines 13-104)

## Best Practices

### 1. Test Isolation

```javascript
// ✅ Good - Isolated test
beforeEach(async () => {
  testBed = new AnatomyTestBed();
  await testBed.setup();
});

afterEach(() => {
  testBed.cleanup();
});

// ❌ Bad - Shared state
const testBed = new AnatomyTestBed(); // Shared across tests
```

### 2. Descriptive Test Names

```javascript
// ✅ Good
it('should generate bilateral orientation for 2-count limb set', () => {});

// ❌ Bad
it('should work', () => {});
```

### 3. Arrange-Act-Assert Pattern

```javascript
it('should match pattern to slots', () => {
  // Arrange
  const blueprint = createTestBlueprint();
  const pattern = { matchesPattern: 'leg_*' };

  // Act
  const matched = resolver.matchPattern(pattern, blueprint);

  // Assert
  expect(matched.length).toBe(2);
});
```

### 4. Test Error Conditions

```javascript
it('should throw ValidationError for invalid blueprint', async () => {
  const invalidBlueprint = { /* missing required fields */ };

  await expect(
    anatomyService.generateForEntity('entity', invalidBlueprint, 'recipe')
  ).rejects.toThrow(ValidationError);
});
```

### 5. Use Test Utilities

```javascript
// ✅ Good - Use test utilities
const template = testBed.createStructureTemplate({
  limbSets: [createLegLimbSet(4)],
});

// ❌ Bad - Inline test data
const template = {
  id: 'test:template',
  topology: {
    rootType: 'torso',
    limbSets: [{
      type: 'leg',
      count: 4,
      // ... lots of boilerplate
    }],
  },
};
```

## Related Documentation

- [Anatomy System Guide](anatomy-system-guide.md) - System architecture overview
- [Troubleshooting](troubleshooting.md) - Common issues and solutions
- [Mod Testing Guide](../testing/mod-testing-guide.md) - General mod testing patterns
- [Development Guide](../development/anatomy-development-guide.md) - Quick-start for developers
