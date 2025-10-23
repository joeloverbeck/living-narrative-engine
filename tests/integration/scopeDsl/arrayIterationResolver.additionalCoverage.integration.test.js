import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import createArrayIterationResolver from '../../../src/scopeDsl/nodes/arrayIterationResolver.js';

class RecordingErrorHandler {
  constructor() {
    this.records = [];
  }

  handleError(error, context, resolverName, code) {
    this.records.push({ error, context, resolverName, code });
  }

  getErrorBuffer() {
    return [...this.records];
  }
}

class ThrowingClothingService {
  constructor() {
    this.calls = [];
  }

  getAccessibleItems(entityId, options) {
    this.calls.push({ entityId, options });
    throw new Error('access failure');
  }
}

class MassiveClothingService {
  constructor(size) {
    this.size = size;
    this.calls = [];
  }

  getAccessibleItems(entityId, options) {
    this.calls.push({ entityId, options });
    return Array.from({ length: this.size }, (_, index) => `item:${index}`);
  }
}

function createDispatcher(results) {
  return {
    resolve() {
      return results;
    },
  };
}

describe('ArrayIterationResolver integration supplemental coverage', () => {
  let actorEntity;

  beforeEach(() => {
    actorEntity = { id: 'actor:coverage' };
  });

  it('exposes accurate canResolve semantics', () => {
    const resolver = createArrayIterationResolver();

    expect(resolver.canResolve({ type: 'ArrayIterationStep' })).toBe(true);
    expect(resolver.canResolve({ type: 'Other' })).toBe(false);
  });

  it('prefers runtime logger debug when provided', () => {
    const resolver = createArrayIterationResolver();
    const debug = jest.fn();
    const runtimeLogger = { debug };

    const node = { type: 'ArrayIterationStep', parent: { type: 'Source' } };
    const parentResults = new Set([["value:a", "value:b"]]);

    const result = resolver.resolve(node, {
      actorEntity,
      dispatcher: createDispatcher(parentResults),
      runtimeCtx: { logger: runtimeLogger },
      trace: { addStep: jest.fn() },
    });

    expect(Array.from(result)).toEqual(['value:a', 'value:b']);
    expect(debug).toHaveBeenCalled();
  });

  it('recovers from clothing access failures when error handler does not throw', () => {
    const errorHandler = new RecordingErrorHandler();
    const clothingService = new ThrowingClothingService();
    const resolver = createArrayIterationResolver({
      errorHandler,
      clothingAccessibilityService: clothingService,
    });

    const trace = { steps: [], addStep(step) { this.steps.push(step); } };
    const node = { type: 'ArrayIterationStep', parent: { type: 'Source' } };
    const parentResults = new Set([
      { __isClothingAccessObject: true, entityId: 'entity:trace', mode: 'topmost' },
    ]);

    const result = resolver.resolve(node, {
      actorEntity,
      dispatcher: createDispatcher(parentResults),
      trace,
    });

    expect(Array.from(result)).toEqual([]);
    expect(clothingService.calls).toHaveLength(1);
    expect(trace.steps).toContain('Clothing access failed: access failure');
    const [record] = errorHandler.getErrorBuffer();
    expect(record.code).toBeDefined();
    expect(record.resolverName).toBe('ArrayIterationResolver');
  });

  it('recovers from clothing access failures without trace or error handlers', () => {
    const clothingService = new ThrowingClothingService();
    const resolver = createArrayIterationResolver({
      clothingAccessibilityService: clothingService,
    });

    const node = { type: 'ArrayIterationStep', parent: { type: 'Source' } };
    const parentResults = new Set([
      { __isClothingAccessObject: true, entityId: 'entity:no-handlers' },
    ]);

    const result = resolver.resolve(node, {
      actorEntity,
      dispatcher: createDispatcher(parentResults),
    });

    expect(Array.from(result)).toEqual([]);
    expect(clothingService.calls).toHaveLength(1);
  });

  it('passes through values from scope reference parents', () => {
    const resolver = createArrayIterationResolver();
    const node = { type: 'ArrayIterationStep', parent: { type: 'ScopeReference' } };
    const parentResults = new Set(['entity:scope-pass']);

    const result = resolver.resolve(node, {
      actorEntity,
      dispatcher: createDispatcher(parentResults),
      trace: { addStep: jest.fn() },
    });

    expect(Array.from(result)).toEqual(['entity:scope-pass']);
  });

  it('falls back gracefully when console.debug is unavailable', () => {
    const originalConsole = global.console;
    const fakeConsole = { error: jest.fn() };
    global.console = fakeConsole;

    try {
      const resolver = createArrayIterationResolver();
      const node = { type: 'ArrayIterationStep', parent: { type: 'Source' } };
      const parentResults = new Set([[null, undefined, 42]]);

      const result = resolver.resolve(node, {
        actorEntity,
        dispatcher: createDispatcher(parentResults),
      });

      expect(Array.from(result)).toEqual([42]);
      expect(fakeConsole.error).not.toHaveBeenCalled();
    } finally {
      global.console = originalConsole;
    }
  });

  it('returns empty results when clothing service is absent without trace context', () => {
    const resolver = createArrayIterationResolver();
    const node = { type: 'ArrayIterationStep', parent: { type: 'Source' } };
    const parentResults = new Set([
      { __isClothingAccessObject: true, entityId: 'entity:missing-service' },
    ]);

    const outcome = resolver.resolve(node, {
      actorEntity,
      dispatcher: createDispatcher(parentResults),
    });

    expect(Array.from(outcome)).toEqual([]);
  });

  it('returns an empty set when dispatcher is not provided', () => {
    const resolver = createArrayIterationResolver();
    const node = { type: 'ArrayIterationStep', parent: { type: 'Source' } };

    const outcome = resolver.resolve(node, { actorEntity });

    expect(outcome instanceof Set).toBe(true);
    expect(outcome.size).toBe(0);
  });

  it('handles oversized clothing access responses without an error handler', () => {
    const clothingService = new MassiveClothingService(10005);
    const resolver = createArrayIterationResolver({
      clothingAccessibilityService: clothingService,
    });

    const node = { type: 'ArrayIterationStep', parent: { type: 'Source' } };
    const result = resolver.resolve(node, {
      actorEntity,
      dispatcher: createDispatcher(
        new Set([{ __isClothingAccessObject: true, entityId: 'entity:massive' }])
      ),
    });

    expect(result.size).toBe(10000);
    expect(clothingService.calls).toHaveLength(1);
  });

  it('skips pass-through branches when parent values are null', () => {
    const resolver = createArrayIterationResolver();

    const sourceOutcome = resolver.resolve(
      { type: 'ArrayIterationStep', parent: { type: 'Source' } },
      {
        actorEntity,
        dispatcher: createDispatcher(new Set([null, undefined])),
      }
    );
    expect(sourceOutcome.size).toBe(0);

    const nestedOutcome = resolver.resolve(
      { type: 'ArrayIterationStep', parent: { type: 'ArrayIterationStep' } },
      {
        actorEntity,
        dispatcher: createDispatcher(new Set([null])),
      }
    );
    expect(nestedOutcome.size).toBe(0);

    const scopeReferenceOutcome = resolver.resolve(
      { type: 'ArrayIterationStep', parent: { type: 'ScopeReference' } },
      {
        actorEntity,
        dispatcher: createDispatcher(new Set([undefined])),
      }
    );
    expect(scopeReferenceOutcome.size).toBe(0);

    const stepOutcome = resolver.resolve(
      {
        type: 'ArrayIterationStep',
        parent: { type: 'Step', field: 'entities', param: 'inventory' },
      },
      {
        actorEntity,
        dispatcher: createDispatcher(new Set([null])),
      }
    );
    expect(stepOutcome.size).toBe(0);
  });

  it('throws when actor context is missing without an error handler', () => {
    const resolver = createArrayIterationResolver();
    const node = { type: 'ArrayIterationStep', parent: { type: 'Source' } };

    expect(() => resolver.resolve(node, { dispatcher: createDispatcher(new Set()) }))
      .toThrow("ArrayIterationResolver: actorEntity is missing from context");
  });

  it('handles clothing access success without trace instrumentation', () => {
    const clothingService = new MassiveClothingService(2);
    const resolver = createArrayIterationResolver({
      clothingAccessibilityService: clothingService,
    });

    const node = { type: 'ArrayIterationStep', parent: { type: 'Source' } };
    const result = resolver.resolve(node, {
      actorEntity,
      dispatcher: createDispatcher(
        new Set([{ __isClothingAccessObject: true, entityId: 'entity:success' }])
      ),
    });

    expect(Array.from(result)).toEqual(['item:0', 'item:1']);
  });
});
