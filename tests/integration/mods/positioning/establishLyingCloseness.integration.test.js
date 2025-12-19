/**
 * @file Integration tests for EstablishLyingClosenessHandler
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import { createEntityInstance } from '../../../common/entities/entityFactories.js';
import EstablishLyingClosenessHandler from '../../../../src/logic/operationHandlers/establishLyingClosenessHandler.js';
import * as closenessCircleService from '../../../../src/logic/services/closenessCircleService.js';
import EventBus from '../../../../src/events/eventBus.js';

describe('EstablishLyingClosenessHandler - Integration', () => {
  let handler;
  let entityManager;
  let eventBus;
  let logger;
  let executionContext;

  beforeEach(() => {
    // Create mock logger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create real services
    entityManager = new SimpleEntityManager();
    eventBus = new EventBus({ logger });

    // Create mock safeEventDispatcher that adapts to eventBus
    const safeEventDispatcher = {
      dispatch: (typeOrEvent, payload) => {
        // If called with two arguments, create event object
        if (payload !== undefined) {
          eventBus.dispatch({ type: typeOrEvent, payload });
        } else {
          // If called with one argument, pass through
          eventBus.dispatch(typeOrEvent);
        }
      },
    };

    // Create handler with dependencies
    handler = new EstablishLyingClosenessHandler({
      logger,
      entityManager,
      safeEventDispatcher,
      closenessCircleService,
    });

    // Setup execution context
    executionContext = {
      evaluationContext: {
        context: {},
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Workflow Integration', () => {
    it('should establish closeness between two actors lying on same bed', async () => {
      // Setup: Create bed entity
      const bed = createEntityInstance({
        instanceId: 'bed:1',
        baseComponents: {
          'lying:allows_lying_on': {},
        },
      });
      entityManager.addEntity(bed);

      // Create actors
      const alice = createEntityInstance({
        instanceId: 'test:alice',
        baseComponents: {
          'core:actor': { isPlayerControlled: false },
          'positioning:closeness': { partners: [] },
          'core:movement': { locked: false },
          'positioning:lying_down': { furniture_id: 'bed:1' }, // Already lying
        },
      });
      entityManager.addEntity(alice);

      const bob = createEntityInstance({
        instanceId: 'test:bob',
        baseComponents: {
          'core:actor': { isPlayerControlled: false },
          'positioning:closeness': { partners: [] },
          'core:movement': { locked: false },
          'positioning:lying_down': { furniture_id: 'bed:1' }, // Just lay down
        },
      });
      entityManager.addEntity(bob);

      // Act: Execute handler (Bob just lay down)
      const result = await handler.execute(
        {
          furniture_id: 'bed:1',
          actor_id: 'test:bob',
        },
        executionContext
      );

      // Assert: Handler should complete and return a result object
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.otherLyingActors).toEqual(['test:alice']);

      const aliceCloseness = entityManager.getComponentData(
        'test:alice',
        'positioning:closeness'
      );
      const bobCloseness = entityManager.getComponentData(
        'test:bob',
        'positioning:closeness'
      );

      expect(aliceCloseness.partners).toContain('test:bob');
      expect(bobCloseness.partners).toContain('test:alice');

      // Movement locks should be set
      const aliceLock = entityManager.getComponentData(
        'test:alice',
        'core:movement'
      );
      const bobLock = entityManager.getComponentData(
        'test:bob',
        'core:movement'
      );

      expect(aliceLock.locked).toBe(true);
      expect(bobLock.locked).toBe(true);
    });

    it('should establish closeness between three actors on same bed', async () => {
      // Setup: Create bed entity
      const bed = createEntityInstance({
        instanceId: 'bed:1',
        baseComponents: {
          'lying:allows_lying_on': {},
        },
      });
      entityManager.addEntity(bed);

      // Create actors
      const alice = createEntityInstance({
        instanceId: 'test:alice',
        baseComponents: {
          'core:actor': { isPlayerControlled: false },
          'positioning:closeness': { partners: [] },
          'core:movement': { locked: false },
          'positioning:lying_down': { furniture_id: 'bed:1' },
        },
      });
      entityManager.addEntity(alice);

      const bob = createEntityInstance({
        instanceId: 'test:bob',
        baseComponents: {
          'core:actor': { isPlayerControlled: false },
          'positioning:closeness': { partners: [] },
          'core:movement': { locked: false },
          'positioning:lying_down': { furniture_id: 'bed:1' },
        },
      });
      entityManager.addEntity(bob);

      const charlie = createEntityInstance({
        instanceId: 'test:charlie',
        baseComponents: {
          'core:actor': { isPlayerControlled: false },
          'positioning:closeness': { partners: [] },
          'core:movement': { locked: false },
          'positioning:lying_down': { furniture_id: 'bed:1' },
        },
      });
      entityManager.addEntity(charlie);

      // Act: Execute handler (Charlie just lay down)
      const result = await handler.execute(
        {
          furniture_id: 'bed:1',
          actor_id: 'test:charlie',
        },
        executionContext
      );

      // Assert: Charlie should be connected to both Alice and Bob
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.otherLyingActors).toHaveLength(2);
      expect(result.otherLyingActors).toContain('test:alice');
      expect(result.otherLyingActors).toContain('test:bob');

      const charlieCloseness = entityManager.getComponentData(
        'test:charlie',
        'positioning:closeness'
      );

      expect(charlieCloseness.partners).toContain('test:alice');
      expect(charlieCloseness.partners).toContain('test:bob');
    });

    it('should not establish closeness with actors on different beds', async () => {
      // Setup: Create two beds
      const bed1 = createEntityInstance({
        instanceId: 'bed:1',
        baseComponents: {
          'lying:allows_lying_on': {},
        },
      });
      entityManager.addEntity(bed1);

      const bed2 = createEntityInstance({
        instanceId: 'bed:2',
        baseComponents: {
          'lying:allows_lying_on': {},
        },
      });
      entityManager.addEntity(bed2);

      // Create actors on different beds
      const alice = createEntityInstance({
        instanceId: 'test:alice',
        baseComponents: {
          'core:actor': { isPlayerControlled: false },
          'positioning:closeness': { partners: [] },
          'core:movement': { locked: false },
          'positioning:lying_down': { furniture_id: 'bed:1' },
        },
      });
      entityManager.addEntity(alice);

      const bob = createEntityInstance({
        instanceId: 'test:bob',
        baseComponents: {
          'core:actor': { isPlayerControlled: false },
          'positioning:closeness': { partners: [] },
          'core:movement': { locked: false },
          'positioning:lying_down': { furniture_id: 'bed:2' },
        },
      });
      entityManager.addEntity(bob);

      // Act: Execute handler (Bob just lay down on bed:2)
      const result = await handler.execute(
        {
          furniture_id: 'bed:2',
          actor_id: 'test:bob',
        },
        executionContext
      );

      // Assert: No closeness should be established
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.otherLyingActors).toHaveLength(0);

      const aliceCloseness = entityManager.getComponentData(
        'test:alice',
        'positioning:closeness'
      );
      const bobCloseness = entityManager.getComponentData(
        'test:bob',
        'positioning:closeness'
      );

      expect(aliceCloseness.partners).not.toContain('test:bob');
      expect(bobCloseness.partners).not.toContain('test:alice');
    });

    it('should handle when actor is first to lie on bed', async () => {
      // Setup: Create bed entity
      const bed = createEntityInstance({
        instanceId: 'bed:1',
        baseComponents: {
          'lying:allows_lying_on': {},
        },
      });
      entityManager.addEntity(bed);

      // Create single actor
      const alice = createEntityInstance({
        instanceId: 'test:alice',
        baseComponents: {
          'core:actor': { isPlayerControlled: false },
          'positioning:closeness': { partners: [] },
          'core:movement': { locked: false },
          'positioning:lying_down': { furniture_id: 'bed:1' },
        },
      });
      entityManager.addEntity(alice);

      // Act: Execute handler (Alice is first)
      const result = await handler.execute(
        {
          furniture_id: 'bed:1',
          actor_id: 'test:alice',
        },
        executionContext
      );

      // Assert: No closeness established but operation succeeds
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.otherLyingActors).toHaveLength(0);

      const aliceCloseness = entityManager.getComponentData(
        'test:alice',
        'positioning:closeness'
      );

      expect(aliceCloseness.partners).toHaveLength(0);
    });

    it('should merge existing closeness circles', async () => {
      // Setup: Create bed entity
      const bed = createEntityInstance({
        instanceId: 'bed:1',
        baseComponents: {
          'lying:allows_lying_on': {},
        },
      });
      entityManager.addEntity(bed);

      // Create actors with existing closeness circles
      const alice = createEntityInstance({
        instanceId: 'test:alice',
        baseComponents: {
          'core:actor': { isPlayerControlled: false },
          'positioning:closeness': { partners: ['test:diane'] }, // Already close to diane
          'core:movement': { locked: false },
          'positioning:lying_down': { furniture_id: 'bed:1' },
        },
      });
      entityManager.addEntity(alice);

      const bob = createEntityInstance({
        instanceId: 'test:bob',
        baseComponents: {
          'core:actor': { isPlayerControlled: false },
          'positioning:closeness': { partners: [] },
          'core:movement': { locked: false },
          'positioning:lying_down': { furniture_id: 'bed:1' },
        },
      });
      entityManager.addEntity(bob);

      // Act: Execute handler (Bob just lay down)
      const result = await handler.execute(
        {
          furniture_id: 'bed:1',
          actor_id: 'test:bob',
        },
        executionContext
      );

      // Assert: Both Alice and Bob should have both partners
      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      const aliceCloseness = entityManager.getComponentData(
        'test:alice',
        'positioning:closeness'
      );
      const bobCloseness = entityManager.getComponentData(
        'test:bob',
        'positioning:closeness'
      );

      // Alice should have both diane and bob
      expect(aliceCloseness.partners).toContain('test:diane');
      expect(aliceCloseness.partners).toContain('test:bob');

      // Bob should have alice
      expect(bobCloseness.partners).toContain('test:alice');
    });
  });
});
