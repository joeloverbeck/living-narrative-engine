# ANASYSREF-004: Decouple Clothing System from Anatomy

**Priority**: 🟢 **RECOMMENDED**
**Phase**: 2 - Structural Improvements
**Estimated Effort**: 20-30 hours
**Dependencies**: ANASYSREF-002 (See Dependencies section for clarification)
**Report Reference**: `reports/anatomy-system-refactoring-analysis.md` (Section: Phase 2.1)
**Last Validated**: 2025-11-05

---

## ⚠️ Implementation Notes (Updated 2025-11-05)

**Critical Codebase Facts Verified**:
1. **EventBus Interface**: Uses `subscribe(eventName, listener)` not `.on()`
2. **EventBus.dispatch**: Takes `(eventName, payload)` as separate arguments, not a single object
3. **AnatomySocketIndex**: Method is `getEntitySockets(entityId)` not `getAllSockets()`
4. **AnatomyGenerationWorkflow**: Currently does NOT have eventBus or socketIndex dependencies (will need to be added)
5. **ClothingInstantiationService**: Location is `/src/clothing/services/clothingInstantiationService.js`
6. **Test Paths**: Correct directories exist for unit and integration tests

**Key Changes Required**:
- Add `eventBus` dependency to AnatomyGenerationWorkflow constructor
- Add `socketIndex` dependency to AnatomyGenerationWorkflow constructor
- Implement event publication in workflow's `generate()` method
- Update ClothingInstantiationService to subscribe to ANATOMY_GENERATED events
- Use correct EventBus method names throughout

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
// NOTE: This workflow currently does NOT have eventBus or socketIndex dependencies
// These will need to be added to the constructor during implementation
async execute() {
  // ... existing anatomy generation logic

  // Publish event when anatomy is ready
  // NOTE: EventBus.dispatch takes (eventName, payload) not a single object
  this.#eventBus.dispatch('ANATOMY_GENERATED', {
    entityId,
    blueprintId: blueprint.id,
    // NOTE: AnatomySocketIndex uses getEntitySockets(entityId), not getAllSockets()
    sockets: await this.#socketIndex.getEntitySockets(entityId),
    timestamp: Date.now(),
    bodyParts: result.entities.map(e => e.id)
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
  // NOTE: EventBus uses 'subscribe', not 'on'
  this.#eventBus.subscribe('ANATOMY_GENERATED', this.#handleAnatomyGenerated.bind(this));
}

async #handleAnatomyGenerated(event) {
  const { entityId, socketIndex } = event.payload;

  this.#logger.info(`Anatomy generated for ${entityId}, instantiating clothing`);

  try {
    await this.#clothingService.instantiateDefaultClothing(entityId, socketIndex);
  } catch (err) {
    this.#logger.error(`Failed to instantiate clothing for ${entityId}`, err);
    this.#eventBus.dispatch('CLOTHING_INSTANTIATION_FAILED', {
      entityId,
      error: err.message
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

**File Locations** (Verified 2025-11-05):
- Anatomy Workflow: `/src/anatomy/workflows/anatomyGenerationWorkflow.js` ✓
- Clothing Service: `/src/clothing/services/clothingInstantiationService.js` ✓
- SlotResolver: `/src/anatomy/integration/SlotResolver.js` ✓
- EventBus: `/src/events/eventBus.js` ✓
- SocketIndex: `/src/anatomy/services/anatomySocketIndex.js` ✓

---

## Testing Requirements

### Unit Tests

Test event publication and subscription:

```javascript
// tests/unit/anatomy/workflows/anatomyGenerationWorkflow.events.test.js
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AnatomyGenerationWorkflow } from '../../../../src/anatomy/workflows/anatomyGenerationWorkflow.js';

describe('AnatomyGenerationWorkflow - Events', () => {
  let mockEventBus;
  let mockSocketIndex;
  let workflow;

  beforeEach(() => {
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    mockSocketIndex = {
      getEntitySockets: jest.fn().mockResolvedValue([
        { id: 'socket1', orientation: 'neutral' }
      ]),
    };

    // Note: Actual constructor has different dependencies
    // This is a simplified example showing the new dependencies needed
    workflow = new AnatomyGenerationWorkflow({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      bodyBlueprintFactory: mockBodyBlueprintFactory,
      eventBus: mockEventBus,  // NEW DEPENDENCY
      socketIndex: mockSocketIndex,  // NEW DEPENDENCY
    });
  });

  it('should publish ANATOMY_GENERATED event on completion', async () => {
    // Setup test...

    await workflow.generate('test-blueprint', 'test-recipe', { ownerId: 'test-entity' });

    // EventBus.dispatch signature is (eventName, payload)
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      'ANATOMY_GENERATED',
      expect.objectContaining({
        entityId: expect.any(String),
        sockets: expect.any(Array)
      })
    );
  });
});
```

### Integration Tests

Test full anatomy-to-clothing flow:

```javascript
// tests/integration/anatomy/clothingIntegration.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Anatomy-Clothing Integration', () => {
  let testBed;
  let eventBus;

  beforeEach(() => {
    testBed = createTestBed();
    // Note: Actual integration will require full container setup
    // This assumes eventBus is available from DI container
    eventBus = testBed.mockValidatedEventDispatcher;
  });

  it('should instantiate clothing after anatomy generation', async () => {
    // Track when clothing instantiation event is dispatched
    const clothingInstantiated = new Promise(resolve => {
      // EventBus uses 'subscribe', not 'on'
      eventBus.subscribe('CLOTHING_INSTANTIATED', resolve);
    });

    // Generate anatomy (implementation needed)
    // This will trigger ANATOMY_GENERATED event
    // which should trigger clothing instantiation
    // await anatomyGenerationService.generate(...);

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
- ANASYSREF-002 (Add pattern validation warnings)
- **NOTE**: ANASYSREF-001 and ANASYSREF-003 referenced but do not exist in workflow directory
- Recommend clarifying actual Phase 1 dependencies before implementation

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
