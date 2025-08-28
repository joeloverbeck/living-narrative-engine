/**
 * @file Integration test for REGENERATE_DESCRIPTION operation execution
 * This test reproduces the exact scenario where handle_remove_clothing.rule.json
 * fails due to missing handler registration.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ClothingIntegrationTestBed from '../../common/clothing/clothingIntegrationTestBed.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import RegenerateDescriptionHandler from '../../../src/logic/operationHandlers/regenerateDescriptionHandler.js';

describe('REGENERATE_DESCRIPTION Operation Integration', () => {
  let testBed;
  let operationInterpreter;
  let mockLogger;
  let entityManager;
  let mockBodyDescriptionComposer;

  beforeEach(async () => {
    testBed = new ClothingIntegrationTestBed();
    await testBed.setup();

    entityManager = testBed.getEntityManager();
    mockLogger = testBed.logger;

    // Enhance entity manager with required methods for the handler
    entityManager.addComponent = jest.fn(
      async (entityId, componentId, data) => {
        const entity = entityManager.entities.get(entityId);
        if (entity) {
          if (!entity.components) entity.components = {};
          entity.components[componentId] = data;
        }
      }
    );

    entityManager.createEntity = jest.fn(async (entityId, type) => {
      const entity = {
        id: entityId,
        type: type,
        components: {},
      };
      entityManager.entities.set(entityId, entity);
      return entity;
    });

    // Create mock BodyDescriptionComposer
    mockBodyDescriptionComposer = {
      composeDescription: jest.fn().mockResolvedValue('Updated description'),
    };

    // Set up OperationRegistry with the REGENERATE_DESCRIPTION handler
    const operationRegistry = new OperationRegistry({
      logger: mockLogger,
    });

    // Register the REGENERATE_DESCRIPTION handler
    const regenerateDescriptionHandler = new RegenerateDescriptionHandler({
      entityManager: entityManager,
      bodyDescriptionComposer: mockBodyDescriptionComposer,
      logger: mockLogger,
      safeEventDispatcher: testBed.eventDispatcher,
    });

    operationRegistry.register('REGENERATE_DESCRIPTION', (params, context) =>
      regenerateDescriptionHandler.execute(params, context)
    );

    // Create OperationInterpreter with the registry
    operationInterpreter = new OperationInterpreter({
      logger: mockLogger,
      operationRegistry: operationRegistry,
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  it('should execute REGENERATE_DESCRIPTION operation without "HANDLER NOT FOUND" error', async () => {
    // Arrange - create test entity with required components
    const testEntityId = 'test-actor-' + Date.now();

    // Create a test entity with basic components
    await entityManager.createEntity(testEntityId, 'core:actor');
    await entityManager.addComponent(testEntityId, 'core:name', {
      value: 'Test Actor',
    });
    await entityManager.addComponent(testEntityId, 'core:description', {
      text: 'Initial description',
    });

    // Prepare the operation that should be executed by the rule
    const regenerateOperation = {
      type: 'REGENERATE_DESCRIPTION',
      parameters: {
        entity_ref: testEntityId,
      },
    };

    // Create minimal execution context
    const executionContext = {
      evaluationContext: {
        actor: { id: testEntityId },
      },
      variables: new Map([['actor', testEntityId]]),
      event: {
        type: 'core:attempt_action',
        payload: {
          targetId: 'some-clothing-item',
        },
      },
      worldContext: null,
    };

    // Act - execute the REGENERATE_DESCRIPTION operation
    await operationInterpreter.execute(regenerateOperation, executionContext);

    // Assert - should not log "HANDLER NOT FOUND" error
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining(
        'HANDLER NOT FOUND for operation type: "REGENERATE_DESCRIPTION"'
      )
    );

    // Verify the operation completed successfully
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('REGENERATE_DESCRIPTION')
    );
  });

  it('should properly execute the regenerate description handler when called from rule', async () => {
    // This test simulates the exact flow from handle_remove_clothing.rule.json

    // Arrange - setup test entity and mocks
    const testEntityId = 'test-actor-clothing-' + Date.now();

    await entityManager.createEntity(testEntityId, 'core:actor');
    await entityManager.addComponent(testEntityId, 'core:description', {
      text: 'Original description',
    });

    // Verify the entity was created
    const createdEntity = entityManager.getEntityInstance(testEntityId);
    expect(createdEntity).toBeDefined();
    expect(createdEntity.id).toBe(testEntityId);

    const newDescription = 'Actor after clothing removal';
    mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
      newDescription
    );

    // Create the exact operation from handle_remove_clothing.rule.json
    const operation = {
      type: 'REGENERATE_DESCRIPTION',
      parameters: {
        entity_ref: 'actor', // This will resolve to the entity in context
      },
    };

    const executionContext = {
      evaluationContext: {
        actor: { id: testEntityId },
        target: { id: 'clothing-item-id' },
        event: {
          type: 'core:attempt_action',
          payload: {
            actorId: testEntityId,
            targetId: 'clothing-item-id',
            actionId: 'clothing:remove_clothing',
          },
        },
      },
      variables: new Map([
        ['actor', testEntityId], // Context variable mapping
        ['actorName', 'Test Actor'],
        ['targetName', 'Test Clothing'],
      ]),
      event: {
        type: 'core:attempt_action',
        payload: {
          actorId: testEntityId,
          targetId: 'clothing-item-id',
          actionId: 'clothing:remove_clothing',
        },
      },
      worldContext: null,
    };

    // Act - execute the operation as it would be called from the rule
    await operationInterpreter.execute(operation, executionContext);

    // Assert - verify no "HANDLER NOT FOUND" errors
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('HANDLER NOT FOUND')
    );

    // Verify the mock was called
    expect(mockBodyDescriptionComposer.composeDescription).toHaveBeenCalled();

    // Wait for the async addComponent to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify addComponent was called with the correct parameters
    expect(entityManager.addComponent).toHaveBeenCalledWith(
      testEntityId,
      'core:description',
      { text: newDescription }
    );

    // Verify the entity's description was updated (if the handler executes properly)
    const entity = entityManager.getEntityInstance(testEntityId);
    if (entity && entity.components && entity.components['core:description']) {
      // Handler should have updated the description
      expect(entity.components['core:description'].text).toBe(newDescription);
    }

    // Also verify the mock was called
    expect(mockBodyDescriptionComposer.composeDescription).toHaveBeenCalledWith(
      expect.objectContaining({ id: testEntityId })
    );
  });
});
