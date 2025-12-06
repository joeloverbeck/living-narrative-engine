import { describe, it, expect } from '@jest/globals';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import { SystemInitializationError } from '../../../src/errors/InitializationError.js';
import { CacheInvalidationManager } from '../../../src/cache/CacheInvalidationManager.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class RecordingLogger {
  constructor() {
    this.errors = [];
    this.warns = [];
    this.infos = [];
    this.debugs = [];
  }

  error(message, ...args) {
    this.errors.push({ message, args });
  }

  warn(message, ...args) {
    this.warns.push({ message, args });
  }

  info(message, ...args) {
    this.infos.push({ message, args });
  }

  debug(message, ...args) {
    this.debugs.push({ message, args });
  }
}

/**
 *
 * @param logger
 */
function buildInitializationServiceDeps(logger) {
  const modsLoader = { loadMods: async () => ({ loaded: true }) };
  const scopeRegistry = { initialize: async () => {} };
  const dataRegistry = { getAll: () => [] };
  const systemInitializer = { initializeAll: async () => {} };
  const worldInitializer = { initializeWorldEntities: async () => true };
  const contentDependencyValidator = { validate: async () => {} };
  const llmAdapterInitializer = { initialize: async () => true };
  const anatomyFormattingService = { initialize: async () => {} };

  const safeEventDispatcher = { subscribe: () => {} };
  const llmAdapter = { name: 'llm-adapter-stub' };
  const llmConfigLoader = { load: async () => ({}) };
  const entityManager = { createEntityInstance: () => ({}) };
  const domUiFacade = { ready: true };
  const actionIndex = { buildIndex: () => {} };
  const gameDataRepository = { getAllActionDefinitions: () => [] };
  const thoughtListener = { handleEvent: () => {} };
  const notesListener = { handleEvent: () => {} };
  const spatialIndexManager = { buildIndex: () => {} };

  return {
    log: { logger },
    events: {
      validatedEventDispatcher: { dispatch: () => {} },
      safeEventDispatcher,
    },
    llm: {
      llmAdapter,
      llmConfigLoader,
    },
    persistence: {
      entityManager,
      domUiFacade,
      actionIndex,
      gameDataRepository,
      thoughtListener,
      notesListener,
      spatialIndexManager,
    },
    coreSystems: {
      modsLoader,
      scopeRegistry,
      dataRegistry,
      systemInitializer,
      worldInitializer,
      contentDependencyValidator,
      llmAdapterInitializer,
      anatomyFormattingService,
    },
  };
}

describe('dependencyUtils error logging integration coverage', () => {
  it('logs via assertFunction before throwing when InitializationService receives invalid dispatcher', () => {
    const logger = new RecordingLogger();
    const deps = buildInitializationServiceDeps(logger);
    deps.events.validatedEventDispatcher = {}; // Missing dispatch method

    expect(() => new InitializationService(deps)).toThrow(
      SystemInitializationError
    );

    expect(logger.errors).not.toHaveLength(0);
    const [firstError] = logger.errors;
    expect(firstError.message).toContain('validatedEventDispatcher');
  });

  it('logs via validateDependency before throwing when CacheInvalidationManager misses dispatcher', () => {
    const logger = new RecordingLogger();

    expect(
      () =>
        new CacheInvalidationManager({
          logger,
          validatedEventDispatcher: null,
        })
    ).toThrow(InvalidArgumentError);

    expect(logger.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining(
            'Missing required dependency: IValidatedEventDispatcher.'
          ),
        }),
      ])
    );
  });
});
