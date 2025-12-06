import { describe, it, expect } from '@jest/globals';

import TargetContextBuilder from '../../../src/scopeDsl/utils/targetContextBuilder.js';
import SystemInitializer from '../../../src/initializers/systemInitializer.js';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import { MultiTargetEventBuilder } from '../../../src/entities/multiTarget/multiTargetEventBuilder.js';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import getDefinition from '../../../src/entities/utils/definitionLookup.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import {
  SystemInitializationError,
  WorldInitializationError,
} from '../../../src/errors/InitializationError.js';
import { DefinitionNotFoundError } from '../../../src/errors/definitionNotFoundError.js';

class MemoryLogger {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  #format(message) {
    return this.prefix ? `${this.prefix}${message}` : message;
  }

  debug(message, metadata) {
    this.debugMessages.push({ message: this.#format(message), metadata });
  }

  info(message, metadata) {
    this.infoMessages.push({ message: this.#format(message), metadata });
  }

  warn(message, metadata) {
    this.warnMessages.push({ message: this.#format(message), metadata });
  }

  error(message, metadata) {
    this.errorMessages.push({ message: this.#format(message), metadata });
  }
}

class FakeValidatedEventDispatcher {
  constructor(logger) {
    this.logger = logger;
    this.subscriptions = new Map();
  }

  async dispatch(eventName, payload) {
    this.logger.debug(`validated:${eventName}`, payload);
    return true;
  }

  subscribe(eventName, listener) {
    const listeners = this.subscriptions.get(eventName) || new Set();
    listeners.add(listener);
    this.subscriptions.set(eventName, listeners);
    return () => {
      listeners.delete(listener);
    };
  }

  unsubscribe(eventName, listener) {
    const listeners = this.subscriptions.get(eventName);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  setBatchMode() {
    // no-op for tests
  }
}

class SimpleEntity {
  constructor(id, components = {}) {
    this.id = id;
    this.components = components;
  }

  getAllComponents() {
    return this.components;
  }
}

class SimpleEntityManager {
  constructor(entities = []) {
    this.entities = new Map(entities.map((entity) => [entity.id, entity]));
  }

  getEntityInstance(id) {
    return this.entities.get(id) ?? null;
  }

  createEntityInstance(def) {
    const entity = new SimpleEntity(def.id, def.components ?? {});
    this.entities.set(entity.id, entity);
    return entity;
  }

  hasBatchSupport() {
    return false;
  }

  getAllComponentTypesForEntity(id) {
    const entity = this.entities.get(id);
    return entity ? Object.keys(entity.components) : [];
  }
}

describe('dependencyUtils helper coverage integration', () => {
  it('builds base contexts with validated dependencies', () => {
    const logger = new MemoryLogger('builder:');
    const entityManager = new SimpleEntityManager([
      new SimpleEntity('actor:1', { identity: { name: 'Hero' } }),
      new SimpleEntity('location:main', { description: 'Main Hall' }),
    ]);
    const gameStateManager = {
      getCurrentTurn: () => 2,
      getTimeOfDay: () => 'dusk',
      getWeather: () => 'rain',
    };

    const builder = new TargetContextBuilder({
      entityManager,
      gameStateManager,
      logger,
    });

    const base = builder.buildBaseContext('actor:1', 'location:main');
    expect(base.actor.id).toBe('actor:1');
    expect(base.location.id).toBe('location:main');
    expect(base.game.timeOfDay).toBe('dusk');
  });

  it('surfaces InvalidArgumentError when actor id is blank', () => {
    const logger = new MemoryLogger('builder:');
    const entityManager = new SimpleEntityManager([
      new SimpleEntity('actor:1'),
      new SimpleEntity('location:main'),
    ]);
    const builder = new TargetContextBuilder({
      entityManager,
      gameStateManager: { getCurrentTurn: () => 1 },
      logger,
    });

    expect(() => builder.buildBaseContext('   ', 'location:main')).toThrow(
      InvalidArgumentError
    );
    expect(logger.errorMessages[0].message).toContain('Invalid actorId');
  });

  it('requires a base context when extending dependent contexts', () => {
    const logger = new MemoryLogger();
    const entityManager = new SimpleEntityManager([
      new SimpleEntity('actor:1'),
      new SimpleEntity('location:main'),
    ]);
    const builder = new TargetContextBuilder({
      entityManager,
      gameStateManager: { getCurrentTurn: () => 1 },
      logger,
    });

    expect(() => builder.buildDependentContext(null, {}, {})).toThrow(
      'Base context is required'
    );
  });

  it('rejects system initialization without a resolver implementation', () => {
    const logger = new MemoryLogger('system:');
    const validatedDispatcher = new FakeValidatedEventDispatcher(logger);
    const safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
    const eventDispatchService = new EventDispatchService({
      safeEventDispatcher: safeDispatcher,
      logger,
    });

    expect(
      () =>
        new SystemInitializer({
          resolver: {},
          logger,
          validatedEventDispatcher: validatedDispatcher,
          eventDispatchService,
          initializationTag: 'startup',
        })
    ).toThrow(
      "SystemInitializer requires a valid IServiceResolver with 'resolveByTag'."
    );
  });

  it('logs initialization validation failures through the provided logger', () => {
    const logger = new MemoryLogger('init:');
    const safeDispatcher = {
      subscribe: () => {},
      dispatch: () => {},
      unsubscribe: () => {},
    };

    expect(
      () =>
        new InitializationService({
          log: { logger },
          events: {
            validatedEventDispatcher: {},
            safeEventDispatcher: safeDispatcher,
          },
        })
    ).toThrow(
      "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
    );
    const lastError = logger.errorMessages[logger.errorMessages.length - 1];
    expect(lastError.message).toContain('validatedEventDispatcher');
  });

  it('initializes systems and uses validated dependencies', async () => {
    const logger = new MemoryLogger('system:');
    const validatedDispatcher = new FakeValidatedEventDispatcher(logger);
    const safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
    const eventDispatchService = new EventDispatchService({
      safeEventDispatcher: safeDispatcher,
      logger,
    });

    class Resolver {
      constructor() {
        this.calls = [];
      }

      async resolveByTag(tag) {
        this.calls.push(tag);
        return [
          {
            async initialize() {
              return Promise.resolve();
            },
          },
        ];
      }
    }

    const resolver = new Resolver();
    const initializer = new SystemInitializer({
      resolver,
      logger,
      validatedEventDispatcher: validatedDispatcher,
      eventDispatchService,
      initializationTag: 'startup',
    });

    await initializer.initializeAll();
    expect(resolver.calls).toEqual(['startup']);
    expect(
      logger.debugMessages.some((entry) =>
        entry.message.includes('Starting initialization')
      )
    ).toBe(true);
  });

  it('validates service dependencies and reports missing methods', () => {
    const logger = new MemoryLogger('service:');
    const setup = new ServiceSetup();

    expect(() =>
      setup.validateDeps('AlertRouter', logger, {
        dispatcher: {
          value: {},
          requiredMethods: ['dispatch'],
        },
      })
    ).toThrow(InvalidArgumentError);
    expect(logger.errorMessages.pop().message).toContain(
      'Invalid or missing method'
    );
  });

  it('accepts valid service dependencies via setupService', () => {
    const logger = new MemoryLogger('service:');
    const setup = new ServiceSetup();
    const dependency = {
      dispatch: () => true,
    };

    const prefixed = setup.setupService('AlertRouter', logger, {
      dispatcher: {
        value: dependency,
        requiredMethods: ['dispatch'],
      },
    });

    setup.validateDeps('AlertRouter', prefixed, {
      dispatcher: {
        value: dependency,
        requiredMethods: ['dispatch'],
      },
    });
    expect(prefixed).not.toBe(logger);
    prefixed.debug('ready');
    const lastDebug = logger.debugMessages[logger.debugMessages.length - 1];
    expect(lastDebug.message).toContain('AlertRouter: ready');
  });

  it('logs missing dependency errors during service validation', () => {
    const logger = new MemoryLogger('service:');
    const setup = new ServiceSetup();

    expect(() =>
      setup.validateDeps('AlertRouter', logger, {
        dispatcher: {
          value: null,
          requiredMethods: ['dispatch'],
        },
      })
    ).toThrow('Missing required dependency: AlertRouter: dispatcher.');
    const errorLog = logger.errorMessages[logger.errorMessages.length - 1];
    expect(errorLog.message).toContain('Missing required dependency');
  });

  it('logs when functions are expected but not provided', () => {
    const logger = new MemoryLogger('service:');
    const setup = new ServiceSetup();

    expect(() =>
      setup.validateDeps('AlertRouter', logger, {
        initializer: {
          value: {},
          isFunction: true,
        },
      })
    ).toThrow(
      "Dependency 'AlertRouter: initializer' must be a function, but got object."
    );
    const errorLog = logger.errorMessages[logger.errorMessages.length - 1];
    expect(errorLog.message).toContain('must be a function');
  });

  it('enforces repository requirements for world initialization', () => {
    const logger = new MemoryLogger('world:');
    const validatedDispatcher = new FakeValidatedEventDispatcher(logger);
    const safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
    const eventDispatchService = new EventDispatchService({
      safeEventDispatcher: safeDispatcher,
      logger,
    });
    const entityManager = new SimpleEntityManager();

    expect(
      () =>
        new WorldInitializer({
          entityManager,
          worldContext: {},
          gameDataRepository: {},
          validatedEventDispatcher: validatedDispatcher,
          eventDispatchService,
          logger,
          scopeRegistry: { initialize() {} },
        })
    ).toThrow(WorldInitializationError);
  });

  it('creates a world initializer with well formed dependencies', () => {
    const logger = new MemoryLogger('world:');
    const validatedDispatcher = new FakeValidatedEventDispatcher(logger);
    const safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
    const eventDispatchService = new EventDispatchService({
      safeEventDispatcher: safeDispatcher,
      logger,
    });
    const entityManager = new SimpleEntityManager([
      new SimpleEntity('actor:1'),
    ]);

    const repository = {
      getWorld: () => ({ entities: [] }),
      getEntityInstanceDefinition: () => null,
      get: () => null,
      getWorldDefinition: () => null,
      getAllWorldDefinitions: () => [],
      getStartingPlayerId: () => null,
      getStartingLocationId: () => null,
      getActionDefinition: () => null,
      getAllActionDefinitions: () => [],
      getEntityDefinition: () => null,
      getAllEntityDefinitions: () => [],
      getEventDefinition: () => null,
      getAllEventDefinitions: () => [],
      getComponentDefinition: () => null,
      getAllComponentDefinitions: () => [],
      getConditionDefinition: () => null,
      getAllConditionDefinitions: () => [],
      getGoalDefinition: () => null,
      getAllGoalDefinitions: () => [],
      getEntityInstanceDefinition: () => null,
      getAllEntityInstanceDefinitions: () => [],
      getAll: () => [],
      clear: () => {},
      store: () => true,
    };

    const initializer = new WorldInitializer({
      entityManager,
      worldContext: {},
      gameDataRepository: repository,
      validatedEventDispatcher: validatedDispatcher,
      eventDispatchService,
      logger,
      scopeRegistry: { initialize() {} },
      config: {},
    });

    expect(initializer.getWorldContext()).toEqual({});
  });

  it('logs errors when target extraction results are missing', () => {
    const logger = new MemoryLogger('targets:');
    const builder = new MultiTargetEventBuilder({ logger });

    expect(() => builder.setTargetsFromExtraction(null)).toThrow(
      'Target extraction result is required'
    );
    const errorLog = logger.errorMessages[logger.errorMessages.length - 1];
    expect(errorLog.message).toContain('Target extraction result is required');
  });

  it('validates definition identifiers before lookup', () => {
    const logger = new MemoryLogger('defs:');
    const registry = {
      getEntityDefinition: () => ({}),
    };

    expect(() => getDefinition('   ', registry, logger)).toThrow(
      InvalidArgumentError
    );
    expect(logger.warnMessages[0].message).toContain('invalid definitionId');
  });

  it('throws when no entity definition can be found', () => {
    const logger = new MemoryLogger('defs:');
    const registry = {
      getEntityDefinition: () => null,
    };

    expect(() => getDefinition('character:hero', registry, logger)).toThrow(
      DefinitionNotFoundError
    );
  });

  it('returns entity definitions for valid identifiers', () => {
    const logger = new MemoryLogger('defs:');
    const definition = { id: 'character:hero' };
    const registry = {
      getEntityDefinition: (id) => (id === definition.id ? definition : null),
    };

    const result = getDefinition('character:hero', registry, logger);
    expect(result).toBe(definition);
  });
});
