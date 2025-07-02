import { describe, it, expect, jest } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../../../src/utils/registrarHelpers.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { registerInterpreters } from '../../../../src/dependencyInjection/registrations/interpreterRegistrations.js';

/**
 * @file Tests that OperationRegistry handlers returned from registerInterpreters
 * defer handler resolution until invocation and forward arguments.
 */

describe('interpreterRegistrations - OperationRegistry handler binding', () => {
  it('invokes the underlying handler when a registered operation is called', () => {
    const container = new AppContainer();
    const registrar = new Registrar(container);

    // Basic logger needed for OperationRegistry and handlers
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    registrar.instance(tokens.ILogger, mockLogger);

    // Perform registration of interpreters
    registerInterpreters(container);

    // Override LogHandler with a simple stub
    const mockLogHandler = { execute: jest.fn() };
    registrar.instance(tokens.LogHandler, mockLogHandler);

    // Resolve OperationRegistry and obtain the LOG handler
    const registry = container.resolve(tokens.OperationRegistry);
    const handler = registry.getHandler('LOG');

    // Call the handler with sample args
    const params = { message: 'test', level: 'info' };
    const context = { evaluationContext: {} };
    handler(params, context);

    // Ensure the underlying execute method received the same args
    expect(mockLogHandler.execute).toHaveBeenCalledWith(params, context);
  });
});
