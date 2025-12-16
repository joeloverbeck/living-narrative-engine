import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// Core system components
import EventBus from '../../../src/events/eventBus.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import LockMouthEngagementHandler from '../../../src/logic/operationHandlers/lockMouthEngagementHandler.js';
import UnlockMouthEngagementHandler from '../../../src/logic/operationHandlers/unlockMouthEngagementHandler.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import { getMouthParts } from '../../../src/utils/mouthEngagementUtils.js';

// Test utilities
import { SimpleEntityManager } from '../../common/entities/index.js';
import { createMockLogger } from '../../common/mockFactories.js';

describe('Mouth Engagement - Anatomy Integration', () => {
  let eventBus;
  let entityManager;
  let operationInterpreter;
  let operationRegistry;
  let jsonLogicService;
  let logger;
  let mockBodyGraphService;
  let mockLightingStateService;

  beforeEach(() => {
    // Initialize core components
    logger = createMockLogger();
    eventBus = new EventBus({ logger });
    entityManager = new SimpleEntityManager([]);

    // Setup operation registry with handlers
    operationRegistry = new OperationRegistry({ logger });

    const lockHandler = new LockMouthEngagementHandler({
      logger,
      entityManager,
      safeEventDispatcher: eventBus,
    });
    operationRegistry.register('LOCK_MOUTH_ENGAGEMENT', (...args) =>
      lockHandler.execute(...args)
    );

    const unlockHandler = new UnlockMouthEngagementHandler({
      logger,
      entityManager,
      safeEventDispatcher: eventBus,
    });
    operationRegistry.register('UNLOCK_MOUTH_ENGAGEMENT', (...args) =>
      unlockHandler.execute(...args)
    );

    // Initialize operation interpreter
    operationInterpreter = new OperationInterpreter({
      logger,
      operationRegistry,
    });

    // Setup JSON Logic for condition evaluation
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    jsonLogicService = new JsonLogicEvaluationService({
      logger,
    });

    const customOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager,
      lightingStateService: mockLightingStateService,
    });

    customOperators.registerOperators(jsonLogicService);
  });

  afterEach(() => {
    // Cleanup if needed
  });

  test('should work with anatomy-based actors', async () => {
    // Create actor with anatomy system
    const actorId = 'test-actor-anatomy';
    await entityManager.createEntity(actorId);

    // Add anatomy with mouth (simulating humanoid_mouth entity)
    await entityManager.addComponent(actorId, 'anatomy:body', {
      body: {
        root: 'torso_1',
        parts: { mouth: 'mouth_1' },
      },
    });

    // Create mouth part entity with default components from humanoid_mouth
    await entityManager.createEntity('mouth_1');
    await entityManager.addComponent('mouth_1', 'anatomy:part', {
      subType: 'mouth',
    });
    await entityManager.addComponent('mouth_1', 'anatomy:sockets', {
      sockets: [
        {
          id: 'teeth',
          allowedTypes: ['teeth'],
          nameTpl: '{{type}}',
        },
      ],
    });
    await entityManager.addComponent('mouth_1', 'core:name', {
      text: 'mouth',
    });
    // This component would be added by default when entity definition is updated
    await entityManager.addComponent('mouth_1', 'core:mouth_engagement', {
      locked: false,
      forcedOverride: false,
    });

    // Get mouth parts using utility function
    const mouthParts = getMouthParts(entityManager, actorId);
    expect(mouthParts).toHaveLength(1);

    const mouth = mouthParts[0];
    expect(mouth.engagement).toEqual({
      locked: false,
      forcedOverride: false,
    });

    // Test locking
    const operation = {
      type: 'LOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actorId },
    };

    const context = {
      evaluationContext: { actor: { id: actorId } },
      entityManager,
      logger,
    };

    await operationInterpreter.execute(operation, context);

    // Verify locked
    const updatedMouthParts = getMouthParts(entityManager, actorId);
    expect(updatedMouthParts[0].engagement.locked).toBe(true);
  });

  test('should properly update mouth lock state for condition evaluation', async () => {
    const actorId = 'test-actor-condition';
    await entityManager.createEntity(actorId);

    // Add anatomy with mouth
    await entityManager.addComponent(actorId, 'anatomy:body', {
      body: {
        root: 'torso_1',
        parts: { mouth: 'mouth_1' },
      },
    });

    // Create mouth part with engagement component
    await entityManager.createEntity('mouth_1');
    await entityManager.addComponent('mouth_1', 'anatomy:part', {
      subType: 'mouth',
    });
    await entityManager.addComponent('mouth_1', 'core:mouth_engagement', {
      locked: false,
      forcedOverride: false,
    });

    // Initially the mouth should not be locked
    let mouthEngagement = entityManager.getComponentData(
      'mouth_1',
      'core:mouth_engagement'
    );
    expect(mouthEngagement.locked).toBe(false);

    // Lock mouth
    const lockOperation = {
      type: 'LOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actorId },
    };

    const context = {
      evaluationContext: { actor: { id: actorId } },
      entityManager,
      logger,
    };

    await operationInterpreter.execute(lockOperation, context);

    // Verify the mouth is actually locked
    mouthEngagement = entityManager.getComponentData(
      'mouth_1',
      'core:mouth_engagement'
    );
    expect(mouthEngagement.locked).toBe(true);

    // Unlock mouth
    const unlockOperation = {
      type: 'UNLOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actorId },
    };

    await operationInterpreter.execute(unlockOperation, context);

    // Verify the mouth is unlocked again
    mouthEngagement = entityManager.getComponentData(
      'mouth_1',
      'core:mouth_engagement'
    );
    expect(mouthEngagement.locked).toBe(false);
  });

  test('should handle unlock operation with anatomy mouths', async () => {
    const actorId = 'test-actor-unlock';
    await entityManager.createEntity(actorId);

    // Add anatomy with mouth
    await entityManager.addComponent(actorId, 'anatomy:body', {
      body: {
        root: 'torso_1',
        parts: { mouth: 'mouth_1' },
      },
    });

    // Create mouth part with engagement component already locked
    await entityManager.createEntity('mouth_1');
    await entityManager.addComponent('mouth_1', 'anatomy:part', {
      subType: 'mouth',
    });
    await entityManager.addComponent('mouth_1', 'core:mouth_engagement', {
      locked: true, // Start locked
      forcedOverride: false,
    });

    // Verify initially locked
    const initialMouthParts = getMouthParts(entityManager, actorId);
    expect(initialMouthParts[0].engagement.locked).toBe(true);

    // Test unlocking
    const operation = {
      type: 'UNLOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actorId },
    };

    const context = {
      evaluationContext: { actor: { id: actorId } },
      entityManager,
      logger,
    };

    await operationInterpreter.execute(operation, context);

    // Verify unlocked
    const updatedMouthParts = getMouthParts(entityManager, actorId);
    expect(updatedMouthParts[0].engagement.locked).toBe(false);
  });

  test('should preserve forcedOverride value during lock/unlock', async () => {
    const actorId = 'test-actor-preserve';
    await entityManager.createEntity(actorId);

    // Add anatomy with mouth
    await entityManager.addComponent(actorId, 'anatomy:body', {
      body: {
        root: 'torso_1',
        parts: { mouth: 'mouth_1' },
      },
    });

    // Create mouth part with forcedOverride set
    await entityManager.createEntity('mouth_1');
    await entityManager.addComponent('mouth_1', 'anatomy:part', {
      subType: 'mouth',
    });
    await entityManager.addComponent('mouth_1', 'core:mouth_engagement', {
      locked: false,
      forcedOverride: true, // This should be preserved
    });

    // Lock the mouth
    const lockOperation = {
      type: 'LOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actorId },
    };

    const context = {
      evaluationContext: { actor: { id: actorId } },
      entityManager,
      logger,
    };

    await operationInterpreter.execute(lockOperation, context);

    // Verify forcedOverride is preserved
    let mouthParts = getMouthParts(entityManager, actorId);
    expect(mouthParts[0].engagement.locked).toBe(true);
    expect(mouthParts[0].engagement.forcedOverride).toBe(true);

    // Unlock the mouth
    const unlockOperation = {
      type: 'UNLOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actorId },
    };

    await operationInterpreter.execute(unlockOperation, context);

    // Verify forcedOverride is still preserved
    mouthParts = getMouthParts(entityManager, actorId);
    expect(mouthParts[0].engagement.locked).toBe(false);
    expect(mouthParts[0].engagement.forcedOverride).toBe(true);
  });

  test('should handle entities with no mouths gracefully', async () => {
    const actorId = 'test-actor-no-mouth';
    await entityManager.createEntity(actorId);

    // Add anatomy without mouth parts
    await entityManager.addComponent(actorId, 'anatomy:body', {
      body: {
        root: 'torso_1',
        parts: {
          head: 'head_1',
          arm_left: 'arm_left_1',
        },
      },
    });

    // Create non-mouth parts
    await entityManager.createEntity('head_1');
    await entityManager.addComponent('head_1', 'anatomy:part', {
      subType: 'head',
    });

    await entityManager.createEntity('arm_left_1');
    await entityManager.addComponent('arm_left_1', 'anatomy:part', {
      subType: 'arm',
    });

    // Get mouth parts should return empty array
    const mouthParts = getMouthParts(entityManager, actorId);
    expect(mouthParts).toHaveLength(0);

    // Lock operation should handle gracefully
    const operation = {
      type: 'LOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actorId },
    };

    const context = {
      evaluationContext: { actor: { id: actorId } },
      entityManager,
      logger,
    };

    // Should not throw error
    await expect(
      operationInterpreter.execute(operation, context)
    ).resolves.not.toThrow();
  });
});
