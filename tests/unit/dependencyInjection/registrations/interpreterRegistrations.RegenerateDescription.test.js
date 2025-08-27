/**
 * @file Unit tests for REGENERATE_DESCRIPTION operation registration in interpreterRegistrations.js
 */

import { describe, it, expect, jest } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../../../src/utils/registrarHelpers.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { registerInterpreters } from '../../../../src/dependencyInjection/registrations/interpreterRegistrations.js';

describe('interpreterRegistrations - REGENERATE_DESCRIPTION Operation', () => {
  let container;
  let operationRegistry;

  beforeEach(() => {
    container = new AppContainer();
    const registrar = new Registrar(container);

    // Setup basic logger needed for registry
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    registrar.instance(tokens.ILogger, mockLogger);

    // Register interpreters which includes the OperationRegistry setup
    registerInterpreters(container);

    // Get the operation registry
    operationRegistry = container.resolve(tokens.OperationRegistry);
  });

  it('should register REGENERATE_DESCRIPTION operation handler', () => {
    // Act - try to get the handler for REGENERATE_DESCRIPTION
    const handler = operationRegistry.getHandler('REGENERATE_DESCRIPTION');

    // Assert - handler should exist and be a function
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('should bind REGENERATE_DESCRIPTION to RegenerateDescriptionHandler token', () => {
    // Create a mock handler for RegenerateDescriptionHandler
    const mockHandler = { execute: jest.fn() };
    const registrar = new Registrar(container);
    registrar.instance(tokens.RegenerateDescriptionHandler, mockHandler);

    // Get the handler from the registry
    const handler = operationRegistry.getHandler('REGENERATE_DESCRIPTION');

    // Create test parameters
    const mockParams = { entity_ref: 'test-entity-id' };
    const mockContext = { evaluationContext: {} };

    // Act - call the handler
    handler(mockParams, mockContext);

    // Assert - the underlying handler should have been called
    expect(mockHandler.execute).toHaveBeenCalledWith(mockParams, mockContext);
  });

  it('should handle REGENERATE_DESCRIPTION operation without throwing "HANDLER NOT FOUND" error', () => {
    // This test specifically addresses the error from the logs:
    // "HANDLER NOT FOUND for operation type: REGENERATE_DESCRIPTION"
    const handler = operationRegistry.getHandler('REGENERATE_DESCRIPTION');

    // Assert - should not be undefined (which causes "HANDLER NOT FOUND")
    expect(handler).not.toBeUndefined();
    expect(handler).not.toBeNull();
  });
});
