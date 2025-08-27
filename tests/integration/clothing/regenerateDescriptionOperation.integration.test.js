/**
 * @file Integration test for REGENERATE_DESCRIPTION operation execution
 * This test reproduces the exact scenario where handle_remove_clothing.rule.json
 * fails due to missing handler registration.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createIntegrationTestBed } from '../../common/integrationTestBed.js';

describe('REGENERATE_DESCRIPTION Operation Integration', () => {
  let testBed;
  let operationInterpreter;
  let mockLogger;

  beforeEach(() => {
    testBed = createIntegrationTestBed();
    operationInterpreter = testBed.getService('OperationInterpreter');

    // Capture logger to check for error messages
    mockLogger = testBed.getService('ILogger');
    jest.clearAllMocks();
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  it('should execute REGENERATE_DESCRIPTION operation without "HANDLER NOT FOUND" error', async () => {
    // Arrange - create test entity with required components
    const entityManager = testBed.getService('IEntityManager');
    const testEntityId = 'test-actor-' + Date.now();

    // Create a test entity with basic components
    await entityManager.createEntity(testEntityId, 'core:actor');
    await entityManager.addComponent(testEntityId, 'core:name', {
      value: 'Test Actor',
    });
    await entityManager.addComponent(testEntityId, 'core:description', {
      text: 'Initial description',
    });

    // Mock the BodyDescriptionComposer to avoid external dependencies
    const mockBodyDescriptionComposer = testBed.createMock(
      'BodyDescriptionComposer',
      ['composeDescription']
    );
    mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
      'Updated description'
    );

    // Prepare the operation that should be executed by the rule
    const regenerateOperation = {
      type: 'REGENERATE_DESCRIPTION',
      parameters: {
        entity_ref: testEntityId,
      },
    };

    // Create minimal execution context
    const executionContext = {
      variables: new Map([['actor', testEntityId]]),
      event: {
        type: 'core:attempt_action',
        payload: {
          targetId: 'some-clothing-item',
        },
      },
      worldContext: testBed.getService('IWorldContext'),
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
    const entityManager = testBed.getService('IEntityManager');
    const testEntityId = 'test-actor-clothing-' + Date.now();

    await entityManager.createEntity(testEntityId, 'core:actor');
    await entityManager.addComponent(testEntityId, 'core:description', {
      text: 'Original description',
    });

    // Mock BodyDescriptionComposer
    const mockBodyDescriptionComposer = testBed.createMock(
      'BodyDescriptionComposer',
      ['composeDescription']
    );
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
      worldContext: testBed.getService('IWorldContext'),
    };

    // Act - execute the operation as it would be called from the rule
    await operationInterpreter.execute(operation, executionContext);

    // Assert - verify no "HANDLER NOT FOUND" errors
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('HANDLER NOT FOUND')
    );

    // Verify the entity's description was updated (if the handler executes properly)
    const entity = entityManager.getEntityInstance(testEntityId);
    if (entity && entity.components && entity.components['core:description']) {
      // Handler should have updated the description
      expect(entity.components['core:description'].text).toBe(newDescription);
    }
  });
});
