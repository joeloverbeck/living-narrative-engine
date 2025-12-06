import { describe, it, expect } from '@jest/globals';
import {
  assertFunction,
  assertMethods,
  validateDependencies,
} from '../../../src/utils/dependencyUtils.js';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import SchemaLoader from '../../../src/loaders/schemaLoader.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';

class MemoryLogger {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.entries = { debug: [], info: [], warn: [], error: [] };
  }

  #record(level, message, metadata) {
    this.entries[level].push({ message, metadata });
  }

  debug(message, metadata) {
    this.#record('debug', `${this.prefix}${message}`, metadata);
  }

  info(message, metadata) {
    this.#record('info', `${this.prefix}${message}`, metadata);
  }

  warn(message, metadata) {
    this.#record('warn', `${this.prefix}${message}`, metadata);
  }

  error(message, metadata) {
    this.#record('error', `${this.prefix}${message}`, metadata);
  }
}

describe('dependencyUtils default parameter integrations', () => {
  describe('assertFunction defaults with EventDispatchService', () => {
    it('uses the default Error type and integrates with EventDispatchService', async () => {
      expect(() =>
        assertFunction({}, 'dispatch', 'Dispatcher must implement dispatch()')
      ).toThrow(Error);

      const logger = new MemoryLogger('dispatcher: ');
      const invalidDispatcher = {};
      expect(() =>
        assertFunction(
          invalidDispatcher,
          'dispatch',
          'Dispatcher must implement dispatch()',
          undefined,
          logger
        )
      ).toThrow(Error);
      expect(logger.entries.error.at(-1)?.message).toContain(
        'Dispatcher must implement dispatch()'
      );

      const validDispatcher = {
        dispatch: jest.fn(async () => true),
      };

      expect(() =>
        assertFunction(
          validDispatcher,
          'dispatch',
          'Dispatcher ready',
          undefined,
          logger
        )
      ).not.toThrow();

      const service = new EventDispatchService({
        safeEventDispatcher: validDispatcher,
        logger,
      });

      await service.dispatchWithLogging('integration:event', { ok: true });

      expect(validDispatcher.dispatch).toHaveBeenCalledWith(
        'integration:event',
        { ok: true },
        {}
      );
      expect(
        logger.entries.debug.some(({ message }) =>
          message.includes("Dispatched 'integration:event'")
        )
      ).toBe(true);
    });
  });

  describe('assertMethods defaults with SchemaLoader', () => {
    it('validates configuration dependencies without custom errors', async () => {
      const logger = new MemoryLogger('schema: ');

      expect(() =>
        assertMethods(
          {},
          ['getSchemaFiles'],
          'SchemaLoader requires configuration helpers'
        )
      ).toThrow(Error);

      const configuration = {
        getSchemaFiles: () => ['example.schema.json'],
      };
      const pathResolver = {
        resolveSchemaPath: (filename) => filename,
      };
      const fetcher = {
        fetch: jest.fn(async () => ({
          $id: 'schema://example',
          type: 'object',
          properties: {},
        })),
      };
      const validator = {
        addSchema: jest.fn(),
        isSchemaLoaded: jest.fn(() => false),
        addSchemas: jest.fn(async () => undefined),
        validateSchemaRefs: jest.fn(() => true),
        getLoadedSchemaIds: jest.fn(() => ['schema://example']),
      };

      const loader = new SchemaLoader(
        configuration,
        pathResolver,
        fetcher,
        validator,
        logger
      );

      await loader.loadAndCompileAllSchemas();

      expect(fetcher.fetch).toHaveBeenCalledTimes(1);
      expect(validator.addSchemas).toHaveBeenCalledWith([
        expect.objectContaining({ $id: 'schema://example' }),
      ]);
      expect(
        logger.entries.debug.some(({ message }) =>
          message.includes('Batch schema registration complete')
        )
      ).toBe(true);
    });
  });

  describe('validateDependencies null integration', () => {
    it('returns early for null iterables while services interact', async () => {
      const baseLogger = new MemoryLogger('service: ');
      const setup = new ServiceSetup();
      const safeEventDispatcher = {
        dispatch: jest.fn(async () => true),
      };

      const prefixedLogger = setup.setupService('DispatchBridge', baseLogger, {
        dispatcher: {
          value: safeEventDispatcher,
          requiredMethods: ['dispatch'],
        },
      });

      expect(() => validateDependencies(null, prefixedLogger)).not.toThrow();
      expect(baseLogger.entries.error).toHaveLength(0);

      const service = new EventDispatchService({
        safeEventDispatcher,
        logger: prefixedLogger,
      });

      await service.dispatchWithLogging('optional:event', { id: 1 });

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'optional:event',
        { id: 1 },
        {}
      );
      expect(
        baseLogger.entries.debug.some(({ message }) =>
          message.includes('DispatchBridge: Dispatched')
        )
      ).toBe(true);
    });
  });
});
