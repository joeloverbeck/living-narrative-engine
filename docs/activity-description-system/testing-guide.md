# Activity Description Testing Guide

Complete testing strategy for the Activity Description System with facade pattern and 7 specialized services.

## Table of Contents

1. [Test Organization](#test-organization)
2. [Test Suites](#test-suites)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [Performance Testing](#performance-testing)
6. [Memory Testing](#memory-testing)
7. [Migration Testing](#migration-testing)
8. [Test Utilities](#test-utilities)
9. [Best Practices](#best-practices)
10. [Continuous Integration](#continuous-integration)

---

## Test Organization

The test suite is organized by service and test type, following the new facade architecture.

### Directory Structure

```
tests/
├── unit/
│   └── anatomy/
│       ├── services/
│       │   ├── activityDescriptionFacade.test.js
│       │   ├── activityMetadataCollectionSystem.test.js
│       │   ├── activityNLGSystem.test.js
│       │   ├── grouping/
│       │   │   └── activityGroupingSystem.test.js
│       │   ├── context/
│       │   │   └── activityContextBuildingSystem.test.js
│       │   └── filtering/
│       │       └── activityFilteringSystem.test.js
│       ├── cache/
│       │   └── activityCacheManager.test.js
│       └── bodyDescriptionComposer.activityIntegration.test.js
├── integration/
│   └── anatomy/
│       ├── activityDescriptionIntegration.test.js
│       ├── activityContextAwareness.test.js
│       └── activityDescriptionConfiguration.test.js
├── performance/
│   └── anatomy/
│       ├── activityDescriptionPerformance.test.js
│       ├── activityNaturalLanguage.performance.test.js
│       └── activityCacheManager.performance.test.js
└── memory/
    └── anatomy/
        ├── activityDescriptionService.memory.test.js
        └── bodyDescriptionComposer.memory.test.js
```

---

## Test Suites

### Quick Reference

| Suite             | Command                                 | Purpose                          | Coverage Target      |
| ----------------- | --------------------------------------- | -------------------------------- | -------------------- |
| Unit Tests        | `npm run test:unit -- anatomy/services` | Service behavior, caching, logic | 90%+ functions/lines |
| Integration Tests | `npm run test:integration -- anatomy`   | Full pipeline, real modules      | 80%+ branches        |
| Performance Tests | `npm run test:performance -- anatomy`   | Throughput, caching efficiency   | <50ms per operation  |
| Memory Tests      | `npm run test:memory -- anatomy`        | Leak detection, cache cleanup    | No sustained growth  |

### Running Tests

```bash
# All activity description tests
npm run test:unit -- anatomy/services/activity
npm run test:integration -- anatomy/activity

# Specific service tests
npm run test:unit -- activityDescriptionFacade.test.js
npm run test:unit -- activityCacheManager.test.js
npm run test:unit -- activityNLGSystem.test.js

# Watch mode for development
npm run test:unit -- --watch anatomy/services

# Debug mode (sequential, verbose)
npm run test:single -- activityDescriptionFacade.test.js
```

---

## Unit Testing

### Testing Strategy

Each service is tested in isolation with mocked dependencies.

#### ActivityDescriptionFacade Tests

**Location**: `tests/unit/anatomy/services/activityDescriptionFacade.test.js`

**Coverage Areas**:

- Dependency validation
- Service orchestration
- Configuration merging
- Cache integration
- Error handling
- Event dispatching

**Example Test**:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('ActivityDescriptionFacade', () => {
  let facade;
  let mockServices;

  beforeEach(() => {
    mockServices = {
      logger: createMockLogger(),
      entityManager: createMockEntityManager(),
      cacheManager: createMockCacheManager(),
      metadataCollectionSystem: {
        collectActivityMetadata: jest
          .fn()
          .mockReturnValue([{ template: '{actor} waves', priority: 100 }]),
      },
      nlgSystem: {
        generatePhrase: jest.fn().mockReturnValue('waves'),
      },
      groupingSystem: {
        groupActivities: jest.fn().mockReturnValue(['waves']),
      },
      // ... other services
    };

    facade = new ActivityDescriptionFacade(mockServices);
  });

  it('should orchestrate services correctly', async () => {
    const result = await facade.generateActivityDescription('actor_123');

    expect(
      mockServices.metadataCollectionSystem.collectActivityMetadata
    ).toHaveBeenCalledWith('actor_123', expect.any(Object));
    expect(mockServices.nlgSystem.generatePhrase).toHaveBeenCalled();
    expect(result).toBe('waves');
  });

  it('should invalidate cache correctly', () => {
    facade.invalidateCache('actor_123', 'name');

    expect(mockServices.cacheManager.invalidate).toHaveBeenCalledWith(
      'entityName',
      'actor_123'
    );
  });
});
```

#### ActivityCacheManager Tests

**Location**: `tests/unit/anatomy/cache/activityCacheManager.test.js`

**Coverage Areas**:

- Cache registration
- TTL expiration
- LRU pruning
- Event-driven invalidation
- Multi-cache coordination

**Example Test**:

```javascript
describe('ActivityCacheManager', () => {
  let cacheManager;
  let mockEventBus;

  beforeEach(() => {
    mockEventBus = createMockEventBus();
    cacheManager = new ActivityCacheManager({
      logger: createMockLogger(),
      eventBus: mockEventBus,
    });
  });

  it('should register cache with configuration', () => {
    cacheManager.registerCache('testCache', { ttl: 30000, maxSize: 100 });

    cacheManager.set('testCache', 'key1', 'value1');
    const result = cacheManager.get('testCache', 'key1');

    expect(result).toBe('value1');
  });

  it('should respect TTL and expire entries', () => {
    jest.useFakeTimers();

    cacheManager.registerCache('testCache', { ttl: 1000 });
    cacheManager.set('testCache', 'key1', 'value1');

    // Before expiration
    expect(cacheManager.get('testCache', 'key1')).toBe('value1');

    // After expiration
    jest.advanceTimersByTime(1001);
    expect(cacheManager.get('testCache', 'key1')).toBeNull();

    jest.useRealTimers();
  });

  it('should prune LRU entries when maxSize exceeded', () => {
    cacheManager.registerCache('testCache', { maxSize: 2 });

    cacheManager.set('testCache', 'key1', 'value1');
    cacheManager.set('testCache', 'key2', 'value2');
    cacheManager.set('testCache', 'key3', 'value3'); // Should evict key1

    expect(cacheManager.get('testCache', 'key1')).toBeNull();
    expect(cacheManager.get('testCache', 'key2')).toBe('value2');
    expect(cacheManager.get('testCache', 'key3')).toBe('value3');
  });

  it('should invalidate on COMPONENT_ADDED event', () => {
    cacheManager.registerCache('entityName', {});
    cacheManager.set('entityName', 'actor_123', 'Alice');

    // Trigger event
    const componentAddedHandler = mockEventBus.subscribe.mock.calls.find(
      (call) => call[0] === 'COMPONENT_ADDED'
    )[1];

    componentAddedHandler({
      type: 'COMPONENT_ADDED',
      payload: { entityId: 'actor_123', componentId: 'core:name' },
    });

    expect(cacheManager.get('entityName', 'actor_123')).toBeNull();
  });
});
```

#### ActivityMetadataCollectionSystem Tests

**Location**: `tests/unit/anatomy/services/activityMetadataCollectionSystem.test.js`

**Coverage Areas**:

- 3-tier metadata collection
- Deduplication by signature
- Index integration
- Inline metadata extraction
- Dedicated metadata components

**Example Test**:

```javascript
describe('ActivityMetadataCollectionSystem', () => {
  let collector;
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn().mockReturnValue({
        components: new Map([
          [
            'positioning:kneeling',
            {
              activityMetadata: {
                template: '{actor} kneels',
                priority: 100,
              },
            },
          ],
        ]),
      }),
    };

    collector = new ActivityMetadataCollectionSystem({
      entityManager: mockEntityManager,
      logger: createMockLogger(),
    });
  });

  it('should collect inline metadata from components', () => {
    const activities = collector.collectActivityMetadata('actor_123');

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      type: 'inline',
      template: '{actor} kneels',
      priority: 100,
    });
  });

  it('should deduplicate activities by signature', () => {
    mockEntityManager.getEntityInstance.mockReturnValue({
      components: new Map([
        [
          'comp1',
          {
            activityMetadata: { template: '{actor} waves', priority: 100 },
          },
        ],
        [
          'comp2',
          {
            activityMetadata: { template: '{actor} waves', priority: 100 },
          },
        ],
      ]),
    });

    const activities = collector.collectActivityMetadata('actor_123');

    expect(activities).toHaveLength(1); // Deduplicated
  });
});
```

#### ActivityNLGSystem Tests

**Location**: `tests/unit/anatomy/services/activityNLGSystem.test.js`

**Coverage Areas**:

- Pronoun resolution
- Template processing
- Softener injection
- Adverb merging
- Gender-aware generation
- Name sanitization

**Example Test**:

```javascript
describe('ActivityNLGSystem', () => {
  let nlgSystem;
  let mockEntityManager;
  let mockCacheManager;

  beforeEach(() => {
    mockCacheManager = createMockCacheManager();
    mockEntityManager = {
      getEntityInstance: jest.fn().mockReturnValue({
        components: new Map([['core:gender', { gender: 'female' }]]),
      }),
    };

    nlgSystem = new ActivityNLGSystem({
      logger: createMockLogger(),
      entityManager: mockEntityManager,
      cacheManager: mockCacheManager,
    });
  });

  it('should resolve pronouns based on gender', () => {
    const pronoun = nlgSystem.resolvePronoun('actor_123', 'subject');

    expect(pronoun).toBe('she');
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
      'actor_123'
    );
  });

  it('should generate phrase with template placeholders', () => {
    const phrase = nlgSystem.generatePhrase(
      { template: '{actor} caresses {targetPossessive} hand' },
      {
        actorName: 'Alice',
        targetName: 'Bob',
        targetPronoun: 'he',
      }
    );

    expect(phrase).toBe('Alice caresses his hand');
  });

  it('should inject softeners correctly', () => {
    const phrase = nlgSystem.generatePhrase(
      {
        template: '{actor} {descriptor} touches {target}',
        descriptor: 'gently',
      },
      {
        actorName: 'Alice',
        targetName: 'Bob',
      }
    );

    expect(phrase).toBe('Alice gently touches Bob');
  });

  it('should merge adverbs naturally', () => {
    const merged = nlgSystem.mergeAdverb('softly', 'gently');

    expect(merged).toBe('softly and gently');
  });

  it('should sanitize entity names', () => {
    const clean = nlgSystem.sanitizeEntityName('Alice\u0000\t\n  ');

    expect(clean).toBe('Alice');
  });
});
```

#### ActivityGroupingSystem Tests

**Location**: `tests/unit/anatomy/services/grouping/activityGroupingSystem.test.js`

**Coverage Areas**:

- Grouping by target
- Simultaneity threshold
- Conjunction selection
- Priority ordering

**Example Test**:

```javascript
describe('ActivityGroupingSystem', () => {
  let groupingSystem;

  beforeEach(() => {
    groupingSystem = new ActivityGroupingSystem({
      logger: createMockLogger(),
      config: { simultaneityThreshold: 10 },
    });
  });

  it('should group activities with same target', () => {
    const grouped = groupingSystem.groupActivities([
      { target: 'target_1', priority: 100, phrase: 'kisses her' },
      { target: 'target_1', priority: 95, phrase: 'caresses her' },
      { target: 'target_2', priority: 80, phrase: 'waves to him' },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toBe('kisses her and caresses her');
    expect(grouped[1]).toBe('waves to him');
  });

  it('should respect simultaneity threshold', () => {
    const grouped = groupingSystem.groupActivities([
      { target: 'target_1', priority: 100, phrase: 'kisses her' },
      { target: 'target_1', priority: 50, phrase: 'waves to her' }, // > 10 diff
    ]);

    expect(grouped).toHaveLength(2); // Not grouped
  });
});
```

#### ActivityContextBuildingSystem Tests

**Location**: `tests/unit/anatomy/services/context/activityContextBuildingSystem.test.js`

**Coverage Areas**:

- Name resolution
- Closeness detection
- Tone adjustment
- Context structure

**Example Test**:

```javascript
describe('ActivityContextBuildingSystem', () => {
  let contextBuilder;
  let mockEntityManager;
  let mockCacheManager;

  beforeEach(() => {
    mockCacheManager = createMockCacheManager();
    mockEntityManager = {
      getEntityInstance: jest.fn().mockImplementation((id) => ({
        components: new Map([
          ['core:actor', { name: id === 'actor_123' ? 'Alice' : 'Bob' }],
          [
            'positioning:closeness',
            id === 'actor_123' ? { partners: ['target_456'] } : null,
          ],
        ]),
      })),
    };

    contextBuilder = new ActivityContextBuildingSystem({
      logger: createMockLogger(),
      entityManager: mockEntityManager,
      cacheManager: mockCacheManager,
    });
  });

  it('should build context with names and closeness', () => {
    const context = contextBuilder.buildContext('actor_123', 'target_456');

    expect(context).toMatchObject({
      actorName: 'Alice',
      targetName: 'Bob',
      closeness: expect.any(Number),
      relationshipTone: expect.stringMatching(/intimate|formal/),
    });
  });

  it('should set intimate tone for high closeness', () => {
    mockEntityManager.getEntityInstance.mockReturnValue({
      components: new Map([
        ['positioning:closeness', { partners: ['target_456'], closeness: 0.9 }],
      ]),
    });

    const context = contextBuilder.buildContext('actor_123', 'target_456');

    expect(context.relationshipTone).toBe('intimate');
  });
});
```

#### ActivityFilteringSystem Tests

**Location**: `tests/unit/anatomy/services/filtering/activityFilteringSystem.test.js`

**Coverage Areas**:

- Visibility filtering
- JSON Logic evaluation
- Context-aware conditions
- Error handling

**Example Test**:

```javascript
describe('ActivityFilteringSystem', () => {
  let filteringSystem;
  let mockJsonLogic;

  beforeEach(() => {
    mockJsonLogic = {
      evaluate: jest.fn().mockReturnValue(true),
    };

    filteringSystem = new ActivityFilteringSystem({
      logger: createMockLogger(),
      jsonLogicEvaluationService: mockJsonLogic,
    });
  });

  it('should filter out activities with visibility false', () => {
    const filtered = filteringSystem.filterActivities(
      [
        { template: 'visible', visibility: true },
        { template: 'hidden', visibility: false },
      ],
      {}
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].template).toBe('visible');
  });

  it('should evaluate JSON Logic conditions', () => {
    const filtered = filteringSystem.filterActivities(
      [
        {
          template: 'conditional',
          condition: { '>=': [{ var: 'closeness' }, 0.7] },
        },
      ],
      { closeness: 0.85 }
    );

    expect(mockJsonLogic.evaluate).toHaveBeenCalledWith(
      { '>=': [{ var: 'closeness' }, 0.7] },
      { closeness: 0.85 }
    );
    expect(filtered).toHaveLength(1);
  });
});
```

---

## Integration Testing

### Testing Strategy

Integration tests verify the complete pipeline with real module interactions.

#### Full Pipeline Integration

**Location**: `tests/integration/anatomy/activityDescriptionIntegration.test.js`

**Coverage Areas**:

- End-to-end pipeline
- Real mod data
- Multi-source metadata merging
- Configuration application

**Example Test**:

```javascript
describe('Activity Description Integration', () => {
  let container;
  let facade;

  beforeEach(async () => {
    container = await createIntegrationContainer();
    facade = container.resolve('IActivityDescriptionService');
  });

  it('should generate description from real mod data', async () => {
    // Setup: Create entity with positioning component
    const entityId = 'test_actor';
    const entity = await container
      .resolve('IEntityManager')
      .createEntity(entityId, 'core:actor');

    await entity.addComponent('positioning:kneeling', {
      target: 'target_npc',
    });

    // Act
    const description = await facade.generateActivityDescription(entityId);

    // Assert
    expect(description).toContain('kneel');
    expect(description.length).toBeGreaterThan(0);
  });

  it('should merge configuration from mods', async () => {
    const config = container
      .resolve('AnatomyFormattingService')
      .getActivityIntegrationConfig();

    expect(config).toMatchObject({
      prefix: expect.any(String),
      separator: expect.any(String),
      maxActivities: expect.any(Number),
    });
  });
});
```

#### Context Awareness Integration

**Location**: `tests/integration/anatomy/activityContextAwareness.test.js`

**Coverage Areas**:

- Closeness-based filtering
- Tone adjustment
- Pronoun usage

**Example Test**:

```javascript
describe('Activity Context Awareness', () => {
  it('should use pronouns for close relationships', async () => {
    const { actor, target } = await createClosePair();

    const description = await facade.generateActivityDescription(actor.id);

    // Should use pronouns (her/his) not names
    expect(description).toMatch(/\b(her|his|their)\b/);
  });

  it('should use names for distant relationships', async () => {
    const { actor, target } = await createDistantPair();

    const description = await facade.generateActivityDescription(actor.id);

    // Should use actual names
    expect(description).toContain(target.name);
  });
});
```

---

## Performance Testing

### Testing Strategy

Performance tests measure throughput, latency, and caching efficiency.

#### Throughput Testing

**Location**: `tests/performance/anatomy/activityDescriptionPerformance.test.js`

**Coverage Areas**:

- Generation speed
- Cache hit rates
- Bulk operations

**Example Test**:

```javascript
describe('Activity Description Performance', () => {
  it('should generate descriptions within 50ms (uncached)', async () => {
    const startTime = performance.now();

    await facade.generateActivityDescription('actor_123');

    const elapsed = performance.now() - startTime;
    expect(elapsed).toBeLessThan(50);
  });

  it('should achieve <1ms with cache hits', async () => {
    // Prime cache
    await facade.generateActivityDescription('actor_123');

    const startTime = performance.now();
    await facade.generateActivityDescription('actor_123');
    const elapsed = performance.now() - startTime;

    expect(elapsed).toBeLessThan(1);
  });

  it('should maintain 95%+ cache hit rate', async () => {
    const iterations = 1000;
    const uniqueEntities = 100;

    // Generate with repetition
    for (let i = 0; i < iterations; i++) {
      const entityId = `actor_${i % uniqueEntities}`;
      await facade.generateActivityDescription(entityId);
    }

    // Check cache metrics (if enabled)
    const metrics = cacheManager.getMetrics();
    const hitRate = metrics.hits / (metrics.hits + metrics.misses);

    expect(hitRate).toBeGreaterThan(0.95);
  });
});
```

#### Cache Performance

**Location**: `tests/performance/anatomy/activityCacheManager.performance.test.js`

**Example Test**:

```javascript
describe('ActivityCacheManager Performance', () => {
  it('should handle 10,000 cache operations in <100ms', () => {
    cacheManager.registerCache('perfTest', {});

    const startTime = performance.now();

    for (let i = 0; i < 10000; i++) {
      cacheManager.set('perfTest', `key_${i}`, `value_${i}`);
      cacheManager.get('perfTest', `key_${i}`);
    }

    const elapsed = performance.now() - startTime;
    expect(elapsed).toBeLessThan(100);
  });
});
```

---

## Memory Testing

### Testing Strategy

Memory tests detect leaks and verify proper cleanup.

#### Memory Leak Detection

**Location**: `tests/memory/anatomy/activityDescriptionService.memory.test.js`

**Example Test**:

```javascript
describe('Activity Description Memory', () => {
  it('should not leak memory on repeated generation', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Generate 1000 descriptions
    for (let i = 0; i < 1000; i++) {
      await facade.generateActivityDescription(`actor_${i}`);
    }

    // Force GC if available
    if (global.gc) global.gc();

    const finalMemory = process.memoryUsage().heapUsed;
    const growth = (finalMemory - initialMemory) / 1024 / 1024; // MB

    // Should not grow significantly (allow for cache)
    expect(growth).toBeLessThan(10); // <10MB growth
  });

  it('should cleanup resources on destroy', () => {
    const initialMemory = process.memoryUsage().heapUsed;

    const tempFacade = new ActivityDescriptionFacade(mockServices);
    tempFacade.destroy();

    if (global.gc) global.gc();

    const finalMemory = process.memoryUsage().heapUsed;

    expect(finalMemory).toBeLessThanOrEqual(initialMemory * 1.01);
  });
});
```

---

## Migration Testing

### Testing Strategy

Characterization tests ensure refactored system behaves identically to original.

#### Characterization Tests

**Location**: `tests/unit/anatomy/services/activityMetadataCollectionSystem.migration.test.js`

**Purpose**: Verify new services match old behavior exactly.

**Example Test**:

```javascript
describe('ActivityMetadataCollectionSystem - Migration', () => {
  it('should produce same results as old ActivityDescriptionService', () => {
    const newSystem = new ActivityMetadataCollectionSystem({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    const oldResults = legacyCollectMetadata(entityId); // Saved snapshot
    const newResults = newSystem.collectActivityMetadata(entityId);

    expect(newResults).toEqual(oldResults);
  });
});
```

---

## Test Utilities

### Common Helpers

Located in `tests/common/anatomy/`:

#### Mock Factories

```javascript
// tests/common/anatomy/mockFactories.js

export function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

export function createMockCacheManager() {
  const caches = new Map();

  return {
    registerCache: jest.fn((name) => caches.set(name, new Map())),
    get: jest.fn((cacheName, key) => caches.get(cacheName)?.get(key) || null),
    set: jest.fn((cacheName, key, value) =>
      caches.get(cacheName)?.set(key, value)
    ),
    invalidate: jest.fn((cacheName, key) => caches.get(cacheName)?.delete(key)),
    clearAllCaches: jest.fn(() => caches.clear()),
  };
}

export function createMockEntityManager() {
  return {
    getEntityInstance: jest.fn().mockReturnValue({
      components: new Map(),
    }),
  };
}
```

#### Test Fixtures

```javascript
// tests/common/anatomy/fixtures.js

export async function createTestEntity(container, type = 'core:actor') {
  const entityManager = container.resolve('IEntityManager');
  const entityId = `test_${Date.now()}`;

  return await entityManager.createEntity(entityId, type);
}

export async function createClosePair(container) {
  const actor = await createTestEntity(container);
  const target = await createTestEntity(container);

  await actor.addComponent('positioning:closeness', {
    partners: [target.id],
    closeness: 0.9,
  });

  return { actor, target };
}
```

---

## Best Practices

### 1. Test Organization

✅ **Group by service** - Keep tests organized by service/component
✅ **Use descriptive names** - Test names should describe behavior, not implementation
✅ **Arrange-Act-Assert** - Follow AAA pattern consistently

### 2. Mocking Strategy

✅ **Mock external dependencies** - EntityManager, EventBus, etc.
✅ **Use real services when testing integration** - Don't mock what you're testing
✅ **Verify interactions** - Check that services are called correctly

### 3. Test Coverage

✅ **Expected behavior** - Happy path scenarios
✅ **Edge cases** - Boundary conditions, empty inputs
✅ **Error handling** - Invalid inputs, missing data
✅ **Integration scenarios** - Service interactions

### 4. Performance Testing

✅ **Baseline first** - Establish performance baselines
✅ **Measure consistently** - Use same environment/data
✅ **Track trends** - Monitor performance over time

### 5. Memory Testing

✅ **Use GC** - Force garbage collection before measurements
✅ **Run with --expose-gc** - Enable manual GC trigger
✅ **Test cleanup** - Verify `destroy()` releases resources

---

## Continuous Integration

### CI Requirements

```yaml
# .github/workflows/test.yml
test:
  runs-on: ubuntu-latest
  steps:
    - name: Unit Tests
      run: npm run test:unit -- anatomy

    - name: Integration Tests
      run: npm run test:integration -- anatomy

    - name: Performance Tests (baseline)
      run: npm run test:performance -- anatomy

    - name: Memory Tests
      run: npm run test:memory -- anatomy
```

### Coverage Requirements

- **Unit Tests**: 90%+ functions, 90%+ lines, 80%+ branches
- **Integration Tests**: 80%+ branches on facade orchestration
- **Performance Tests**: All operations <50ms uncached, <1ms cached
- **Memory Tests**: No sustained heap growth, clean `destroy()`

### Pre-commit Hooks

```bash
# .husky/pre-commit
npm run test:unit -- anatomy/services --bail
npm run test:integration -- anatomy --bail
```

---

## Migration from Old Tests

### Updating Existing Tests

**Old pattern** (monolithic service):

```javascript
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';

const service = new ActivityDescriptionService({ ... });
```

**New pattern** (facade + services):

```javascript
import ActivityDescriptionFacade from '../../../src/anatomy/services/activityDescriptionFacade.js';
import ActivityCacheManager from '../../../src/anatomy/cache/activityCacheManager.js';
// ... import other services

const facade = new ActivityDescriptionFacade({
  cacheManager: new ActivityCacheManager({ ... }),
  // ... other services
});
```

### Test Migration Checklist

- [ ] Update imports to use facade and individual services
- [ ] Split monolithic tests into service-specific suites
- [ ] Add cache manager tests
- [ ] Add service integration tests
- [ ] Update test utilities and mocks
- [ ] Verify coverage remains ≥90%
- [ ] Add migration characterization tests

---

## Further Reading

- [Architecture](./architecture.md) - System design and service responsibilities
- [API Reference](./api-reference.md) - Complete API for testing
- [Configuration Guide](./configuration-guide.md) - Test configuration options
- [Development Guide](./development-guide.md) - Contributing tests
