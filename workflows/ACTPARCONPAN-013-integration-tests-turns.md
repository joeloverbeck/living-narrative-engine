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
- [ ] Import test utilities and turn order components
- [ ] Set up real entity manager and turn queue
- [ ] Create test bed for turn system integration

### Turn Skip Tests
- [ ] Test turn queue skips actor with `participating: false`
- [ ] Test turn queue processes actor with `participating: true`
- [ ] Test turn queue defaults to `true` when component missing
- [ ] Test multiple actors with mixed participation states
- [ ] Test turn queue advances correctly after skipping

### Edge Case Tests
- [ ] Test all actors non-participating scenario
- [ ] Test `getNextActor()` returns null when no actors participating
- [ ] Test mixed participation state: some true, some false, some undefined
- [ ] Test single participating actor among many disabled
- [ ] Test participation toggle mid-turn-cycle

### Turn Progression Tests
- [ ] Test full turn cycle with participation filtering
- [ ] Test turn order maintained after skipping actors
- [ ] Test initiative/priority preserved with participation filter
- [ ] Test turn wrapping (end of queue) with disabled actors

### LLM API Call Prevention Tests
- [ ] Test LLM service not called for non-participating actors
- [ ] Mock LLM service and verify call count
- [ ] Test participating actors still trigger LLM calls
- [ ] Test cost optimization: disabled actors reduce API calls

### Infinite Loop Prevention Tests
- [ ] Test max attempts limit prevents infinite loop
- [ ] Test safety check activates when all actors disabled
- [ ] Test warning logged when no participating actors found

## Files Created
- `tests/integration/turns/participationTurnOrder.test.js`

## Test Template Structure
```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { ACTOR_COMPONENT_ID, PARTICIPATION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('Turn Order - Participation Integration', () => {
  let testBed;
  let entityManager;
  let turnQueue; // Actual turn queue instance
  let mockLLMService;

  beforeEach(() => {
    testBed = createTestBed();
    entityManager = testBed.entityManager;
    turnQueue = testBed.turnQueue; // Or resolve from DI container

    // Mock LLM service to verify calls
    mockLLMService = {
      generateResponse: jest.fn(() => Promise.resolve({ content: 'test response' })),
    };
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  function createTestActor(id, name, participating) {
    const actor = testBed.createEntity(id);
    entityManager.addComponent(actor, {
      id: ACTOR_COMPONENT_ID,
      dataSchema: { name },
    });

    if (participating !== undefined) {
      entityManager.addComponent(actor, {
        id: PARTICIPATION_COMPONENT_ID,
        dataSchema: { participating },
      });
    }

    return actor;
  }

  describe('Turn Skip Behavior', () => {
    it('should skip actors with participating: false', () => {
      const actor1 = createTestActor('actor1', 'Hero', true);
      const actor2 = createTestActor('actor2', 'Villain', false);
      const actor3 = createTestActor('actor3', 'Sidekick', true);

      // Add to turn queue
      turnQueue.addActor(actor1);
      turnQueue.addActor(actor2);
      turnQueue.addActor(actor3);

      // Get next actors
      const first = turnQueue.getNextActor();
      expect(first).toBe(actor1);

      const second = turnQueue.getNextActor();
      expect(second).toBe(actor3); // actor2 skipped

      const third = turnQueue.getNextActor();
      expect(third).toBe(actor1); // Wrapped around
    });

    it('should process actors with participating: true normally', () => {
      const actor1 = createTestActor('actor1', 'Hero', true);
      const actor2 = createTestActor('actor2', 'Ally', true);

      turnQueue.addActor(actor1);
      turnQueue.addActor(actor2);

      const first = turnQueue.getNextActor();
      expect(first).toBe(actor1);

      const second = turnQueue.getNextActor();
      expect(second).toBe(actor2);
    });

    it('should default to participating: true when component missing', () => {
      const actor1 = createTestActor('actor1', 'Hero', undefined); // No component

      turnQueue.addActor(actor1);

      const next = turnQueue.getNextActor();
      expect(next).toBe(actor1); // Not skipped
    });
  });

  describe('Edge Cases', () => {
    it('should return null when all actors are non-participating', () => {
      const actor1 = createTestActor('actor1', 'Disabled1', false);
      const actor2 = createTestActor('actor2', 'Disabled2', false);

      turnQueue.addActor(actor1);
      turnQueue.addActor(actor2);

      const next = turnQueue.getNextActor();
      expect(next).toBeNull();
    });

    it('should handle empty turn queue gracefully', () => {
      const next = turnQueue.getNextActor();
      expect(next).toBeNull();
    });

    it('should maintain turn order with mixed participation states', () => {
      const actor1 = createTestActor('actor1', 'Active', true);
      const actor2 = createTestActor('actor2', 'Inactive', false);
      const actor3 = createTestActor('actor3', 'NoComponent', undefined);
      const actor4 = createTestActor('actor4', 'Active2', true);

      turnQueue.addActor(actor1);
      turnQueue.addActor(actor2);
      turnQueue.addActor(actor3);
      turnQueue.addActor(actor4);

      expect(turnQueue.getNextActor()).toBe(actor1);
      expect(turnQueue.getNextActor()).toBe(actor3); // actor2 skipped
      expect(turnQueue.getNextActor()).toBe(actor4);
    });
  });

  describe('LLM API Call Prevention', () => {
    it('should not call LLM service for non-participating actors', async () => {
      const actor1 = createTestActor('actor1', 'Hero', true);
      const actor2 = createTestActor('actor2', 'Villain', false);

      turnQueue.addActor(actor1);
      turnQueue.addActor(actor2);

      // Process full turn cycle
      await testBed.processTurn(mockLLMService); // actor1
      await testBed.processTurn(mockLLMService); // actor2 skipped, back to actor1

      // LLM service should only be called for actor1 (twice)
      expect(mockLLMService.generateResponse).toHaveBeenCalledTimes(2);
    });

    it('should still call LLM service for participating actors', async () => {
      const actor1 = createTestActor('actor1', 'Hero', true);

      turnQueue.addActor(actor1);

      await testBed.processTurn(mockLLMService);

      expect(mockLLMService.generateResponse).toHaveBeenCalledTimes(1);
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
- Use real turn queue implementation for accurate integration testing
- Mock LLM service to verify API call prevention
- Test both happy path and edge cases thoroughly
- Verify backward compatibility (actors without participation component)
- Test turn wrapping and queue exhaustion scenarios
