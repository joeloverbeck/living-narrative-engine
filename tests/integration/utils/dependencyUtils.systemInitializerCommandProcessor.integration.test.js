import { describe, it, expect, jest } from '@jest/globals';
import SystemInitializer from '../../../src/initializers/systemInitializer.js';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import TargetContextBuilder from '../../../src/scopeDsl/utils/targetContextBuilder.js';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { SystemInitializationError } from '../../../src/errors/InitializationError.js';

/**
 *
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('dependencyUtils cross-module integration', () => {
  it('SystemInitializer enforces resolver contracts via assertFunction', () => {
    const logger = createLogger();
    expect(
      () =>
        new SystemInitializer({
          resolver: {},
          logger,
          validatedEventDispatcher: { dispatch: jest.fn() },
          eventDispatchService: { dispatchWithLogging: jest.fn() },
          initializationTag: 'core:init',
        })
    ).toThrow("SystemInitializer requires a valid IServiceResolver with 'resolveByTag'.");
  });

  it('SystemInitializer processes systems and surfaces failures with validated dependencies', async () => {
    const logger = createLogger();
    const failure = new Error('Initialization explosion');
    const resolver = {
      resolveByTag: jest.fn().mockResolvedValue([
        { initialize: jest.fn().mockResolvedValue(undefined) },
        { initialize: jest.fn().mockRejectedValue(failure) },
        {},
      ]),
    };
    const eventDispatchService = {
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
    };
    const initializer = new SystemInitializer({
      resolver,
      logger,
      validatedEventDispatcher: { dispatch: jest.fn() },
      eventDispatchService,
      initializationTag: 'core:init',
    });

    await expect(initializer.initializeAll()).resolves.toBeUndefined();
    expect(resolver.resolveByTag).toHaveBeenCalledWith('core:init');
    expect(eventDispatchService.dispatchWithLogging).toHaveBeenCalledWith(
      'system:initialization_failed',
      expect.objectContaining({ systemName: expect.any(String) }),
      expect.any(String),
      expect.objectContaining({ allowSchemaNotFound: true })
    );
  });

  it('InitializationService propagates assertMethods violations for logger dependencies', () => {
    const brokenLogger = { error: jest.fn() };
    expect(() => new InitializationService({ log: { logger: brokenLogger } })).toThrow(
      SystemInitializationError
    );
  });

  it('TargetContextBuilder requires non-blank IDs and logs failure context', () => {
    const logger = createLogger();
    const entityManager = {
      getEntityInstance: jest.fn().mockReturnValue({
        id: 'actor-1',
        getAllComponents: () => ({}),
      }),
    };
    const builder = new TargetContextBuilder({
      entityManager,
      gameStateManager: {
        getCurrentTurn: () => 3,
        getTimeOfDay: () => 'dawn',
        getWeather: () => 'clear',
      },
      logger,
    });

    expect(() => builder.buildBaseContext('   ', 'room-7')).toThrow(InvalidArgumentError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("TargetContextBuilder.buildBaseContext: Invalid actorId"),
      expect.objectContaining({ parameterName: 'actorId' })
    );
  });

  it('TargetContextBuilder rejects missing base context via assertPresent', () => {
    const logger = createLogger();
    const entityManager = {
      getEntityInstance: jest.fn().mockReturnValue({ id: 'actor-1', getAllComponents: () => ({}) }),
    };
    const builder = new TargetContextBuilder({
      entityManager,
      gameStateManager: { getCurrentTurn: () => 1 },
      logger,
    });

    expect(() => builder.buildDependentContext(null, {}, { id: 'target' })).toThrow(
      'Base context is required'
    );
  });

  it('CommandProcessor validates dispatcher dependencies with validateDependency', () => {
    const logger = createLogger();
    expect(
      () =>
        new CommandProcessor({
          logger,
          safeEventDispatcher: {},
          eventDispatchService: { dispatchWithErrorHandling: jest.fn() },
        })
    ).toThrow("Invalid or missing method 'dispatch' on dependency 'safeEventDispatcher'.");
  });

  it('CommandProcessor surfaces InvalidArgumentError when actor IDs fail assertValidId', async () => {
    const logger = createLogger();
    const processor = new CommandProcessor({
      logger,
      safeEventDispatcher: { dispatch: jest.fn() },
      eventDispatchService: {
        dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      },
    });

    const result = await processor.dispatchAction(
      { id: ' ' },
      { actionDefinitionId: 'action.perform', commandString: 'perform action' }
    );

    expect(result.success).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'CommandProcessor.dispatchAction: Input validation failed',
      expect.objectContaining({ error: expect.stringContaining('Invalid ID') })
    );
  });
});
