import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import createClothingStepResolver from '../../../src/scopeDsl/nodes/clothingStepResolver.js';
import createSlotAccessResolver from '../../../src/scopeDsl/nodes/slotAccessResolver.js';
import ScopeDslErrorHandler from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { StructuredTrace } from '../../../src/actions/tracing/structuredTrace.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';
import { ScopeDslError } from '../../../src/scopeDsl/errors/scopeDslError.js';

/**
 *
 */
function createLoggerDouble() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

describe('slotAccessResolver integration recovery paths', () => {
  let entityManager;
  let entitiesGateway;
  let clothingStepResolver;
  let slotAccessResolver;
  let errorHandler;
  let logger;

  beforeEach(() => {
    entityManager = new SimpleEntityManager([]);
    entitiesGateway = {
      getComponentData: (entityId, componentId) =>
        entityManager.getComponentData(entityId, componentId),
    };

    logger = createLoggerDouble();
    errorHandler = new ScopeDslErrorHandler({
      logger,
      config: { isDevelopment: true, maxBufferSize: 50 },
    });

    clothingStepResolver = createClothingStepResolver({
      entitiesGateway,
      errorHandler,
    });

    slotAccessResolver = createSlotAccessResolver({
      entitiesGateway,
      errorHandler,
    });
  });

  /**
   *
   * @param entityId
   * @param equipment
   */
  function createClothingAccess(entityId, equipment) {
    entityManager.addComponent(entityId, 'clothing:equipment', equipment);

    const results = clothingStepResolver.resolve(
      {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Variable', name: 'target' },
      },
      {
        dispatcher: { resolve: () => new Set([entityId]) },
        trace: { addLog: jest.fn() },
      }
    );

    return Array.from(results)[0];
  }

  it('evaluates canResolve gating for clothing slot contexts', () => {
    expect(slotAccessResolver.canResolve(null)).toBe(false);
    expect(
      slotAccessResolver.canResolve({ type: 'Step', field: 'torso_lower' })
    ).toBe(false);
    expect(
      slotAccessResolver.canResolve({
        type: 'Step',
        field: 'torso_lower',
        parent: { type: 'Step', field: 'inventory' },
      })
    ).toBe(false);
    expect(
      slotAccessResolver.canResolve({
        type: 'Step',
        field: 'torso_lower',
        parent: { type: 'Step', field: 'topmost_clothing' },
      })
    ).toBe(true);
    expect(
      slotAccessResolver.canResolve({
        type: 'Step',
        field: 'nonexistent_slot',
        parent: { type: 'Step', field: 'topmost_clothing' },
      })
    ).toBe(false);
  });

  it('surfaces invalid slot inputs and missing context through the ScopeDSL error handler', () => {
    const actorId = 'entity:slot-access-errors';
    const baseEquipment = {
      equipped: {
        torso_lower: { base: 'item:leggings' },
      },
    };

    const validAccess = createClothingAccess(actorId, baseEquipment);

    errorHandler.clearErrorBuffer();
    expect(() =>
      slotAccessResolver.resolve(
        {
          type: 'Step',
          field: 'unsupported_slot',
          parent: { type: 'Step', field: 'topmost_clothing' },
        },
        {
          dispatcher: { resolve: () => new Set([validAccess]) },
          trace: { addLog: jest.fn() },
        }
      )
    ).toThrow(ScopeDslError);

    let latestError = errorHandler.getErrorBuffer().pop();
    expect(latestError.code).toBe(ErrorCodes.INVALID_ENTITY_ID);
    expect(latestError.sanitizedContext.slotName).toBe('unsupported_slot');

    const missingEquipmentAccess = {
      __clothingSlotAccess: true,
      mode: 'topmost',
      entityId: actorId,
      equipped: null,
    };

    errorHandler.clearErrorBuffer();
    expect(() =>
      slotAccessResolver.resolve(
        {
          type: 'Step',
          field: 'torso_lower',
          parent: { type: 'Step', field: 'topmost_clothing' },
        },
        {
          dispatcher: { resolve: () => new Set([missingEquipmentAccess]) },
          trace: { addLog: jest.fn() },
        }
      )
    ).toThrow(ScopeDslError);

    latestError = errorHandler.getErrorBuffer().pop();
    expect(latestError.code).toBe(ErrorCodes.MISSING_CONTEXT_GENERIC);
    expect(latestError.sanitizedContext.entityId).toBe(actorId);

    const invalidModeAccess = {
      __clothingSlotAccess: true,
      mode: 'mystery',
      entityId: actorId,
      equipped: { torso_lower: { base: 'item:leggings' } },
    };

    errorHandler.clearErrorBuffer();
    expect(() =>
      slotAccessResolver.resolve(
        {
          type: 'Step',
          field: 'torso_lower',
          parent: { type: 'Step', field: 'topmost_clothing' },
        },
        {
          dispatcher: { resolve: () => new Set([invalidModeAccess]) },
          trace: { addLog: jest.fn() },
        }
      )
    ).toThrow(ScopeDslError);

    latestError = errorHandler.getErrorBuffer().pop();
    expect(latestError.code).toBe(ErrorCodes.INVALID_DATA_GENERIC);
    expect(latestError.sanitizedContext.mode).toBe('mystery');
  });

  it('falls back to raw slot selections when trace is unavailable and preserves component aggregates', () => {
    const actorId = 'entity:trace-fallback';
    const storageEntityId = 'entity:torso-storage';

    const clothingAccess = createClothingAccess(actorId, {
      equipped: {
        torso_lower: {
          base: 'item:thermal-leggings',
        },
      },
    });

    entityManager.addComponent(storageEntityId, 'torso_lower', {
      stash: ['item:archived-skirt'],
    });

    const results = slotAccessResolver.resolve(
      {
        type: 'Step',
        field: 'torso_lower',
        parent: { type: 'Step', field: 'topmost_clothing' },
      },
      {
        dispatcher: {
          resolve: () =>
            new Set([
              clothingAccess,
              storageEntityId,
            ]),
        },
        trace: null,
      }
    );

    const resolvedValues = Array.from(results);
    expect(resolvedValues).toContain('item:thermal-leggings');
    expect(resolvedValues).toContainEqual({ stash: ['item:archived-skirt'] });
  });

  it('records structured trace metadata when no candidates can be resolved', () => {
    const actorId = 'entity:trace-events';

    const clothingAccess = createClothingAccess(actorId, {
      equipped: {
        torso_lower: {},
        torso_upper: { base: null },
      },
    });

    const structuredTrace = new StructuredTrace();
    const outerSpan = structuredTrace.startSpan('integration-test');

    const results = slotAccessResolver.resolve(
      {
        type: 'Step',
        field: 'torso_lower',
        parent: { type: 'Step', field: 'topmost_clothing' },
      },
      {
        dispatcher: { resolve: () => new Set([clothingAccess]) },
        structuredTrace,
      }
    );

    structuredTrace.endSpan(outerSpan);

    expect(Array.from(results)).toHaveLength(0);
    const events = outerSpan.attributes.events || [];
    const noSlotEvent = events.find((event) => event.name === 'no_slot_data');
    expect(noSlotEvent).toBeDefined();
    expect(noSlotEvent.attributes.slotName).toBe('torso_lower');
  });
});
