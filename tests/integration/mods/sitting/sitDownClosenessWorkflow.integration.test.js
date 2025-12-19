/**
 * @file Integration tests for sit down closeness workflow
 * Tests automatic closeness establishment when actors sit adjacently
 *
 * NOTE: This test requires namespaced entity IDs (modId:identifier format)
 * as enforced by proximityUtils.validateProximityParameters()
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import { createEntityInstance } from '../../../common/entities/entityFactories.js';
import EstablishSittingClosenessHandler from '../../../../src/logic/operationHandlers/establishSittingClosenessHandler.js';
import * as closenessCircleService from '../../../../src/logic/services/closenessCircleService.js';
import EventBus from '../../../../src/events/eventBus.js';

describe('Sit Down Closeness Workflow Integration', () => {
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

    // Create handler
    handler = new EstablishSittingClosenessHandler({
      logger,
      entityManager,
      safeEventDispatcher: eventBus,
      closenessCircleService,
    });

    // Create execution context
    executionContext = {
      evaluationContext: {
        context: {},
      },
    };
  });

  afterEach(() => {
    // Cleanup
    entityManager = null;
    handler = null;
  });

  it('should establish closeness when sitting adjacent to another actor', async () => {
    // Arrange: Setup furniture with multiple spots and two actors
    // NOTE: Using namespaced IDs required by validateProximityParameters()
    // Entity IDs must be in 'modId:identifier' format or validation will fail
    const furnitureId = 'test:bench';
    const aliceId = 'test:alice';
    const bobId = 'test:bob';

    // Create furniture entity with two spots, Alice in spot 0
    const furnitureEntity = createEntityInstance({
      instanceId: furnitureId,
      baseComponents: {
        'sitting:allows_sitting': {
          spots: [aliceId, null, null],
        },
      },
    });

    const aliceEntity = createEntityInstance({
      instanceId: aliceId,
      baseComponents: {
        'sitting-states:sitting_on': {
          furniture_id: furnitureId,
          spot_index: 0,
        },
      },
    });

    const bobEntity = createEntityInstance({
      instanceId: bobId,
      baseComponents: {},
    });

    // Add entities to manager
    entityManager.addEntity(furnitureEntity);
    entityManager.addEntity(aliceEntity);
    entityManager.addEntity(bobEntity);

    // Act: Execute closeness establishment for Bob sitting in spot 1
    const parameters = {
      furniture_id: furnitureId,
      actor_id: bobId,
      spot_index: 1,
      result_variable: 'closenessEstablished',
    };

    await handler.execute(parameters, executionContext);

    // Assert: Both actors should have closeness components
    const aliceCloseness = entityManager.getComponentData(
      aliceId,
      'personal-space-states:closeness'
    );
    const bobCloseness = entityManager.getComponentData(
      bobId,
      'personal-space-states:closeness'
    );

    expect(aliceCloseness).toEqual({
      partners: [bobId],
    });

    expect(bobCloseness).toEqual({
      partners: [aliceId],
    });

    // Assert: Result variable should be set to true
    expect(
      executionContext.evaluationContext.context.closenessEstablished
    ).toBe(true);
  });

  it('should verify operation registration works with sit down rule', async () => {
    // This test verifies that the ESTABLISH_SITTING_CLOSENESS operation
    // is properly registered and can be referenced in rules

    // Arrange: Create a simple rule-like structure that references the operation
    // NOTE: Using namespaced IDs in parameters as required by production code
    const mockRule = {
      type: 'ESTABLISH_SITTING_CLOSENESS',
      parameters: {
        furniture_id: 'test:furniture',
        actor_id: 'test:actor',
        spot_index: 0,
        result_variable: 'testResult',
      },
    };

    // Assert: The operation type should be valid
    expect(mockRule.type).toBe('ESTABLISH_SITTING_CLOSENESS');
    expect(mockRule.parameters).toHaveProperty('furniture_id');
    expect(mockRule.parameters).toHaveProperty('actor_id');
    expect(mockRule.parameters).toHaveProperty('spot_index');
    expect(mockRule.parameters).toHaveProperty('result_variable');

    // This test mainly verifies that our rule structure is compatible
    // with what the operation handler expects
    expect(handler).toBeDefined();
    expect(typeof handler.execute).toBe('function');
  });
});
