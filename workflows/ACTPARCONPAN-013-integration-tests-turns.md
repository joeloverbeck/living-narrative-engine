# ACTPARCONPAN-013: Turn Order Integration Tests

## Ticket Information
- **ID**: ACTPARCONPAN-013
- **Phase**: 4 - Quality Assurance
- **Estimated Time**: 2-3 hours
- **Complexity**: Medium
- **Dependencies**: ACTPARCONPAN-010, ACTPARCONPAN-011

## Scope
Create integration tests that verify the turn order system correctly skips non-participating actors and prevents LLM API calls for disabled actors.

## Detailed Tasks

### Test File Setup
- [ ] Create `tests/integration/turns/participationTurnOrder.test.js`
- [ ] Import `TurnOrderService` from `src/turns/order/turnOrderService.js`
- [ ] Import `TurnCycle` from `src/turns/turnCycle.js`
- [ ] Import `SimpleEntityManager` from `tests/common/entities/simpleEntityManager.js`
- [ ] Import mock factories from `tests/common/mockFactories/index.js`
- [ ] Import component IDs from `src/constants/componentIds.js`
- [ ] Set up real service instances (not mocked) for integration testing

### Turn Skip Tests
- [ ] Test `TurnCycle.nextActor()` skips actors with `participating: false`
- [ ] Test `TurnCycle.nextActor()` processes actors with `participating: true`
- [ ] Test defaults to `participating: true` when component missing
- [ ] Test multiple actors with mixed participation states
- [ ] Test turn progression continues correctly after skipping non-participating actors
- [ ] Use `TurnOrderService.startNewRound()` to initialize turn order

### Edge Case Tests
- [ ] Test all actors non-participating scenario
- [ ] Test `TurnCycle.nextActor()` returns null when no actors participating
- [ ] Verify warning is logged when no participating actors found
- [ ] Test mixed participation states: some true, some false, some without component
- [ ] Test single participating actor among many disabled
- [ ] Test empty turn queue (returns null gracefully)

### Turn Progression Tests
- [ ] Test full turn cycle with participation filtering via `TurnCycle`
- [ ] Test turn order maintained after skipping non-participating actors
- [ ] Verify actors are returned in correct order (FIFO round-robin)
- [ ] Test queue exhaustion (no automatic wrapping - returns null when empty)

### LLM API Call Prevention Tests
- [ ] Verify `TurnCycle.nextActor()` skips non-participating actors (preventing LLM calls)
- [ ] Test that only participating actors are returned from turn cycle
- [ ] Verify participation component data structure is correct
- [ ] Test actor list filtering: collect all returned actors and verify non-participating excluded
- [ ] Note: LLM calls happen at higher layer; this tests the filtering mechanism

### Infinite Loop Prevention Tests
- [ ] Verify `TurnCycle.nextActor()` has max attempts limit (50 or queue size)
- [ ] Test safety check prevents infinite loop when all actors disabled
- [ ] Verify warning is logged via `mockLogger.warn` when no participating actors found
- [ ] Test returns null (not infinite loop) when all actors non-participating

## Files Created
- `tests/integration/turns/participationTurnOrder.test.js`

## Test Template Structure
```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TurnOrderService } from '../../../src/turns/order/turnOrderService.js';
import TurnCycle from '../../../src/turns/turnCycle.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { createMockLogger } from '../../common/mockFactories/index.js';
import {
  ACTOR_COMPONENT_ID,
  NAME_COMPONENT_ID,
  PARTICIPATION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Turn Order - Participation Integration', () => {
  let turnOrderService;
  let turnCycle;
  let entityManager;
  let mockLogger;

  beforeEach(() => {
    // Create real service instances for integration testing
    mockLogger = createMockLogger();
    turnOrderService = new TurnOrderService({ logger: mockLogger });
    entityManager = new SimpleEntityManager();
    turnCycle = new TurnCycle(turnOrderService, entityManager, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to create a test actor with components
   * @param {string} id - Entity ID
   * @param {string} name - Actor name
   * @param {boolean|null} participating - Participation state (null = no component)
   * @returns {Promise<object>} Entity object with id
   */
  async function createTestActor(id, name, participating) {
    // Add actor component
    await entityManager.addComponent(id, ACTOR_COMPONENT_ID, {});
    await entityManager.addComponent(id, NAME_COMPONENT_ID, { text: name });

    // Add participation component if specified
    if (participating !== null && participating !== undefined) {
      await entityManager.addComponent(id, PARTICIPATION_COMPONENT_ID, {
        participating,
      });
    }

    // Return entity object (SimpleEntityManager returns { id })
    return { id };
  }

  describe('Turn Skip Behavior', () => {
    it('should skip actors with participating: false', async () => {
      const actor1 = await createTestActor('actor1', 'Hero', true);
      const actor2 = await createTestActor('actor2', 'Villain', false);
      const actor3 = await createTestActor('actor3', 'Sidekick', true);

      // Start round with all actors
      const entities = [actor1, actor2, actor3];
      turnOrderService.startNewRound(entities, 'round-robin');

      // Get next actors via TurnCycle (handles participation filtering)
      const first = await turnCycle.nextActor();
      expect(first?.id).toBe('actor1');

      const second = await turnCycle.nextActor();
      expect(second?.id).toBe('actor3'); // actor2 skipped

      const third = await turnCycle.nextActor();
      expect(third).toBeNull(); // Queue exhausted (no wrapping in TurnOrderService)
    });

    it('should process actors with participating: true normally', async () => {
      const actor1 = await createTestActor('actor1', 'Hero', true);
      const actor2 = await createTestActor('actor2', 'Ally', true);

      turnOrderService.startNewRound([actor1, actor2], 'round-robin');

      const first = await turnCycle.nextActor();
      expect(first?.id).toBe('actor1');

      const second = await turnCycle.nextActor();
      expect(second?.id).toBe('actor2');
    });

    it('should default to participating: true when component missing', async () => {
      const actor1 = await createTestActor('actor1', 'Hero', null); // No component

      turnOrderService.startNewRound([actor1], 'round-robin');

      const next = await turnCycle.nextActor();
      expect(next?.id).toBe('actor1'); // Not skipped (defaults to true)
    });
  });

  describe('Edge Cases', () => {
    it('should return null when all actors are non-participating', async () => {
      const actor1 = await createTestActor('actor1', 'Disabled1', false);
      const actor2 = await createTestActor('actor2', 'Disabled2', false);

      turnOrderService.startNewRound([actor1, actor2], 'round-robin');

      const next = await turnCycle.nextActor();
      expect(next).toBeNull();

      // Verify warning was logged about no participating actors
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No participating actors found')
      );
    });

    it('should handle empty turn queue gracefully', async () => {
      const next = await turnCycle.nextActor();
      expect(next).toBeNull();
    });

    it('should maintain turn order with mixed participation states', async () => {
      const actor1 = await createTestActor('actor1', 'Active', true);
      const actor2 = await createTestActor('actor2', 'Inactive', false);
      const actor3 = await createTestActor('actor3', 'NoComponent', null);
      const actor4 = await createTestActor('actor4', 'Active2', true);

      turnOrderService.startNewRound(
        [actor1, actor2, actor3, actor4],
        'round-robin'
      );

      const first = await turnCycle.nextActor();
      expect(first?.id).toBe('actor1');

      const second = await turnCycle.nextActor();
      expect(second?.id).toBe('actor3'); // actor2 skipped

      const third = await turnCycle.nextActor();
      expect(third?.id).toBe('actor4');
    });
  });

  describe('LLM API Call Prevention', () => {
    it('should verify turn cycle skips non-participating actors', async () => {
      const actor1 = await createTestActor('actor1', 'Hero', true);
      const actor2 = await createTestActor('actor2', 'Villain', false);
      const actor3 = await createTestActor('actor3', 'Sidekick', true);

      turnOrderService.startNewRound([actor1, actor2, actor3], 'round-robin');

      // Verify only participating actors are returned
      const turns = [];
      let actor = await turnCycle.nextActor();
      while (actor) {
        turns.push(actor.id);
        actor = await turnCycle.nextActor();
      }

      expect(turns).toEqual(['actor1', 'actor3']); // actor2 excluded
      expect(turns).not.toContain('actor2');
    });

    it('should verify participation component data structure', async () => {
      const actorId = 'actor1';
      await createTestActor(actorId, 'Hero', false);

      // Verify component data is stored correctly
      const participation = entityManager.getComponentData(
        actorId,
        PARTICIPATION_COMPONENT_ID
      );

      expect(participation).toEqual({ participating: false });
      expect(typeof participation.participating).toBe('boolean');
    });
  });

  // Add more test suites...
});
```

## Acceptance Criteria
- [ ] All turn order integration tests created and passing
- [ ] Tests verify turn skip behavior
- [ ] Tests verify edge cases (all disabled, empty queue)
- [ ] Tests verify LLM API calls prevented for disabled actors
- [ ] Tests verify turn order preserved with participation filter
- [ ] Tests verify infinite loop prevention
- [ ] Tests follow project conventions
- [ ] Tests run successfully with `npm run test:integration`

## Validation Steps
1. Run `npm run test:integration -- participationTurnOrder.test.js`
2. Verify all tests pass
3. Check LLM service mock verification
4. Run full integration suite: `npm run test:integration`
5. Manual test: Disable actors and observe turn skipping in real gameplay

## Notes
- **Use real implementations** for integration testing: `TurnOrderService`, `TurnCycle`, `SimpleEntityManager`
- **TurnCycle wraps TurnOrderService**: `TurnCycle.nextActor()` handles participation filtering
- **Component data structure**: `entityManager.addComponent(entityId, componentId, data)` - 3 parameters
- **Data access**: `entityManager.getComponentData(entityId, componentId)` returns data directly (no `dataSchema` wrapper)
- **Access pattern**: `data.participating` (not `data.dataSchema.participating`)
- **Default behavior**: Missing participation component defaults to `true` (backward compatibility)
- **Reference**: See `tests/integration/domUI/actorParticipationIntegration.test.js` for similar patterns
- **TurnOrderService API**: Uses `startNewRound(entities, strategy)`, `getNextEntity()`, not `addActor()`
- **No automatic wrapping**: Queue returns null when exhausted (no circular turn order)
