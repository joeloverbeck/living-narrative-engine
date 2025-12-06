/**
 * @file Comprehensive integration flow exercising dependencyUtils helpers.
 * @description
 *  This suite wires together several production modules that rely on
 *  dependencyUtils for runtime validation. By constructing the modules with
 *  both valid and invalid dependency graphs we exercise the remaining
 *  uncovered branches in dependencyUtils (assertPresent, assertFunction,
 *  assertMethods, assertValidId, assertNonBlankString, validateDependency and
 *  validateDependencies).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import { withValidatedDeps } from '../../../src/utils/withValidatedDeps.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';

/**
 * @returns {import('../../../src/interfaces/coreServices.js').ILogger}
 */
function createTestLogger() {
  const calls = [];
  const makeSpy = (level) =>
    jest.fn((message, context) => {
      calls.push({ level, message, context });
    });

  return {
    calls,
    debug: makeSpy('debug'),
    info: makeSpy('info'),
    warn: makeSpy('warn'),
    error: makeSpy('error'),
  };
}

/**
 * Minimal stub implementing the subset of IGameDataRepository required by
 * WorldInitializer. The implementation is functional (non-mocked) and stores
 * world data in memory so that the initializer can interact with it.
 */
class InMemoryGameDataRepository {
  constructor() {
    this._world = { entities: [] };
    this._definitions = new Map();
  }

  getWorld() {
    return this._world;
  }

  getEntityInstanceDefinition(id) {
    return this._definitions.get(id) ?? null;
  }

  get(id) {
    return this._definitions.get(id) ?? null;
  }
}

/**
 * Minimal scope registry used by the initializer.
 */
class TestScopeRegistry {
  constructor(logger) {
    this.logger = logger;
    this.initializedWith = [];
  }

  initialize(worldContext) {
    this.initializedWith.push(worldContext);
    this.logger.debug('scope registry initialized');
  }
}

class TestSafeEventDispatcher {
  constructor(validatedDispatcher, logger) {
    this.delegate = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
  }

  dispatch(...args) {
    return this.delegate.dispatch(...args);
  }

  subscribe(...args) {
    return this.delegate.subscribe(...args);
  }

  unsubscribe(...args) {
    return this.delegate.unsubscribe(...args);
  }
}

class BasicSchemaValidator {
  constructor() {
    this.loadedSchemas = new Set();
  }

  loadSchema(id) {
    this.loadedSchemas.add(id);
  }

  isSchemaLoaded(id) {
    return this.loadedSchemas.has(id);
  }

  validate() {
    return { isValid: true, errors: [] };
  }
}

describe('dependencyUtils integration across runtime modules', () => {
  let logger;
  let repository;
  let validatedDispatcher;
  let safeDispatcher;
  let eventDispatchService;
  let serviceSetup;

  beforeEach(() => {
    logger = createTestLogger();
    repository = new InMemoryGameDataRepository();
    const schemaValidator = new BasicSchemaValidator();
    schemaValidator.loadSchema('core');

    const eventBus = new EventBus({ logger });
    validatedDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository: {
        getEventDefinition: () => null,
      },
      schemaValidator,
      logger,
    });
    safeDispatcher = new TestSafeEventDispatcher(validatedDispatcher, logger);
    eventDispatchService = new EventDispatchService({
      safeEventDispatcher: safeDispatcher,
      logger,
    });
    serviceSetup = new ServiceSetup();
  });

  it('constructs WorldInitializer with validated dependencies', () => {
    const entityManager = {
      createEntityInstance: () => ({ id: 'entity-1' }),
      hasBatchSupport: () => false,
    };
    const worldContext = { worldName: 'integration-world' };
    const scopeRegistry = new TestScopeRegistry(logger);

    const initializer = new WorldInitializer({
      entityManager,
      worldContext,
      gameDataRepository: repository,
      validatedEventDispatcher: validatedDispatcher,
      eventDispatchService,
      logger,
      scopeRegistry,
      config: {
        isFeatureEnabled: () => true,
        getValue: () => undefined,
      },
    });

    expect(initializer.getWorldContext()).toBe(worldContext);
    expect(logger.error).not.toHaveBeenCalled();
    expect(scopeRegistry.initializedWith).toHaveLength(0);
  });

  it('throws WorldInitializationError when repository is missing required methods', () => {
    const entityManager = { createEntityInstance: () => ({ id: '1' }) };
    const worldContext = {};
    const scopeRegistry = new TestScopeRegistry(logger);

    expect(() => {
      return new WorldInitializer({
        entityManager,
        worldContext,
        gameDataRepository: {},
        validatedEventDispatcher: validatedDispatcher,
        eventDispatchService,
        logger,
        scopeRegistry,
      });
    }).toThrow('WorldInitializer requires an IGameDataRepository');
  });

  it('requires safe event dispatcher via assertPresent', () => {
    expect(() => {
      return new EventDispatchService({
        safeEventDispatcher: null,
        logger,
      });
    }).toThrow('EventDispatchService: safeEventDispatcher is required');

    const service = new EventDispatchService({
      safeEventDispatcher: safeDispatcher,
      logger,
    });

    return service.dispatchWithLogging('test_event', { foo: 'bar' }, 'context');
  });

  it('blocks invalid actor identifiers through CommandProcessor', async () => {
    const processor = new CommandProcessor({
      safeEventDispatcher: safeDispatcher,
      eventDispatchService,
      logger,
    });

    const actor = { id: '   ' }; // triggers assertValidId failure
    const turnAction = {
      actionDefinitionId: 'action:test',
      commandString: 'do',
    };

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(false);
    const errorCall = logger.error.mock.calls.find(([message]) =>
      String(message).includes('Input validation failed')
    );
    expect(errorCall).toBeDefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('validates dependency specifications via ServiceSetup and withValidatedDeps', () => {
    class RealisticService {
      constructor({ logger: serviceLogger }) {
        this.logger = serviceLogger;
      }
    }

    const DecoratedService = withValidatedDeps(RealisticService, (deps) => [
      {
        dependency: deps.logger,
        name: 'DecoratedService.logger',
        methods: ['debug', 'info', 'warn', 'error'],
      },
      {
        dependency: deps.execute,
        name: 'DecoratedService.execute',
        isFunction: true,
      },
    ]);

    const prefixedLogger = serviceSetup.setupService(
      'IntegrationService',
      logger,
      {
        execute: {
          value: () => true,
          isFunction: true,
        },
        audit: {
          value: {
            record: () => {},
          },
          requiredMethods: ['record'],
        },
      }
    );

    const service = new DecoratedService({
      logger: prefixedLogger,
      execute: () => true,
    });
    expect(service.logger).toBe(prefixedLogger);

    expect(() =>
      serviceSetup.validateDeps('BrokenService', logger, {
        missingMethod: {
          value: {},
          requiredMethods: ['notHere'],
        },
      })
    ).toThrow(InvalidArgumentError);
  });
});
