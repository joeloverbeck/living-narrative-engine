import { describe, it, expect } from '@jest/globals';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import { CoreMotivationsCacheManager } from '../../../src/characterBuilder/cache/CoreMotivationsCacheManager.js';
import { validateInstanceAndComponent } from '../../../src/utils/idValidation.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { WorldInitializationError } from '../../../src/errors/InitializationError.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(message, metadata) {
    this.debugEntries.push({ message, metadata });
  }

  info(message, metadata) {
    this.infoEntries.push({ message, metadata });
  }

  warn(message, metadata) {
    this.warnEntries.push({ message, metadata });
  }

  error(message, metadata) {
    this.errorEntries.push({ message, metadata });
  }
}

class RecordingEventBus {
  constructor() {
    this.events = [];
  }

  dispatch(event) {
    // Accept full event object with type, payload, timestamp
    this.events.push(event);
  }
}

describe('dependency utilities working through real service flows', () => {
  describe('ServiceSetup orchestration', () => {
    it('creates prefixed loggers when dependencies satisfy validation', () => {
      const baseLogger = new RecordingLogger();
      const setup = new ServiceSetup();
      const dependencies = {
        queue: { value: { enqueue(item) { this.last = item; } }, requiredMethods: ['enqueue'] },
        factory: { value: (input) => ({ built: input }), isFunction: true },
      };

      const prefixed = setup.setupService('PromptScheduler', baseLogger, dependencies);
      prefixed.debug('initialized');

      expect(baseLogger.debugEntries).toEqual([
        { message: 'PromptScheduler: initialized', metadata: undefined },
      ]);
      expect(baseLogger.errorEntries).toHaveLength(0);
    });

    it('reports missing dependencies with InvalidArgumentError and logger output', () => {
      const baseLogger = new RecordingLogger();
      const setup = new ServiceSetup();

      expect(() =>
        setup.setupService('PromptScheduler', baseLogger, {
          cache: { value: null },
        })
      ).toThrow(InvalidArgumentError);

      expect(baseLogger.errorEntries[0]?.message).toBe(
        'PromptScheduler: Missing required dependency: PromptScheduler: cache.'
      );
    });

    it('validates function dependencies and required methods together', () => {
      const baseLogger = new RecordingLogger();
      const setup = new ServiceSetup();

      expect(() =>
        setup.setupService('PromptScheduler', baseLogger, {
          builder: { value: {}, isFunction: true },
        })
      ).toThrow(InvalidArgumentError);

      expect(baseLogger.errorEntries.at(-1)?.message).toBe(
        "PromptScheduler: Dependency 'PromptScheduler: builder' must be a function, but got object."
      );

      expect(() =>
        setup.setupService('PromptScheduler', baseLogger, {
          repository: { value: {}, requiredMethods: ['save'] },
        })
      ).toThrow(InvalidArgumentError);

      expect(baseLogger.errorEntries.at(-1)?.message).toBe(
        "PromptScheduler: Invalid or missing method 'save' on dependency 'PromptScheduler: repository'."
      );
    });

    it('gracefully handles empty dependency specifications', () => {
      const baseLogger = new RecordingLogger();
      const setup = new ServiceSetup();

      const prefixed = setup.setupService('PromptScheduler', baseLogger, undefined);
      prefixed.info('ready');

      expect(baseLogger.infoEntries[0]?.message).toBe('PromptScheduler: ready');
    });
  });

  describe('CoreMotivationsCacheManager validation hooks', () => {
    const createManager = () => {
      const logger = new RecordingLogger();
      const eventBus = new RecordingEventBus();
      const manager = new CoreMotivationsCacheManager({
        logger,
        eventBus,
        schemaValidator: {
          validateAgainstSchema() {
            // accept all payloads during the test
            return true;
          },
        },
      });
      return { logger, eventBus, manager };
    };

    it('accepts well formed cache writes and dispatches lifecycle events', () => {
      const { logger, eventBus, manager } = createManager();

      manager.set('motivation-1', { id: 'motivation-1', label: 'Driven' }, 'motivations');

      expect(logger.errorEntries).toHaveLength(0);
      expect(eventBus.events[0]?.type).toBe('core:cache_initialized');
      expect(eventBus.events[0]?.payload).toEqual({
        maxSize: 100,
        ttlConfig: {
          concepts: 600000,
          directions: 600000,
          cliches: 1800000,
          motivations: null,
        },
        cacheManagerType: 'CoreMotivationsCacheManager',
      });
      expect(manager.get('motivation-1')).toEqual({
        id: 'motivation-1',
        label: 'Driven',
      });
    });

    it('surfaces invalid cache keys and payloads through InvalidArgumentError', () => {
      const { logger, manager } = createManager();

      expect(() => manager.set('  ', { id: 'motivation-2' }, 'motivations')).toThrow(
        InvalidArgumentError
      );
      expect(logger.errorEntries[0]?.message).toBe(
        "CoreMotivationsCacheManager.set: Invalid key '  '. Expected non-blank string."
      );

      expect(() => manager.set('motivation-2', null, 'motivations')).toThrow(
        InvalidArgumentError
      );
      expect(logger.errorEntries.at(-1)?.message).toBe('data');
    });
  });

  describe('ID validation flows', () => {
    it('integrates assertValidId and assertNonBlankString through idValidation helpers', () => {
      const logger = new RecordingLogger();

      expect(() =>
        validateInstanceAndComponent('actor-1', 'core:notes', logger, 'idValidation')
      ).not.toThrow();

      expect(() =>
        validateInstanceAndComponent('', 'core:notes', logger, 'idValidation')
      ).toThrow(InvalidArgumentError);

      const lastError = logger.errorEntries.at(-1);
      expect(lastError?.message).toBeInstanceOf(Error);
      expect(lastError?.message.message).toContain("idValidation: Invalid ID ''");
    });
  });

  describe('WorldInitializer dependency enforcement', () => {
    class MinimalResolver {
      async resolveByTag() {
        return [];
      }
    }

    class MinimalEntityManager {
      createEntityInstance() {
        return { id: 'entity-1' };
      }
    }

    class MinimalDispatcher {
      dispatch() {}
    }

    class MinimalEventDispatchService {
      dispatchWithLogging() {}
    }

    class MinimalScopeRegistry {
      initialize() {}
    }

    it('constructs successfully when all collaborators satisfy assertions', () => {
      const initializer = new WorldInitializer({
        entityManager: new MinimalEntityManager(),
        worldContext: {},
        gameDataRepository: {
          getWorld() {
            return {};
          },
          getEntityInstanceDefinition() {
            return {};
          },
          get() {
            return {};
          },
        },
        validatedEventDispatcher: new MinimalDispatcher(),
        eventDispatchService: new MinimalEventDispatchService(),
        logger: new RecordingLogger(),
        scopeRegistry: new MinimalScopeRegistry(),
        config: {},
      });

      expect(initializer.getWorldContext()).toEqual({});
    });

    it('raises WorldInitializationError when repository is missing required methods', () => {
      expect(() =>
        new WorldInitializer({
          entityManager: new MinimalEntityManager(),
          worldContext: {},
          gameDataRepository: {
            getWorld() {
              return {};
            },
          },
          validatedEventDispatcher: new MinimalDispatcher(),
          eventDispatchService: new MinimalEventDispatchService(),
          logger: new RecordingLogger(),
          scopeRegistry: new MinimalScopeRegistry(),
          config: {},
        })
      ).toThrow(WorldInitializationError);
    });
  });
});
