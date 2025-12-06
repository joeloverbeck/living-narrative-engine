import { describe, it, expect, beforeEach } from '@jest/globals';
import createArrayIterationResolver from '../../../src/scopeDsl/nodes/arrayIterationResolver.js';
import ScopeDslErrorHandler from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';
import { ScopeDslError } from '../../../src/scopeDsl/errors/scopeDslError.js';

class RecordingErrorHandler {
  constructor() {
    this.records = [];
  }

  handleError(error, context, resolverName, code) {
    this.records.push({
      message: error instanceof Error ? error.message : String(error),
      context,
      resolverName,
      code,
    });
  }

  getErrorBuffer() {
    return [...this.records];
  }
}

class RecordingTrace {
  constructor() {
    this.steps = [];
  }

  addStep(step) {
    this.steps.push(step);
  }
}

class RecordingClothingAccessibilityService {
  constructor(resolver) {
    this.resolver = resolver;
    this.calls = [];
  }

  getAccessibleItems(entityId, options) {
    this.calls.push({ entityId, options });
    return this.resolver(entityId, options);
  }
}

class MemoryLogger {
  constructor() {
    this.errorLogs = [];
    this.warnLogs = [];
    this.infoLogs = [];
    this.debugLogs = [];
  }

  error(message, meta) {
    this.errorLogs.push({ message, meta });
  }

  warn(message, meta) {
    this.warnLogs.push({ message, meta });
  }

  info(message, meta) {
    this.infoLogs.push({ message, meta });
  }

  debug(message, meta) {
    this.debugLogs.push({ message, meta });
  }
}

/**
 * Creates a simple dispatcher that always returns the provided results set.
 *
 * @param {Set<any>} results - The set to return when resolve is invoked.
 * @returns {{ resolve: () => Set<any> }} Dispatcher object compatible with resolver expectations.
 */
function createStaticDispatcher(results) {
  return {
    resolve: () => results,
  };
}

describe('ArrayIterationResolver integration coverage', () => {
  let actorEntity;

  beforeEach(() => {
    actorEntity = { id: 'actor:test' };
  });

  describe('dependency validation', () => {
    it('validates error handler contract when provided', () => {
      expect(() => createArrayIterationResolver({ errorHandler: {} })).toThrow(
        InvalidArgumentError
      );
    });

    it('validates clothing accessibility service contract when provided', () => {
      expect(() =>
        createArrayIterationResolver({
          clothingAccessibilityService: {},
        })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('context validation and basic flattening', () => {
    it('throws when actorEntity is missing and reports through the error handler', () => {
      const errorHandler = new RecordingErrorHandler();
      const resolver = createArrayIterationResolver({ errorHandler });
      const node = { type: 'ArrayIterationStep', parent: { type: 'Source' } };

      expect(() =>
        resolver.resolve(node, {
          dispatcher: createStaticDispatcher(new Set()),
          trace: new RecordingTrace(),
        })
      ).toThrow('ArrayIterationResolver: actorEntity is missing from context');

      expect(errorHandler.getErrorBuffer()).toHaveLength(1);
      const [record] = errorHandler.getErrorBuffer();
      expect(record.resolverName).toBe('ArrayIterationResolver');
      expect(record.code).toBe(ErrorCodes.MISSING_ACTOR);
    });

    it('flattens arrays, passes through source values, and logs missing clothing service', () => {
      const errorHandler = new RecordingErrorHandler();
      const resolver = createArrayIterationResolver({ errorHandler });
      const trace = new RecordingTrace();
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Source', id: 'src:node' },
      };

      const parentResults = new Set([
        ['item:hat', null, 'item:scarf'],
        {
          __isClothingAccessObject: true,
          entityId: 'entity:clothed',
          mode: 'topmost',
        },
        null,
        undefined,
        'entity:direct',
      ]);

      const result = resolver.resolve(node, {
        dispatcher: createStaticDispatcher(parentResults),
        actorEntity,
        trace,
      });

      expect(Array.from(result)).toEqual([
        'item:hat',
        'item:scarf',
        'entity:direct',
      ]);

      expect(trace.steps[0]).toContain(
        'No clothing accessibility service available'
      );
      expect(trace.steps.pop()).toBe(
        'ArrayIterationResolver flattened 0 elements'
      );

      const records = errorHandler.getErrorBuffer();
      expect(records).toHaveLength(1);
      expect(records[0].code).toBe(ErrorCodes.SERVICE_NOT_FOUND);
    });
  });

  describe('pass-through behaviours for nested resolvers', () => {
    it('allows nested array iteration results and entity step passthroughs', () => {
      const errorHandler = new RecordingErrorHandler();
      const resolver = createArrayIterationResolver({ errorHandler });
      const trace = new RecordingTrace();

      const nestedNode = {
        type: 'ArrayIterationStep',
        parent: { type: 'ArrayIterationStep' },
      };
      const nestedResults = resolver.resolve(nestedNode, {
        dispatcher: createStaticDispatcher(
          new Set(['entity:nested-1', 'entity:nested-2'])
        ),
        actorEntity,
        trace,
      });

      expect(new Set(nestedResults)).toEqual(
        new Set(['entity:nested-1', 'entity:nested-2'])
      );

      const entityStepNode = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step', field: 'entities', param: 'inventory' },
      };
      const entityResults = resolver.resolve(entityStepNode, {
        dispatcher: createStaticDispatcher(new Set(['entity:inventory-1'])),
        actorEntity,
        trace,
      });

      expect(Array.from(entityResults)).toEqual(['entity:inventory-1']);
    });

    it('logs unexpected non-array results through error handler and continues', () => {
      const errorHandler = new RecordingErrorHandler();
      const resolver = createArrayIterationResolver({ errorHandler });
      const trace = new RecordingTrace();
      const node = { type: 'ArrayIterationStep', parent: { type: 'Filter' } };

      const outcome = resolver.resolve(node, {
        dispatcher: createStaticDispatcher(new Set(['unexpected-value'])),
        actorEntity,
        trace,
      });

      expect(outcome.size).toBe(0);
      const [record] = errorHandler.getErrorBuffer();
      expect(record.code).toBe(ErrorCodes.DATA_TYPE_MISMATCH);
      expect(record.context.actualType).toBe('string');
    });
  });

  describe('clothing accessibility integration', () => {
    it('delegates to clothing accessibility service for access objects', () => {
      const clothingService = new RecordingClothingAccessibilityService(() => [
        'item:cloak',
        'item:vest',
      ]);
      const trace = new RecordingTrace();
      const errorHandler = new RecordingErrorHandler();
      const resolver = createArrayIterationResolver({
        clothingAccessibilityService: clothingService,
        errorHandler,
      });

      const clothingNode = {
        type: 'ArrayIterationStep',
        parent: { type: 'Source', id: 'clothing:node' },
      };

      const result = resolver.resolve(clothingNode, {
        dispatcher: createStaticDispatcher(
          new Set([
            {
              __isClothingAccessObject: true,
              entityId: 'entity:hero',
              mode: 'custom-mode',
            },
          ])
        ),
        actorEntity,
        trace,
      });

      expect(Array.from(result)).toEqual(['item:cloak', 'item:vest']);
      expect(clothingService.calls).toHaveLength(1);
      expect(clothingService.calls[0].entityId).toBe('entity:hero');
      expect(clothingService.calls[0].options).toMatchObject({
        mode: 'custom-mode',
        context: 'removal',
        sortByPriority: true,
      });
      expect(trace.steps).toContain(
        'Retrieved 2 accessible items for mode: custom-mode'
      );
      expect(errorHandler.getErrorBuffer()).toHaveLength(0);
    });

    it('enforces clothing access array limits and records overflow errors', () => {
      const clothingItems = Array.from(
        { length: 10001 },
        (_, index) => `item:${index}`
      );
      const errorHandler = new RecordingErrorHandler();
      const clothingService = new RecordingClothingAccessibilityService(
        () => clothingItems
      );
      const resolver = createArrayIterationResolver({
        clothingAccessibilityService: clothingService,
        errorHandler,
      });
      const trace = new RecordingTrace();

      const node = { type: 'ArrayIterationStep', parent: { type: 'Source' } };
      const result = resolver.resolve(node, {
        dispatcher: createStaticDispatcher(
          new Set([
            {
              __isClothingAccessObject: true,
              entityId: 'entity:limit',
              mode: 'topmost',
            },
          ])
        ),
        actorEntity,
        trace,
      });

      expect(result.size).toBe(10000);
      const [overflowRecord] = errorHandler.getErrorBuffer();
      expect(overflowRecord.code).toBe(ErrorCodes.MEMORY_LIMIT);
      expect(trace.steps.pop()).toBe(
        'ArrayIterationResolver flattened 10001 elements'
      );
    });

    it('propagates clothing accessibility errors through ScopeDslErrorHandler', () => {
      const logger = new MemoryLogger();
      const errorHandler = new ScopeDslErrorHandler({
        logger,
        config: { isDevelopment: true, maxBufferSize: 5 },
      });
      const clothingService = new RecordingClothingAccessibilityService(() => {
        throw new Error('gateway failure');
      });
      const resolver = createArrayIterationResolver({
        clothingAccessibilityService: clothingService,
        errorHandler,
      });

      const node = { type: 'ArrayIterationStep', parent: { type: 'Source' } };

      expect(() =>
        resolver.resolve(node, {
          dispatcher: createStaticDispatcher(
            new Set([
              {
                __isClothingAccessObject: true,
                entityId: 'entity:error',
                mode: 'topmost',
              },
            ])
          ),
          actorEntity,
          trace: new RecordingTrace(),
        })
      ).toThrow(ScopeDslError);

      const buffered = errorHandler.getErrorBuffer();
      expect(buffered.length).toBeGreaterThan(0);
      expect(buffered[0].code).toBe(ErrorCodes.CLOTHING_ACCESS_FAILED);
      expect(buffered[0].message).toContain('gateway failure');
      expect(logger.errorLogs.length).toBeGreaterThan(0);
    });
  });

  describe('regular array handling', () => {
    it('reports oversized arrays but still flattens their content', () => {
      const logger = new MemoryLogger();
      const errorHandler = new ScopeDslErrorHandler({
        logger,
        config: { isDevelopment: true, maxBufferSize: 10 },
      });
      const resolver = createArrayIterationResolver({ errorHandler });
      const node = { type: 'ArrayIterationStep', parent: { type: 'Source' } };
      const largeArray = Array.from(
        { length: 10002 },
        (_, index) => `value:${index}`
      );

      const outcome = resolver.resolve(node, {
        dispatcher: createStaticDispatcher(new Set([largeArray])),
        actorEntity,
        trace: new RecordingTrace(),
      });

      expect(outcome.size).toBe(10002);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer[0].code).toBe(ErrorCodes.MEMORY_LIMIT);
    });
  });
});
