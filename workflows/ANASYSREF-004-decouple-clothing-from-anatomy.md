# ANASYSREF-004: Decouple Clothing System from Anatomy

**Priority**: 🟢 **RECOMMENDED**
**Phase**: 2 - Structural Improvements
**Estimated Effort**: 20-30 hours
**Dependencies**: ANASYSREF-001, ANASYSREF-002, ANASYSREF-003
**Report Reference**: `reports/anatomy-system-refactoring-analysis.md` (Section: Phase 2.1)

---

## Problem Statement

The clothing system has a **circular dependency** with the anatomy system, leading to:
- Complex cache management and invalidation logic
- Timing-sensitive operations (invalidation must happen before queries)
- Difficult to test in isolation
- State management spread across multiple services
- No clear ownership boundaries

### Current Architecture (Problematic)

```
Anatomy ←→ Clothing (Circular dependency)
   ↓           ↓
Cache invalidation must be coordinated
Slot-to-entity mappings manually updated
No transactional guarantees
```

---

## Objective

Refactor to an **event-driven architecture** with clear ownership:
- Anatomy owns body structure generation
- Clothing consumes anatomy events
- Unidirectional dependency flow (Anatomy → Clothing)
- Event-based integration eliminates circular dependencies

---

## Implementation Details

### 1. Event-Driven Integration

**Anatomy publishes events** when generation completes:

```javascript
// In anatomyGenerationWorkflow.js
async execute() {
  // ... existing anatomy generation logic

  // Publish event when anatomy is ready
  this.#eventBus.dispatch({
    type: 'ANATOMY_GENERATED',
    payload: {
      entityId,
      blueprintId: blueprint.id,
      socketIndex: this.#socketIndex.getAllSockets(entityId),
      timestamp: Date.now(),
      bodyParts: result.entities.map(e => e.id)
    }
  });

  return result;
}
```

**Clothing subscribes and reacts**:

```javascript
// In clothingInstantiationService.js or similar
constructor({ eventBus, logger, clothingService }) {
  this.#eventBus = eventBus;
  this.#logger = logger;
  this.#clothingService = clothingService;

  // Subscribe to anatomy events
  this.#eventBus.on('ANATOMY_GENERATED', this.#handleAnatomyGenerated.bind(this));
}

async #handleAnatomyGenerated(event) {
  const { entityId, socketIndex } = event.payload;

  this.#logger.info(`Anatomy generated for ${entityId}, instantiating clothing`);

  try {
    await this.#clothingService.instantiateDefaultClothing(entityId, socketIndex);
  } catch (err) {
    this.#logger.error(`Failed to instantiate clothing for ${entityId}`, err);
    this.#eventBus.dispatch({
      type: 'CLOTHING_INSTANTIATION_FAILED',
      payload: { entityId, error: err.message }
    });
  }
}
```

### 2. Simplified SlotResolver

Remove circular dependencies and simplify cache management:

```javascript
// In src/anatomy/integration/SlotResolver.js
export class SlotResolver {
  #cache;
  #socketIndex;  // Read-only dependency on anatomy
  #strategies;

  constructor({ socketIndex, strategies, cache }) {
    this.#socketIndex = socketIndex;
    this.#strategies = strategies;
    this.#cache = cache || new Map();

    // No longer needs event subscriptions - cache managed externally
  }

  resolveSlot(entityId, clothingSlotId) {
    const cacheKey = `${entityId}:${clothingSlotId}`;

    if (this.#cache.has(cacheKey)) {
      return this.#cache.get(cacheKey);
    }

    // Try strategies in priority order
    for (const strategy of this.#strategies) {
      const result = strategy.resolve(entityId, clothingSlotId, this.#socketIndex);
      if (result) {
        this.#cache.set(cacheKey, result);
        return result;
      }
    }

    return null;
  }

  // Cache invalidation now handled by external CacheCoordinator
  invalidateEntity(entityId) {
    for (const key of this.#cache.keys()) {
      if (key.startsWith(`${entityId}:`)) {
        this.#cache.delete(key);
      }
    }
  }
}
```

### 3. Event Coordination

**Event Flow**:
```
User creates character
  ↓
ANATOMY_GENERATION_STARTED
  ↓
Anatomy generation workflow executes
  ↓
ANATOMY_GENERATED (with socket index)
  ↓
Clothing service instantiates items
  ↓
CLOTHING_INSTANTIATED
```

Full implementation in `src/anatomy/workflows/anatomyGenerationWorkflow.js`.

---

## Testing Requirements

### Unit Tests

Test event publication and subscription:

```javascript
// tests/unit/anatomy/workflows/anatomyGenerationWorkflow.events.test.js
describe('AnatomyGenerationWorkflow - Events', () => {
  it('should publish ANATOMY_GENERATED event on completion', async () => {
    const eventBus = testBed.createMockEventBus();
    const workflow = testBed.createAnatomyGenerationWorkflow({ eventBus });

    await workflow.execute({ blueprintId: 'test:blueprint' });

    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ANATOMY_GENERATED',
      payload: expect.objectContaining({
        entityId: expect.any(String),
        socketIndex: expect.any(Object)
      })
    });
  });
});
```

### Integration Tests

Test full anatomy-to-clothing flow:

```javascript
// tests/integration/anatomy/clothingIntegration.test.js
describe('Anatomy-Clothing Integration', () => {
  it('should instantiate clothing after anatomy generation', async () => {
    const testBed = createTestBed();
    const eventBus = testBed.container.resolve('IEventBus');

    const clothingInstantiated = new Promise(resolve => {
      eventBus.on('CLOTHING_INSTANTIATED', resolve);
    });

    // Generate anatomy
    await testBed.generateAnatomy({ blueprintId: 'anatomy:humanoid_body' });

    // Wait for clothing instantiation
    const event = await clothingInstantiated;
    expect(event.payload.entityId).toBeDefined();
  });
});
```

---

## Acceptance Criteria

- [ ] ANATOMY_GENERATED event published on completion
- [ ] Clothing service subscribes to anatomy events
- [ ] Circular dependency eliminated
- [ ] SlotResolver simplified (no event subscriptions)
- [ ] Cache invalidation handled externally (see ANASYSREF-006)
- [ ] Event flow documented
- [ ] Unit tests for event publication
- [ ] Integration tests for full flow
- [ ] Existing tests still pass
- [ ] ESLint and TypeScript checks pass

---

## Risk Assessment

**Risk Level**: 🟡 **MEDIUM**

- Requires coordination across multiple services
- Event timing must be correct
- Cache invalidation strategy changes

**Mitigation**:
- Comprehensive integration tests
- Gradual rollout with feature flag
- Rollback plan available

---

## Dependencies

**Depends On**:
- ANASYSREF-001, ANASYSREF-002, ANASYSREF-003 (Phase 1 stability)

**Blocks**:
- ANASYSREF-006 (cache management can be simplified after decoupling)

---

## Definition of Done

- All acceptance criteria checked
- Code review approved
- All tests passing
- Event flow verified in development
- Documentation updated
- Merged to main branch

---

**Created**: 2025-11-03
**Status**: Not Started
