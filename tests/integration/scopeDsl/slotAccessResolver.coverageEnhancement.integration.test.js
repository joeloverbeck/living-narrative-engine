import { describe, it, expect, jest } from '@jest/globals';
import createSlotAccessResolver from '../../../src/scopeDsl/nodes/slotAccessResolver.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import ScopeDslErrorHandler from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { StructuredTrace } from '../../../src/actions/tracing/structuredTrace.js';
import { ScopeDslError } from '../../../src/scopeDsl/errors/scopeDslError.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

/**
 *
 */
function createLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

describe('slotAccessResolver integration coverage enhancement', () => {
  const actorId = 'entity:integration-actor';
  const directOuterId = 'item:layered-coat';
  const baseLayerId = 'item:thermal-shirt';
  const leggingsId = 'item:coverage-leggings';
  const hoodId = 'item:coverage-hood';
  const storageEntityId = 'entity:storage';
  const archiveEntityId = 'entity:archive';
  const objectSourceId = 'entity:object-source';

  /**
   * Builds an entity manager populated with entities that exercise
   * coverage-aware slot resolution as well as component fallbacks.
   */
  function buildEntityManager() {
    return new SimpleEntityManager([
      {
        id: actorId,
        components: {
          'clothing:equipment': {
            entityId: actorId,
            equipped: {
              torso_upper: {
                base: baseLayerId,
              },
              legs: {
                outer: leggingsId,
              },
              head_gear: {
                accessories: hoodId,
              },
            },
          },
        },
      },
      {
        id: directOuterId,
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_lower'],
            coveragePriority: 'outer',
          },
        },
      },
      {
        id: baseLayerId,
        components: {},
      },
      {
        id: leggingsId,
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_upper'],
            coveragePriority: 'outer',
          },
        },
      },
      {
        id: hoodId,
        components: {
          'clothing:coverage_mapping': {
            covers: ['torso_upper'],
            coveragePriority: 'outer',
          },
        },
      },
      {
        id: storageEntityId,
        components: {
          torso_upper: 'stored-top',
        },
      },
      {
        id: archiveEntityId,
        components: {
          torso_upper: ['archive-a', 'archive-b'],
        },
      },
      {
        id: objectSourceId,
        components: {
          torso_upper: { id: 'object-component' },
        },
      },
    ]);
  }

  it('resolves slot access with coverage mapping, tracing and component fallbacks', () => {
    const entityManager = buildEntityManager();
    const entitiesGateway = {
      getComponentData: (entityId, componentId) =>
        entityManager.getComponentData(entityId, componentId),
    };
    const logger = createLogger();
    const errorHandler = new ScopeDslErrorHandler({
      logger,
      config: { isDevelopment: true, maxBufferSize: 10 },
    });
    const slotAccessResolver = createSlotAccessResolver({
      entitiesGateway,
      errorHandler,
    });

    const clothingEquipment = entityManager.getComponentData(
      actorId,
      'clothing:equipment'
    );

    const structuredTrace = new StructuredTrace();
    const parent = { type: 'Step', field: 'topmost_clothing' };
    const node = { type: 'Step', field: 'torso_upper', parent };

    const secondaryEquipped = JSON.parse(
      JSON.stringify(clothingEquipment.equipped)
    );
    secondaryEquipped.torso_upper = {
      outer: directOuterId,
      base: baseLayerId,
    };

    const dispatcher = {
      resolve: jest.fn(() => [
        {
          __clothingSlotAccess: true,
          entityId: actorId,
          mode: 'all',
          equipped: clothingEquipment.equipped,
        },
        [
          {
            __clothingSlotAccess: true,
            entityId: actorId,
            mode: 'topmost',
            equipped: secondaryEquipped,
          },
        ],
        storageEntityId,
        archiveEntityId,
        objectSourceId,
      ]),
    };

    const context = {
      dispatcher,
      trace: structuredTrace,
      structuredTrace,
    };

    const results = slotAccessResolver.resolve(node, context);
    const resolvedValues = Array.from(results);

    expect(resolvedValues).toEqual(
      expect.arrayContaining([
        leggingsId,
        directOuterId,
        'stored-top',
        'archive-a',
        'archive-b',
        expect.objectContaining({ id: 'object-component' }),
      ])
    );

    expect(dispatcher.resolve).toHaveBeenCalledWith(parent, context);

    const spanOperations = structuredTrace
      .getSpans()
      .map((span) => span.operation);
    expect(spanOperations).toEqual(
      expect.arrayContaining([
        'candidate_collection',
        'priority_calculation',
        'final_selection',
      ])
    );
  });

  it('returns null for malformed access data when no error handler is provided', () => {
    const entityManager = buildEntityManager();
    const entitiesGateway = {
      getComponentData: (entityId, componentId) =>
        entityManager.getComponentData(entityId, componentId),
    };
    const slotAccessResolver = createSlotAccessResolver({ entitiesGateway });
    const parent = { type: 'Step', field: 'topmost_clothing' };

    /**
     *
     * @param parentResults
     * @param field
     */
    function resolveWith(parentResults, field = 'torso_upper') {
      const dispatcher = { resolve: () => parentResults };
      return slotAccessResolver.resolve(
        { type: 'Step', field, parent },
        { dispatcher, trace: null, structuredTrace: null }
      );
    }

    const malformedAccess = {
      __clothingSlotAccess: true,
      entityId: actorId,
      mode: 'all',
      equipped: null,
    };

    expect(resolveWith([malformedAccess]).size).toBe(0);
    expect(resolveWith([malformedAccess], null).size).toBe(0);
    expect(resolveWith([malformedAccess], 'not_a_slot').size).toBe(0);

    const invalidMode = {
      __clothingSlotAccess: true,
      entityId: actorId,
      mode: 'invalid_mode',
      equipped: {},
    };
    expect(resolveWith([invalidMode]).size).toBe(0);

    const noCandidates = {
      __clothingSlotAccess: true,
      entityId: actorId,
      mode: 'outer',
      equipped: {
        torso_upper: {},
      },
    };
    expect(resolveWith([noCandidates]).size).toBe(0);
  });

  it('bubbles structured errors through ScopeDslErrorHandler when recovery fails', () => {
    const entityManager = buildEntityManager();
    const entitiesGateway = {
      getComponentData: (entityId, componentId) =>
        entityManager.getComponentData(entityId, componentId),
    };
    const logger = createLogger();
    const errorHandler = new ScopeDslErrorHandler({
      logger,
      config: { isDevelopment: true, maxBufferSize: 5 },
    });
    const slotAccessResolver = createSlotAccessResolver({
      entitiesGateway,
      errorHandler,
    });

    const parent = { type: 'Step', field: 'topmost_clothing' };
    const node = { type: 'Step', field: 'torso_upper', parent };
    const dispatcher = {
      resolve: () => [
        {
          __clothingSlotAccess: true,
          entityId: actorId,
          mode: 'invalid_mode',
          equipped: {},
        },
      ],
    };

    expect(() =>
      slotAccessResolver.resolve(node, {
        dispatcher,
        trace: null,
        structuredTrace: null,
      })
    ).toThrow(ScopeDslError);

    const bufferedError = errorHandler.getErrorBuffer()[0];
    expect(bufferedError).toBeDefined();
    expect(bufferedError.code).toBe(ErrorCodes.INVALID_DATA_GENERIC);
  });
});
