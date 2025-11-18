import ContextMerger from '../../../src/scopeDsl/core/contextMerger.js';
import ContextValidator from '../../../src/scopeDsl/core/contextValidator.js';
import createCycleDetector from '../../../src/scopeDsl/core/cycleDetector.js';
import createDepthGuard from '../../../src/scopeDsl/core/depthGuard.js';

/**
 * Creates a base scope resolution context with all required critical properties.
 *
 * @param {Partial<Record<string, any>>} overrides
 * @returns {Record<string, any>}
 */
function createBaseContext(overrides = {}) {
  const baseContext = {
    actorEntity: { id: 'actor-1', components: new Map() },
    runtimeCtx: {
      entityManager: {
        getEntity() {
          return null;
        },
      },
    },
    dispatcher: {
      resolve() {
        return new Set(['base']);
      },
    },
    cycleDetector: createCycleDetector(),
    depthGuard: createDepthGuard(10),
    depth: 0,
    trace: { logs: [] },
    fromBase: true,
  };

  return { ...baseContext, ...overrides };
}

describe('Scope-DSL context validation and merging integration', () => {
  let merger;

  beforeEach(() => {
    merger = new ContextMerger();
  });

  test('merges contexts while preserving critical dependencies and overlay data', () => {
    const baseContext = createBaseContext({
      runtimeCtx: {
        entityManager: {
          getEntity(id) {
            return { id };
          },
        },
        fromBase: true,
      },
      customFlag: 'base-only',
    });

    const overlayContext = {
      runtimeCtx: {
        ...baseContext.runtimeCtx,
        fromOverlay: true,
      },
      dispatcher: {
        resolve() {
          return new Set(['overlay']);
        },
      },
      depth: 4,
      trace: { overlay: true },
      overlayMetadata: { step: 'merge' },
    };

    const merged = merger.merge(baseContext, overlayContext);

    expect(merged.actorEntity).toBe(baseContext.actorEntity);
    expect(merged.runtimeCtx.fromOverlay).toBe(true);
    expect(merged.dispatcher).toBe(overlayContext.dispatcher);
    expect(merged.overlayMetadata).toEqual({ step: 'merge' });
    expect(merged.customFlag).toBe('base-only');
    expect(merged.depth).toBe(4);
    expect(merged.trace).toBe(overlayContext.trace);
    expect(merger.getValidator().hasAllCriticalProperties(merged)).toBe(true);

    const criticalProperties = merger.getCriticalProperties();
    expect(criticalProperties).toEqual(
      expect.arrayContaining([
        'actorEntity',
        'runtimeCtx',
        'dispatcher',
        'cycleDetector',
        'depthGuard',
      ])
    );

    criticalProperties.push('should-not-affect-internal-state');
    expect(merger.getCriticalProperties()).not.toContain(
      'should-not-affect-internal-state'
    );
  });

  test('throws when base context is not an object', () => {
    expect(() => merger.merge(/** @type {*} */ ('invalid'), {})).toThrow(
      '[CRITICAL] Context must be a valid object'
    );
  });

  test('throws when base context is missing critical properties', () => {
    const baseContext = createBaseContext();
    delete baseContext.dispatcher;

    expect(() => merger.merge(baseContext, {})).toThrow(
      '[CRITICAL] Context is missing required properties: dispatcher'
    );
  });

  test('throws when base context has invalid actor entity identifier', () => {
    const baseContext = createBaseContext({ actorEntity: { id: 42 } });

    expect(() => merger.merge(baseContext, {})).toThrow(
      '[CRITICAL] actorEntity must have an id property'
    );
  });

  test('throws when base context runtime context is invalid', () => {
    const baseContext = createBaseContext({ runtimeCtx: 'invalid-runtime' });

    expect(() => merger.merge(baseContext, {})).toThrow(
      '[CRITICAL] runtimeCtx must be an object'
    );
  });

  test('throws when base context dispatcher lacks resolve implementation', () => {
    const baseContext = createBaseContext({ dispatcher: { name: 'broken' } });

    expect(() => merger.merge(baseContext, {})).toThrow(
      '[CRITICAL] dispatcher must have a resolve method'
    );
  });

  test('throws when base context depth is negative', () => {
    const baseContext = createBaseContext({ depth: -1 });

    expect(() => merger.merge(baseContext, {})).toThrow(
      '[CRITICAL] depth must be a non-negative number'
    );
  });

  test('throws when base context cycle detector is malformed', () => {
    const baseContext = createBaseContext({ cycleDetector: { enter() {} } });

    expect(() => merger.merge(baseContext, {})).toThrow(
      '[CRITICAL] cycleDetector must have enter and leave methods'
    );
  });

  test('throws when base context depth guard is malformed', () => {
    const baseContext = createBaseContext({ depthGuard: {} });

    expect(() => merger.merge(baseContext, {})).toThrow(
      '[CRITICAL] depthGuard must have an ensure method'
    );
  });

  test('throws when overlay context is not an object', () => {
    const baseContext = createBaseContext();

    expect(() => merger.merge(baseContext, /** @type {*} */ (42))).toThrow(
      '[CRITICAL] Overlay context must be an object'
    );
  });

  test('throws when overlay context actor entity is invalid', () => {
    const baseContext = createBaseContext();

    expect(() =>
      merger.merge(baseContext, { actorEntity: { id: 99 } })
    ).toThrow('[CRITICAL] actorEntity must have an id property');
  });

  test('throws when overlay runtime context is invalid', () => {
    const baseContext = createBaseContext();

    expect(() => merger.merge(baseContext, { runtimeCtx: 'oops' })).toThrow(
      '[CRITICAL] runtimeCtx must be an object'
    );
  });

  test('throws when overlay dispatcher lacks resolve', () => {
    const baseContext = createBaseContext();

    expect(() => merger.merge(baseContext, { dispatcher: {} })).toThrow(
      '[CRITICAL] dispatcher must have a resolve method'
    );
  });

  test('throws when overlay depth is negative', () => {
    const baseContext = createBaseContext();

    expect(() => merger.merge(baseContext, { depth: -3 })).toThrow(
      '[CRITICAL] depth must be a non-negative number'
    );
  });

  test('supports custom critical properties via ContextValidator.withCriticalProperties', () => {
    const customCritical = [
      'actorEntity',
      'runtimeCtx',
      'dispatcher',
      'cycleDetector',
      'depthGuard',
      'customService',
    ];
    const customValidator = ContextValidator.withCriticalProperties(
      customCritical
    );
    const customMerger = new ContextMerger(customCritical, customValidator);

    const baseContext = createBaseContext({
      customService: {
        callCount: 0,
        invoke() {
          this.callCount += 1;
        },
      },
    });

    const overlayContext = {
      customService: {
        callCount: 10,
        invoke() {
          this.callCount += 1;
        },
      },
    };

    const merged = customMerger.merge(baseContext, overlayContext);

    expect(merged.customService).toBe(overlayContext.customService);
    expect(customMerger.getValidator().hasAllCriticalProperties(merged)).toBe(
      true
    );
  });
});
