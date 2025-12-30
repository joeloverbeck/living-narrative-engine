/**
 * @file Integration tests for DepleteOxygenHandler
 *
 * Tests the DEPLETE_OXYGEN operation handler with production collaborators.
 * Targets uncovered lines: 175-196, 209-210, 218-224, 230-236, 241-247, 269, 280-283, 329-344
 */

import { describe, it, beforeEach, expect } from '@jest/globals';
import DepleteOxygenHandler from '../../../../src/logic/operationHandlers/depleteOxygenHandler.js';
import EventBus from '../../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import { GameDataRepository } from '../../../../src/data/gameDataRepository.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import { createEntityManagerAdapter } from '../../../common/entities/entityManagerTestFactory.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';
import { OXYGEN_DEPLETED_EVENT_ID } from '../../../../src/constants/eventIds.js';

// Component IDs matching production constants
const RESPIRATORY_ORGAN_COMPONENT_ID = 'breathing-states:respiratory_organ';
const ANATOMY_PART_COMPONENT_ID = 'anatomy:part';

/**
 * Test logger that captures log messages for assertions
 */
class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, context) {
    this.debugMessages.push({ message, context });
  }

  info(message, context) {
    this.infoMessages.push({ message, context });
  }

  warn(message, context) {
    this.warnMessages.push({ message, context });
  }

  error(message, error, context) {
    this.errorMessages.push({ message, error, context });
  }
}

const noopSchemaValidator = {
  isSchemaLoaded: () => true,
  validate: () => ({ isValid: true, errors: [] }),
};

const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

describe('DepleteOxygenHandler integration tests', () => {
  let logger;
  let eventBus;
  let safeEventDispatcher;
  let jsonLogicService;
  let entityManager;
  let handler;
  let receivedErrorEvents;
  let receivedOxygenDepletedEvents;

  const createExecutionContext = (contextOverrides = {}) => ({
    evaluationContext: {
      context: {
        ...contextOverrides,
      },
    },
    logger,
  });

  beforeEach(() => {
    logger = new TestLogger();
    eventBus = new EventBus({ logger });
    const registry = new InMemoryDataRegistry({ logger });
    const gameDataRepository = new GameDataRepository(registry, logger);

    const validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator: noopSchemaValidator,
      logger,
    });

    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    jsonLogicService = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });

    entityManager = createEntityManagerAdapter({
      logger,
      initialEntities: [],
    });

    // Capture system error events
    receivedErrorEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedErrorEvents.push(event);
    });

    // Capture oxygen depleted events
    receivedOxygenDepletedEvents = [];
    eventBus.subscribe(OXYGEN_DEPLETED_EVENT_ID, (event) => {
      receivedOxygenDepletedEvents.push(event);
    });

    handler = new DepleteOxygenHandler({
      logger,
      entityManager,
      safeEventDispatcher,
      jsonLogicService,
    });
  });

  // ===========================================================================
  // Test Helper Functions
  // ===========================================================================

  /**
   * Set up an actor entity with respiratory organs
   *
   * @param {string} actorId - Actor entity ID
   * @param {Array<{id: string, currentOxygen?: number, oxygenCapacity?: number, depletionRate?: number}>} organs - Array of organ configurations
   */
  const setupActorWithOrgans = (
    actorId,
    organs = [{ id: 'test:lung', currentOxygen: 100, oxygenCapacity: 100 }]
  ) => {
    // Create the actor entity
    entityManager.addEntity({
      id: actorId,
      components: {},
    });

    // Create organ entities owned by the actor
    for (const organ of organs) {
      entityManager.addEntity({
        id: organ.id,
        components: {
          [ANATOMY_PART_COMPONENT_ID]: {
            subType: 'lung',
            ownerEntityId: actorId,
          },
          [RESPIRATORY_ORGAN_COMPONENT_ID]: {
            respirationType: 'pulmonary',
            oxygenCapacity: organ.oxygenCapacity ?? 100,
            currentOxygen: organ.currentOxygen ?? 100,
            depletionRate: organ.depletionRate ?? 10,
          },
        },
      });
    }
  };

  /**
   * Set up an entity with no respiratory organs
   *
   * @param {string} actorId - Actor entity ID
   */
  const setupActorWithoutOrgans = (actorId) => {
    entityManager.addEntity({
      id: actorId,
      components: {},
    });
  };

  /**
   * Set up an organ entity that doesn't belong to any actor (no anatomy:part component)
   *
   * @param {string} organId - Organ entity ID
   */
  const setupOrphanOrgan = (organId) => {
    entityManager.addEntity({
      id: organId,
      components: {
        [RESPIRATORY_ORGAN_COMPONENT_ID]: {
          respirationType: 'pulmonary',
          oxygenCapacity: 100,
          currentOxygen: 100,
          depletionRate: 10,
        },
      },
    });
  };

  // ===========================================================================
  // Validation Error Tests (covers lines 209-210, 218-224, 230-236, 241-247, 269)
  // ===========================================================================

  describe('validation errors', () => {
    it('should dispatch error when params is null (covers lines 209-210)', async () => {
      const executionContext = createExecutionContext();

      await handler.execute(null, executionContext);
      await flushAsync();

      expect(receivedErrorEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should dispatch error when params is undefined (covers lines 209-210)', async () => {
      const executionContext = createExecutionContext();

      await handler.execute(undefined, executionContext);
      await flushAsync();

      expect(receivedErrorEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should dispatch error when entityId cannot be resolved (covers lines 218-224)', async () => {
      const executionContext = createExecutionContext();

      await handler.execute(
        {
          entityId: { var: 'nonexistent.path' },
        },
        executionContext
      );
      await flushAsync();

      expect(receivedErrorEvents.length).toBeGreaterThanOrEqual(1);
      const errorEvent = receivedErrorEvents.find((e) =>
        e.payload.message.includes('entityId is required')
      );
      expect(errorEvent).toBeDefined();
    });

    it('should dispatch error when entityId resolves to empty string (covers lines 218-224)', async () => {
      const executionContext = createExecutionContext({
        emptyValue: '',
      });

      await handler.execute(
        {
          entityId: { var: 'context.emptyValue' },
        },
        executionContext
      );
      await flushAsync();

      expect(receivedErrorEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should dispatch error when amount is provided but evaluates to null (covers lines 230-236)', async () => {
      setupActorWithOrgans('test:actor');
      const executionContext = createExecutionContext();

      await handler.execute(
        {
          entityId: 'test:actor',
          amount: { var: 'context.nonexistent' },
        },
        executionContext
      );
      await flushAsync();

      expect(receivedErrorEvents.length).toBeGreaterThanOrEqual(1);
      const errorEvent = receivedErrorEvents.find((e) =>
        e.payload.message.includes('amount must be a valid positive integer')
      );
      expect(errorEvent).toBeDefined();
    });

    it('should dispatch error when amount is zero (covers lines 241-247)', async () => {
      setupActorWithOrgans('test:actor');
      const executionContext = createExecutionContext();

      await handler.execute(
        {
          entityId: 'test:actor',
          amount: 0,
        },
        executionContext
      );
      await flushAsync();

      expect(receivedErrorEvents.length).toBeGreaterThanOrEqual(1);
      const errorEvent = receivedErrorEvents.find((e) =>
        e.payload.message.includes('amount must be at least 1')
      );
      expect(errorEvent).toBeDefined();
    });

    it('should dispatch error when amount is negative (covers lines 241-247)', async () => {
      setupActorWithOrgans('test:actor');
      const executionContext = createExecutionContext();

      await handler.execute(
        {
          entityId: 'test:actor',
          amount: -5,
        },
        executionContext
      );
      await flushAsync();

      expect(receivedErrorEvents.length).toBeGreaterThanOrEqual(1);
      const errorEvent = receivedErrorEvents.find((e) =>
        e.payload.message.includes('amount must be at least 1')
      );
      expect(errorEvent).toBeDefined();
    });
  });

  // ===========================================================================
  // Edge Case Tests (covers lines 175-196, 280-283)
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle entity with no respiratory organs gracefully (covers lines 280-283)', async () => {
      setupActorWithoutOrgans('test:actor');
      const executionContext = createExecutionContext();

      await handler.execute(
        {
          entityId: 'test:actor',
          amount: 10,
        },
        executionContext
      );
      await flushAsync();

      // Should not dispatch error - just returns early with debug log
      expect(receivedErrorEvents).toHaveLength(0);
      expect(receivedOxygenDepletedEvents).toHaveLength(0);

      // Should log debug message
      const debugMsg = logger.debugMessages.find((msg) =>
        msg.message.includes('has no respiratory organs')
      );
      expect(debugMsg).toBeDefined();
    });

    it('should find organs via anatomy:part ownership check (covers lines 175-196)', async () => {
      // Set up actor with organ that has correct ownership
      setupActorWithOrgans('test:actor', [
        { id: 'test:lung1', currentOxygen: 100 },
      ]);
      const executionContext = createExecutionContext();

      await handler.execute(
        {
          entityId: 'test:actor',
          amount: 10,
        },
        executionContext
      );
      await flushAsync();

      // Verify oxygen was depleted
      const organData = entityManager.getComponentData(
        'test:lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      expect(organData.currentOxygen).toBe(90);
    });

    it('should not deplete oxygen from organs without matching ownership (covers lines 175-196)', async () => {
      // Set up actor
      setupActorWithoutOrgans('test:actor');

      // Set up orphan organ (no anatomy:part component)
      setupOrphanOrgan('test:orphan-lung');

      const executionContext = createExecutionContext();

      await handler.execute(
        {
          entityId: 'test:actor',
          amount: 10,
        },
        executionContext
      );
      await flushAsync();

      // Orphan organ should be unchanged
      const organData = entityManager.getComponentData(
        'test:orphan-lung',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      expect(organData.currentOxygen).toBe(100);
    });

    it('should not deplete oxygen from organs owned by different entity (covers lines 175-196)', async () => {
      // Set up two actors, each with their own organ
      setupActorWithOrgans('test:actor1', [
        { id: 'test:lung1', currentOxygen: 100 },
      ]);
      setupActorWithOrgans('test:actor2', [
        { id: 'test:lung2', currentOxygen: 100 },
      ]);

      const executionContext = createExecutionContext();

      // Deplete only actor1's oxygen
      await handler.execute(
        {
          entityId: 'test:actor1',
          amount: 50,
        },
        executionContext
      );
      await flushAsync();

      // Actor1's lung should be depleted
      const lung1Data = entityManager.getComponentData(
        'test:lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      expect(lung1Data.currentOxygen).toBe(50);

      // Actor2's lung should be unchanged
      const lung2Data = entityManager.getComponentData(
        'test:lung2',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      expect(lung2Data.currentOxygen).toBe(100);
    });
  });

  // ===========================================================================
  // Oxygen Depletion Event Tests (covers lines 329-344)
  // ===========================================================================

  describe('oxygen depleted event', () => {
    it('should dispatch oxygen_depleted event when oxygen reaches zero (covers lines 329-344)', async () => {
      // Set up actor with organ at low oxygen
      setupActorWithOrgans('test:actor', [
        { id: 'test:lung', currentOxygen: 5, oxygenCapacity: 100 },
      ]);
      const executionContext = createExecutionContext();

      // Deplete remaining oxygen
      await handler.execute(
        {
          entityId: 'test:actor',
          amount: 10,
        },
        executionContext
      );
      await flushAsync();

      // Verify oxygen is at zero
      const organData = entityManager.getComponentData(
        'test:lung',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      expect(organData.currentOxygen).toBe(0);

      // Verify event was dispatched
      expect(receivedOxygenDepletedEvents).toHaveLength(1);
      const event = receivedOxygenDepletedEvents[0];
      expect(event.payload.entityId).toBe('test:actor');
      expect(event.payload.organCount).toBe(1);
      expect(event.payload.depletionResults).toHaveLength(1);
      expect(event.payload.depletionResults[0].newOxygen).toBe(0);
      expect(event.payload.timestamp).toBeDefined();
    });

    it('should dispatch oxygen_depleted event when all organs reach zero (covers lines 329-344)', async () => {
      // Set up actor with multiple organs at low oxygen
      setupActorWithOrgans('test:actor', [
        { id: 'test:lung-left', currentOxygen: 3, oxygenCapacity: 100 },
        { id: 'test:lung-right', currentOxygen: 5, oxygenCapacity: 100 },
      ]);
      const executionContext = createExecutionContext();

      // Deplete all oxygen
      await handler.execute(
        {
          entityId: 'test:actor',
          amount: 10,
        },
        executionContext
      );
      await flushAsync();

      // Verify both organs are at zero
      const leftLungData = entityManager.getComponentData(
        'test:lung-left',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      const rightLungData = entityManager.getComponentData(
        'test:lung-right',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      expect(leftLungData.currentOxygen).toBe(0);
      expect(rightLungData.currentOxygen).toBe(0);

      // Verify event was dispatched with correct payload
      expect(receivedOxygenDepletedEvents).toHaveLength(1);
      const event = receivedOxygenDepletedEvents[0];
      expect(event.payload.entityId).toBe('test:actor');
      expect(event.payload.organCount).toBe(2);
      expect(event.payload.depletionResults).toHaveLength(2);
    });

    it('should NOT dispatch oxygen_depleted event when some oxygen remains', async () => {
      setupActorWithOrgans('test:actor', [
        { id: 'test:lung', currentOxygen: 100 },
      ]);
      const executionContext = createExecutionContext();

      await handler.execute(
        {
          entityId: 'test:actor',
          amount: 50,
        },
        executionContext
      );
      await flushAsync();

      // Verify oxygen is not zero
      const organData = entityManager.getComponentData(
        'test:lung',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      expect(organData.currentOxygen).toBe(50);

      // Should NOT dispatch event
      expect(receivedOxygenDepletedEvents).toHaveLength(0);
    });

    it('should NOT dispatch event when one organ has oxygen remaining (multi-organ)', async () => {
      setupActorWithOrgans('test:actor', [
        { id: 'test:lung-left', currentOxygen: 5 },
        { id: 'test:lung-right', currentOxygen: 100 },
      ]);
      const executionContext = createExecutionContext();

      await handler.execute(
        {
          entityId: 'test:actor',
          amount: 10,
        },
        executionContext
      );
      await flushAsync();

      // Left lung is at 0, right lung is at 90
      const leftData = entityManager.getComponentData(
        'test:lung-left',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      const rightData = entityManager.getComponentData(
        'test:lung-right',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      expect(leftData.currentOxygen).toBe(0);
      expect(rightData.currentOxygen).toBe(90);

      // Total oxygen = 90, so event should NOT dispatch
      expect(receivedOxygenDepletedEvents).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Happy Path Tests (additional coverage for depletionRate fallback)
  // ===========================================================================

  describe('happy path', () => {
    it('should use organ depletionRate when amount is not provided', async () => {
      setupActorWithOrgans('test:actor', [
        {
          id: 'test:lung',
          currentOxygen: 100,
          oxygenCapacity: 100,
          depletionRate: 15,
        },
      ]);
      const executionContext = createExecutionContext();

      await handler.execute(
        {
          entityId: 'test:actor',
          // No amount provided - should use depletionRate
        },
        executionContext
      );
      await flushAsync();

      const organData = entityManager.getComponentData(
        'test:lung',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      // Should deplete by depletionRate (15)
      expect(organData.currentOxygen).toBe(85);
    });

    it('should resolve entityId from JSON Logic expression', async () => {
      setupActorWithOrgans('test:actor', [
        { id: 'test:lung', currentOxygen: 100 },
      ]);
      const executionContext = createExecutionContext({
        targetEntity: 'test:actor',
      });

      await handler.execute(
        {
          entityId: { var: 'evaluationContext.context.targetEntity' },
          amount: 20,
        },
        executionContext
      );
      await flushAsync();

      const organData = entityManager.getComponentData(
        'test:lung',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      expect(organData.currentOxygen).toBe(80);
    });

    it('should resolve amount from JSON Logic expression', async () => {
      setupActorWithOrgans('test:actor', [
        { id: 'test:lung', currentOxygen: 100 },
      ]);
      const executionContext = createExecutionContext({
        depletionAmount: 25,
      });

      await handler.execute(
        {
          entityId: 'test:actor',
          amount: { var: 'evaluationContext.context.depletionAmount' },
        },
        executionContext
      );
      await flushAsync();

      const organData = entityManager.getComponentData(
        'test:lung',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      expect(organData.currentOxygen).toBe(75);
    });

    it('should clamp oxygen to minimum of 0', async () => {
      setupActorWithOrgans('test:actor', [
        { id: 'test:lung', currentOxygen: 10 },
      ]);
      const executionContext = createExecutionContext();

      await handler.execute(
        {
          entityId: 'test:actor',
          amount: 100, // More than current oxygen
        },
        executionContext
      );
      await flushAsync();

      const organData = entityManager.getComponentData(
        'test:lung',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      expect(organData.currentOxygen).toBe(0);
    });

    it('should resolve entityId from JSON Logic expression returning object with id property (covers lines 109-112)', async () => {
      setupActorWithOrgans('test:actor', [
        { id: 'test:lung', currentOxygen: 100 },
      ]);
      const executionContext = createExecutionContext({
        targetEntityObject: { id: 'test:actor' },
      });

      await handler.execute(
        {
          entityId: { var: 'evaluationContext.context.targetEntityObject' },
          amount: 30,
        },
        executionContext
      );
      await flushAsync();

      const organData = entityManager.getComponentData(
        'test:lung',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      expect(organData.currentOxygen).toBe(70);
    });

    it('should resolve entityId from JSON Logic expression returning object with entityId property (covers lines 109-112)', async () => {
      setupActorWithOrgans('test:actor', [
        { id: 'test:lung', currentOxygen: 100 },
      ]);
      const executionContext = createExecutionContext({
        targetEntityObject: { entityId: 'test:actor' },
      });

      await handler.execute(
        {
          entityId: { var: 'evaluationContext.context.targetEntityObject' },
          amount: 35,
        },
        executionContext
      );
      await flushAsync();

      const organData = entityManager.getComponentData(
        'test:lung',
        RESPIRATORY_ORGAN_COMPONENT_ID
      );
      expect(organData.currentOxygen).toBe(65);
    });
  });
});
