// tests/unit/shutdown/services/shutdownService.test.js

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ShutdownService from '../../../../src/shutdown/services/shutdownService.js';
import { SHUTDOWNABLE } from '../../../../src/dependencyInjection/tags.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// --- Mock Factories ---
const makeLogger = () => ({
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
});

const makeValidatedEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

const makeContainer = () => ({
  resolve: jest.fn(),
  resolveByTag: jest.fn(),
  disposeSingletons: jest.fn(),
});

const makeTurnManager = () => ({
  stop: jest.fn().mockResolvedValue(undefined),
});

const makeShutdownableSystem = (name = 'TestSystem') => ({
  shutdown: jest.fn(),
  constructor: { name },
});

describe('ShutdownService - Unit Tests', () => {
  let logger;
  let validatedEventDispatcher;
  let container;
  let consoleErrorSpy;

  beforeEach(() => {
    logger = makeLogger();
    validatedEventDispatcher = makeValidatedEventDispatcher();
    container = makeContainer();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  describe('Constructor Validation', () => {
    it('should throw error when container is missing', () => {
      expect(() => {
        new ShutdownService({
          logger,
          validatedEventDispatcher,
        });
      }).toThrow("ShutdownService: Missing required dependency 'container'.");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "ShutdownService: Missing required dependency 'container'."
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new ShutdownService({
          container,
          validatedEventDispatcher,
        });
      }).toThrow(
        "ShutdownService: Missing or invalid required dependency 'logger'."
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "ShutdownService: Missing or invalid required dependency 'logger'."
      );
    });

    it('should throw error when logger is invalid (missing error method)', () => {
      const invalidLogger = { debug: jest.fn(), warn: jest.fn() };

      expect(() => {
        new ShutdownService({
          container,
          logger: invalidLogger,
          validatedEventDispatcher,
        });
      }).toThrow(
        "ShutdownService: Missing or invalid required dependency 'logger'."
      );
    });

    it('should throw error when logger is invalid (missing debug method)', () => {
      const invalidLogger = { error: jest.fn(), warn: jest.fn() };

      expect(() => {
        new ShutdownService({
          container,
          logger: invalidLogger,
          validatedEventDispatcher,
        });
      }).toThrow(
        "ShutdownService: Missing or invalid required dependency 'logger'."
      );
    });

    it('should throw error when logger is invalid (missing warn method)', () => {
      const invalidLogger = { error: jest.fn(), debug: jest.fn() };

      expect(() => {
        new ShutdownService({
          container,
          logger: invalidLogger,
          validatedEventDispatcher,
        });
      }).toThrow(
        "ShutdownService: Missing or invalid required dependency 'logger'."
      );
    });

    it('should attempt to resolve logger from container when logger is invalid', () => {
      const invalidLogger = { debug: jest.fn() }; // missing error and warn
      const fallbackLogger = makeLogger();
      container.resolve.mockReturnValueOnce(fallbackLogger);

      expect(() => {
        new ShutdownService({
          container,
          logger: invalidLogger,
          validatedEventDispatcher,
        });
      }).toThrow(
        "ShutdownService: Missing or invalid required dependency 'logger'."
      );

      expect(container.resolve).toHaveBeenCalledWith('ILogger');
      expect(fallbackLogger.error).toHaveBeenCalledWith(
        "ShutdownService: Missing or invalid required dependency 'logger'."
      );
    });

    it('should handle container resolve failure gracefully when logger is invalid', () => {
      const invalidLogger = null;
      container.resolve.mockImplementationOnce(() => {
        throw new Error('Cannot resolve ILogger');
      });

      expect(() => {
        new ShutdownService({
          container,
          logger: invalidLogger,
          validatedEventDispatcher,
        });
      }).toThrow(
        "ShutdownService: Missing or invalid required dependency 'logger'."
      );

      expect(container.resolve).toHaveBeenCalledWith('ILogger');
    });

    it('should throw error when validatedEventDispatcher is missing', () => {
      expect(() => {
        new ShutdownService({
          container,
          logger,
        });
      }).toThrow(
        "ShutdownService: Missing or invalid required dependency 'validatedEventDispatcher'."
      );

      expect(logger.error).toHaveBeenCalledWith(
        "ShutdownService: Missing or invalid required dependency 'validatedEventDispatcher'."
      );
    });

    it('should throw error when validatedEventDispatcher is invalid (missing dispatch method)', () => {
      const invalidDispatcher = {};

      expect(() => {
        new ShutdownService({
          container,
          logger,
          validatedEventDispatcher: invalidDispatcher,
        });
      }).toThrow(
        "ShutdownService: Missing or invalid required dependency 'validatedEventDispatcher'."
      );

      expect(logger.error).toHaveBeenCalledWith(
        "ShutdownService: Missing or invalid required dependency 'validatedEventDispatcher'."
      );
    });

    it('should throw error when validatedEventDispatcher.dispatch is not a function', () => {
      const invalidDispatcher = { dispatch: 'not-a-function' };

      expect(() => {
        new ShutdownService({
          container,
          logger,
          validatedEventDispatcher: invalidDispatcher,
        });
      }).toThrow(
        "ShutdownService: Missing or invalid required dependency 'validatedEventDispatcher'."
      );
    });

    it('should create instance successfully with all valid dependencies', () => {
      const service = new ShutdownService({
        container,
        logger,
        validatedEventDispatcher,
      });

      expect(service).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Instance created successfully with dependencies.'
      );
    });
  });

  describe('runShutdownSequence - Success Path', () => {
    let service;
    let turnManager;
    let shutdownableSystem1;
    let shutdownableSystem2;

    beforeEach(() => {
      service = new ShutdownService({
        container,
        logger,
        validatedEventDispatcher,
      });

      turnManager = makeTurnManager();
      shutdownableSystem1 = makeShutdownableSystem('System1');
      shutdownableSystem2 = makeShutdownableSystem('System2');

      container.resolve.mockImplementation((token) => {
        if (token === tokens.ITurnManager) return turnManager;
        throw new Error(`Unexpected token: ${token}`);
      });

      container.resolveByTag.mockReturnValue([
        shutdownableSystem1,
        shutdownableSystem2,
      ]);
    });

    it('should execute complete shutdown sequence successfully', async () => {
      await service.runShutdownSequence();

      // Verify initial debug log
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: runShutdownSequence called. Starting shutdown sequence...'
      );

      // Verify shutdown started event
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'shutdown:shutdown_service:started',
        {},
        { allowSchemaNotFound: true }
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "Dispatched 'shutdown:shutdown_service:started' event.",
        {}
      );

      // Verify UI message
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'ui:show_message',
        {
          text: 'System shutting down...',
          type: 'info',
        },
        { allowSchemaNotFound: true }
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "Dispatched 'ui:show_message' event."
      );

      // Verify TurnManager stop
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Resolving and stopping TurnManager...'
      );
      expect(container.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
      expect(turnManager.stop).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: TurnManager stop() method called successfully.'
      );

      // Verify SHUTDOWNABLE systems processing
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Attempting to shut down systems tagged as SHUTDOWNABLE...'
      );
      expect(container.resolveByTag).toHaveBeenCalledWith(SHUTDOWNABLE[0]);
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Found 2 systems tagged as SHUTDOWNABLE.'
      );

      // Verify each system shutdown
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Attempting to call shutdown() on system: System1...'
      );
      expect(shutdownableSystem1.shutdown).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Successfully called shutdown() on system: System1.'
      );

      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Attempting to call shutdown() on system: System2...'
      );
      expect(shutdownableSystem2.shutdown).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Successfully called shutdown() on system: System2.'
      );

      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Finished processing SHUTDOWNABLE systems.'
      );

      // Verify singleton disposal
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Checking container for singleton disposal...'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Attempting to dispose container singletons...'
      );
      expect(container.disposeSingletons).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Container singletons disposed successfully.'
      );

      // Verify completion
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Shutdown sequence finished.'
      );
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'shutdown:shutdown_service:completed',
        {},
        { allowSchemaNotFound: true }
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "Dispatched 'shutdown:shutdown_service:completed' event.",
        {}
      );

      // Verify no errors
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should handle empty SHUTDOWNABLE systems array', async () => {
      container.resolveByTag.mockReturnValue([]);

      await service.runShutdownSequence();

      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Found 0 systems tagged as SHUTDOWNABLE.'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Finished processing SHUTDOWNABLE systems.'
      );

      // Should still complete successfully
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'shutdown:shutdown_service:completed',
        {},
        { allowSchemaNotFound: true }
      );
    });

    it('should handle system with missing constructor name', async () => {
      const anonymousSystem = {
        shutdown: jest.fn(),
        // No constructor property
      };
      container.resolveByTag.mockReturnValue([anonymousSystem]);

      await service.runShutdownSequence();

      // The system should still be processed
      expect(anonymousSystem.shutdown).toHaveBeenCalledTimes(1);

      // Verify it completes successfully
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'shutdown:shutdown_service:completed',
        {},
        { allowSchemaNotFound: true }
      );
    });

    it('should handle container without disposeSingletons method', async () => {
      delete container.disposeSingletons;

      await service.runShutdownSequence();

      expect(logger.warn).toHaveBeenCalledWith(
        'ShutdownService: Container does not have a disposeSingletons method or container is unavailable. Skipping singleton disposal.'
      );

      // Should still complete successfully
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'shutdown:shutdown_service:completed',
        {},
        { allowSchemaNotFound: true }
      );
    });
  });

  describe('runShutdownSequence - Error Handling', () => {
    let service;
    let turnManager;

    beforeEach(() => {
      service = new ShutdownService({
        container,
        logger,
        validatedEventDispatcher,
      });

      turnManager = makeTurnManager();
      container.resolve.mockImplementation((token) => {
        if (token === tokens.ITurnManager) return turnManager;
        throw new Error(`Unexpected token: ${token}`);
      });
    });

    it('should handle TurnManager resolution failure', async () => {
      const resolveError = new Error('Cannot resolve TurnManager');
      container.resolve.mockImplementation((token) => {
        if (token === tokens.ITurnManager) throw resolveError;
        throw new Error(`Unexpected token: ${token}`);
      });

      await service.runShutdownSequence();

      expect(logger.error).toHaveBeenCalledWith(
        'ShutdownService: Error resolving or stopping TurnManager. Continuing shutdown...',
        resolveError
      );

      // Should continue with shutdown
      expect(container.resolveByTag).toHaveBeenCalled();
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'shutdown:shutdown_service:completed',
        {},
        { allowSchemaNotFound: true }
      );
    });

    it('should handle TurnManager stop failure', async () => {
      const stopError = new Error('TurnManager stop failed');
      turnManager.stop.mockRejectedValueOnce(stopError);

      await service.runShutdownSequence();

      expect(logger.error).toHaveBeenCalledWith(
        'ShutdownService: Error resolving or stopping TurnManager. Continuing shutdown...',
        stopError
      );

      // Should continue with shutdown
      expect(container.resolveByTag).toHaveBeenCalled();
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'shutdown:shutdown_service:completed',
        {},
        { allowSchemaNotFound: true }
      );
    });

    it('should handle resolveByTag failure', async () => {
      const resolveError = new Error('Cannot resolve by tag');
      container.resolveByTag.mockImplementation(() => {
        throw resolveError;
      });

      await service.runShutdownSequence();

      expect(logger.error).toHaveBeenCalledWith(
        'ShutdownService: CRITICAL ERROR resolving SHUTDOWNABLE systems. Cannot proceed with tagged system shutdown.',
        resolveError
      );

      // Should skip system shutdown but continue
      expect(logger.debug).not.toHaveBeenCalledWith(
        'ShutdownService: Finished processing SHUTDOWNABLE systems.'
      );

      // Should still attempt singleton disposal
      expect(container.disposeSingletons).toHaveBeenCalled();
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'shutdown:shutdown_service:completed',
        {},
        { allowSchemaNotFound: true }
      );
    });

    it('should handle individual system shutdown failure', async () => {
      const systemError = new Error('System shutdown failed');
      const failingSystem = makeShutdownableSystem('FailingSystem');
      failingSystem.shutdown.mockImplementation(() => {
        throw systemError;
      });

      const workingSystem = makeShutdownableSystem('WorkingSystem');
      container.resolveByTag.mockReturnValue([failingSystem, workingSystem]);

      await service.runShutdownSequence();

      expect(logger.error).toHaveBeenCalledWith(
        'ShutdownService: Error during shutdown() call for system: FailingSystem. Continuing...',
        systemError
      );

      // Should continue with other systems
      expect(workingSystem.shutdown).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Successfully called shutdown() on system: WorkingSystem.'
      );

      // Should complete successfully
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'shutdown:shutdown_service:completed',
        {},
        { allowSchemaNotFound: true }
      );
    });

    it('should handle system without shutdown method', async () => {
      const systemWithoutShutdown = {
        constructor: { name: 'NoShutdownSystem' },
        // No shutdown method
      };
      container.resolveByTag.mockReturnValue([systemWithoutShutdown]);

      await service.runShutdownSequence();

      expect(logger.warn).toHaveBeenCalledWith(
        'ShutdownService: System tagged SHUTDOWNABLE (NoShutdownSystem) does not have a valid shutdown() method.'
      );

      // Should complete successfully
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'shutdown:shutdown_service:completed',
        {},
        { allowSchemaNotFound: true }
      );
    });

    it('should handle system with null shutdown method', async () => {
      const systemWithNullShutdown = {
        constructor: { name: 'NullShutdownSystem' },
        shutdown: null,
      };
      container.resolveByTag.mockReturnValue([systemWithNullShutdown]);

      await service.runShutdownSequence();

      expect(logger.warn).toHaveBeenCalledWith(
        'ShutdownService: System tagged SHUTDOWNABLE (NullShutdownSystem) does not have a valid shutdown() method.'
      );
    });

    it('should handle disposeSingletons failure', async () => {
      const disposeError = new Error('Dispose singletons failed');
      container.disposeSingletons.mockImplementation(() => {
        throw disposeError;
      });

      await service.runShutdownSequence();

      expect(logger.error).toHaveBeenCalledWith(
        'ShutdownService: Error occurred during container.disposeSingletons().',
        disposeError
      );

      // Should still complete
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'shutdown:shutdown_service:completed',
        {},
        { allowSchemaNotFound: true }
      );
    });

    it('should handle error when dispatching failed event also fails', async () => {
      // This tests the error logging in the catch block when the failed dispatch also fails
      const criticalError = new Error('Critical shutdown error');
      const dispatchFailedError = new Error('Failed to dispatch failed event');

      // Mock container.resolveByTag to throw an uncaught error
      container.resolveByTag.mockImplementation(() => {
        throw criticalError;
      });

      // Mock dispatch to fail when trying to dispatch the failed event
      validatedEventDispatcher.dispatch.mockImplementation(async (eventId) => {
        if (eventId === 'shutdown:shutdown_service:failed') {
          throw dispatchFailedError;
        }
      });

      await service.runShutdownSequence();

      // Should log both errors
      expect(logger.error).toHaveBeenCalledWith(
        'ShutdownService: CRITICAL ERROR resolving SHUTDOWNABLE systems. Cannot proceed with tagged system shutdown.',
        criticalError
      );

      // The test verifies that even if the failed event dispatch fails, the sequence completes
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Shutdown sequence finished.'
      );
    });
  });

  describe('runShutdownSequence - Event Dispatch Failures', () => {
    let service;

    beforeEach(() => {
      service = new ShutdownService({
        container,
        logger,
        validatedEventDispatcher,
      });

      const turnManager = makeTurnManager();
      container.resolve.mockImplementation((token) => {
        if (token === tokens.ITurnManager) return turnManager;
        throw new Error(`Unexpected token: ${token}`);
      });
      container.resolveByTag.mockReturnValue([]);
    });

    it('should handle failure to dispatch shutdown:shutdown_service:started event', async () => {
      const dispatchError = new Error('Dispatch failed');
      validatedEventDispatcher.dispatch.mockImplementation(async (eventId) => {
        if (eventId === 'shutdown:shutdown_service:started') {
          throw dispatchError;
        }
      });

      await service.runShutdownSequence();

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to dispatch 'shutdown:shutdown_service:started' event",
        dispatchError
      );

      // Should continue with shutdown
      expect(container.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
    });

    it('should handle failure to dispatch ui:show_message event', async () => {
      const dispatchError = new Error('UI dispatch failed');
      validatedEventDispatcher.dispatch.mockImplementation(async (eventId) => {
        if (eventId === 'ui:show_message') {
          throw dispatchError;
        }
      });

      await service.runShutdownSequence();

      expect(logger.error).toHaveBeenCalledWith(
        'ShutdownService: Failed to dispatch shutdown start UI event.',
        dispatchError
      );

      // Should continue with shutdown
      expect(container.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
    });

    it('should handle failure to dispatch shutdown:shutdown_service:completed event', async () => {
      const dispatchError = new Error('Completed dispatch failed');
      validatedEventDispatcher.dispatch.mockImplementation(async (eventId) => {
        if (eventId === 'shutdown:shutdown_service:completed') {
          throw dispatchError;
        }
      });

      await service.runShutdownSequence();

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to dispatch 'shutdown:shutdown_service:completed' event",
        dispatchError
      );

      // Shutdown sequence should still be considered finished
      expect(logger.debug).toHaveBeenCalledWith(
        'ShutdownService: Shutdown sequence finished.'
      );
    });
  });

  describe('Private Helper Method - #dispatchWithLogging', () => {
    let service;

    beforeEach(() => {
      service = new ShutdownService({
        container,
        logger,
        validatedEventDispatcher,
      });
    });

    it('should be tested indirectly through runShutdownSequence', async () => {
      // The private method #dispatchWithLogging is tested through the public API
      // We verify its behavior by checking the logs and dispatch calls
      await service.runShutdownSequence();

      // Verify successful dispatch logging
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Dispatched '"),
        expect.any(Object)
      );
    });

    it('should handle dispatch errors correctly (tested via event failures)', async () => {
      const dispatchError = new Error('Dispatch error');
      validatedEventDispatcher.dispatch.mockRejectedValueOnce(dispatchError);

      await service.runShutdownSequence();

      // Verify error logging from #dispatchWithLogging
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to dispatch '"),
        dispatchError
      );
    });
  });

  describe('Edge Cases and Additional Coverage', () => {
    it('should handle null container in error path', () => {
      expect(() => {
        new ShutdownService({
          container: null,
          logger,
          validatedEventDispatcher,
        });
      }).toThrow("ShutdownService: Missing required dependency 'container'.");
    });

    it('should handle undefined container in error path', () => {
      expect(() => {
        new ShutdownService({
          container: undefined,
          logger,
          validatedEventDispatcher,
        });
      }).toThrow("ShutdownService: Missing required dependency 'container'.");
    });

    it('should handle logger with non-function properties', () => {
      const invalidLogger = {
        error: 'not-a-function',
        debug: jest.fn(),
        warn: jest.fn(),
      };

      expect(() => {
        new ShutdownService({
          container,
          logger: invalidLogger,
          validatedEventDispatcher,
        });
      }).toThrow(
        "ShutdownService: Missing or invalid required dependency 'logger'."
      );
    });

    it('should handle null validatedEventDispatcher', () => {
      expect(() => {
        new ShutdownService({
          container,
          logger,
          validatedEventDispatcher: null,
        });
      }).toThrow(
        "ShutdownService: Missing or invalid required dependency 'validatedEventDispatcher'."
      );
    });

    it('should handle validatedEventDispatcher with non-function dispatch', () => {
      const invalidDispatcher = { dispatch: null };

      expect(() => {
        new ShutdownService({
          container,
          logger,
          validatedEventDispatcher: invalidDispatcher,
        });
      }).toThrow(
        "ShutdownService: Missing or invalid required dependency 'validatedEventDispatcher'."
      );
    });
  });
});
