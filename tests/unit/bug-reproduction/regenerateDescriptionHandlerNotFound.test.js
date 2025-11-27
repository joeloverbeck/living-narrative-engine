/**
 * @file Test that reproduces and verifies the fix for the "HANDLER NOT FOUND for operation type: REGENERATE_DESCRIPTION" error
 * This test specifically addresses the runtime error reported in error_logs.txt
 */

import { describe, it, expect, jest } from '@jest/globals';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';

describe('Bug Fix: REGENERATE_DESCRIPTION Handler Not Found', () => {
  let mockLogger;
  let registry;
  let interpreter;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    registry = new OperationRegistry({ logger: mockLogger });
    interpreter = new OperationInterpreter({
      logger: mockLogger,
      operationRegistry: registry,
    });
  });

  it('should throw MissingHandlerError when handler is not registered', () => {
    // Arrange - create the exact operation from handle_remove_clothing.rule.json
    const regenerateDescriptionOperation = {
      type: 'REGENERATE_DESCRIPTION',
      parameters: {
        entity_ref: 'actor',
      },
    };

    const executionContext = {
      variables: new Map([
        ['actor', 'test-actor-id'],
        ['actorName', 'Test Actor'],
        ['targetName', 'Test Clothing'],
      ]),
      event: {
        type: 'core:attempt_action',
        payload: {
          actorId: 'test-actor-id',
          targetId: 'clothing-item-id',
          actionId: 'clothing:remove_clothing',
        },
      },
    };

    // Act & Assert - should throw MissingHandlerError when handler is not registered
    expect(() =>
      interpreter.execute(regenerateDescriptionOperation, executionContext)
    ).toThrow(
      "Cannot execute operation 'REGENERATE_DESCRIPTION': handler not found"
    );
  });

  it('should NOT produce the "HANDLER NOT FOUND" error when handler is properly registered', async () => {
    // Arrange - register a mock handler for REGENERATE_DESCRIPTION
    const mockHandler = jest.fn().mockResolvedValue(undefined);
    registry.register('REGENERATE_DESCRIPTION', mockHandler);

    // Create the same operation
    const regenerateDescriptionOperation = {
      type: 'REGENERATE_DESCRIPTION',
      parameters: {
        entity_ref: 'actor',
      },
    };

    const executionContext = {
      variables: new Map([['actor', 'test-actor-id']]),
      event: {
        type: 'core:attempt_action',
        payload: {},
      },
    };

    // Act - execute the operation with the handler registered
    await interpreter.execute(regenerateDescriptionOperation, executionContext);

    // Assert - should NOT log the "HANDLER NOT FOUND" error
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining(
        'HANDLER NOT FOUND for operation type: "REGENERATE_DESCRIPTION"'
      )
    );

    // Verify the handler was actually called
    expect(mockHandler).toHaveBeenCalledWith(
      { entity_ref: 'actor' },
      executionContext
    );
  });

  it('should verify the fix is in place by checking registry configuration', () => {
    // This test verifies that in the actual system, the REGENERATE_DESCRIPTION
    // operation is now properly registered in the OperationRegistry

    // Import the actual registration function
    const {
      registerInterpreters,
    } = require('../../../src/dependencyInjection/registrations/interpreterRegistrations.js');
    const AppContainer =
      require('../../../src/dependencyInjection/appContainer.js').default;
    const { Registrar } = require('../../../src/utils/registrarHelpers.js');
    const { tokens } = require('../../../src/dependencyInjection/tokens.js');

    // Setup container like the real system
    const container = new AppContainer();
    const registrar = new Registrar(container);
    registrar.instance(tokens.ILogger, mockLogger);

    // Execute the registration
    registerInterpreters(container);

    // Get the configured registry
    const configuredRegistry = container.resolve(tokens.OperationRegistry);

    // Verify REGENERATE_DESCRIPTION handler is now registered
    const handler = configuredRegistry.getHandler('REGENERATE_DESCRIPTION');

    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');

    // Ensure it doesn't log "handler not found"
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining(
        'No handler found for operation type "REGENERATE_DESCRIPTION"'
      )
    );
  });
});
