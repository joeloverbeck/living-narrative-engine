import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import SystemInitializer from '../../../src/initializers/systemInitializer.js';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import getDefinition from '../../../src/entities/utils/definitionLookup.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { DefinitionNotFoundError } from '../../../src/errors/definitionNotFoundError.js';
import { SystemInitializationError } from '../../../src/errors/InitializationError.js';

class RecordingLogger {
  constructor() {
    this.errors = [];
    this.warns = [];
    this.infos = [];
    this.debugs = [];
  }

  error(...args) {
    this.errors.push(args);
  }

  warn(...args) {
    this.warns.push(args);
  }

  info(...args) {
    this.infos.push(args);
  }

  debug(...args) {
    this.debugs.push(args);
  }
}

class MinimalSafeEventDispatcher {
  constructor(logger) {
    this.logger = logger;
    this.dispatched = [];
  }

  async dispatch(eventName, payload) {
    this.dispatched.push({ eventName, payload });
    return true;
  }

  subscribe() {
    return () => {};
  }

  unsubscribe() {}
}

class MinimalValidatedDispatcher {
  constructor() {
    this.calls = [];
  }

  async dispatch(eventName, payload) {
    this.calls.push({ eventName, payload });
    return true;
  }

  subscribe() {
    return () => {};
  }

  unsubscribe() {}
}

function createValidInitializationConfig(logger) {
  return {
    log: { logger },
    events: {
      validatedEventDispatcher: {
        dispatch: async () => true,
        subscribe: () => () => {},
      },
      safeEventDispatcher: {
        subscribe: () => () => {},
      },
    },
    llm: {
      llmAdapter: {
        init: async () => {},
        isInitialized: () => true,
        isOperational: () => true,
      },
      llmConfigLoader: {
        loadConfig: async () => ({}),
      },
    },
    persistence: {
      entityManager: {},
      domUiFacade: {},
      actionIndex: { buildIndex: () => {} },
      gameDataRepository: { getAllActionDefinitions: () => [] },
      thoughtListener: { handleEvent: () => {} },
      notesListener: { handleEvent: () => {} },
      spatialIndexManager: { buildIndex: () => {} },
    },
    coreSystems: {
      modsLoader: { loadMods: async () => ({}) },
      scopeRegistry: { initialize: async () => {} },
      dataRegistry: { getAll: () => [] },
      systemInitializer: { initializeAll: async () => {} },
      worldInitializer: { initializeWorldEntities: async () => {} },
      contentDependencyValidator: { validate: async () => {} },
      llmAdapterInitializer: { initialize: async () => {} },
      anatomyFormattingService: { initialize: async () => {} },
    },
  };
}

describe('dependencyUtils integration coverage boost', () => {
  let logger;

  beforeEach(() => {
    logger = new RecordingLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses assertPresent to guard safe event dispatch wiring', () => {
    expect(
      () =>
        new EventDispatchService({
          safeEventDispatcher: null,
          logger,
        })
    ).toThrow('EventDispatchService: safeEventDispatcher is required');
  });

  it('initializes systems when dependencies provide required functions', async () => {
    const safeDispatcher = new MinimalSafeEventDispatcher(logger);
    const dispatchService = new EventDispatchService({
      safeEventDispatcher: safeDispatcher,
      logger,
    });
    const resolverSystems = [
      {
        initialize: jest.fn(async () => {
          logger.debug('system initialized');
        }),
      },
    ];
    const resolver = {
      async resolveByTag(tag) {
        logger.debug(`resolveByTag called for ${tag}`);
        return resolverSystems;
      },
    };
    const initializer = new SystemInitializer({
      resolver,
      logger,
      validatedEventDispatcher: new MinimalValidatedDispatcher(),
      eventDispatchService: dispatchService,
      initializationTag: 'core:start',
    });

    await initializer.initializeAll();

    expect(resolverSystems[0].initialize).toHaveBeenCalled();
    expect(safeDispatcher.dispatched.length).toBe(0);
  });

  it('logs assertFunction failures when InitializationService receives incomplete dispatcher', () => {
    const deps = createValidInitializationConfig(logger);
    deps.events.validatedEventDispatcher = { subscribe: () => () => {} };

    expect(() => new InitializationService(deps)).toThrow(
      SystemInitializationError
    );

    expect(logger.errors.at(0)?.at(0)).toBe(
      "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
    );
  });

  it('enforces target naming and ids through TargetManager', () => {
    const manager = new TargetManager({ logger });

    expect(() => manager.setTargets(null)).toThrow('Targets object is required');
    expect(logger.errors.at(0)?.at(0)).toBe('Targets object is required');

    manager.setTargets({ primary: 'actor-1' });
    expect(manager.getPrimaryTarget()).toBe('actor-1');

    expect(() => manager.addTarget('', 'actor-2')).toThrow(InvalidArgumentError);
    expect(() => manager.getTarget('   ')).toThrow(InvalidArgumentError);
  });

  it('validates registry lookups via assertValidId and surfaces warnings', () => {
    const registry = new InMemoryDataRegistry({ logger });

    expect(() => getDefinition('   ', registry, logger)).toThrow(
      InvalidArgumentError
    );
    expect(logger.errors.at(0)?.at(0)).toContain('Invalid ID');
    expect(logger.warns.at(0)?.at(0)).toContain('invalid definitionId');

    registry.store('entityDefinitions', 'hero', { id: 'hero', name: 'Hero' });
    const definition = getDefinition('hero', registry, logger);
    expect(definition).toEqual({ id: 'hero', name: 'Hero' });

    expect(() => getDefinition('villain', registry, logger)).toThrow(
      DefinitionNotFoundError
    );
    expect(logger.warns.at(-1)?.at(0)).toContain('Definition not found in registry');
  });

  it('validates service dependency graphs and falls back to console logging when needed', () => {
    const serviceSetup = new ServiceSetup();

    expect(() =>
      serviceSetup.setupService('DecisionService', logger, {
        orchestrator: {
          value: {
            discoverActions: () => [],
          },
          requiredMethods: ['discoverActions'],
        },
        factory: {
          value: () => ({}),
          isFunction: true,
        },
      })
    ).not.toThrow();

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() =>
      serviceSetup.validateDeps(
        'DecisionService',
        { warn() {}, info() {}, debug() {} },
        {
          orchestrator: {
            value: null,
            requiredMethods: ['discoverActions'],
          },
        }
      )
    ).toThrow(InvalidArgumentError);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Missing required dependency: DecisionService: orchestrator.'
    );

    consoleErrorSpy.mockRestore();
  });
});
